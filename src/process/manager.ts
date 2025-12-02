import { EventEmitter } from "events"
import type { NormalizedConfig, NormalizedService, ServiceGroup } from "../config/types"
import { getDependencyOrder, loadConfig } from "../config/loader"
import {
  type ServiceState,
  type LogLine,
  type ManagedProcess,
  type StartOptions,
  type StopOptions,
  createInitialState,
  isRunning,
  canStop,
} from "./types"
import { spawnService, processStreams, stopProcess, stopComposeService } from "./spawner"
import { waitForHealthy, createHealthcheckPoller } from "./healthcheck"
import { ResourceMonitor, type ResourceStats, type ResourceDataPoint } from "./resources"

interface ProcessManagerEvents {
  "state-change": [name: string, state: ServiceState]
  log: [line: LogLine]
  error: [name: string, error: Error]
  "all-stopped": []
  "config-reloaded": [config: NormalizedConfig]
  "config-error": [error: Error]
  "resources-updated": [stats: Map<string, ResourceStats | null>]
}

/**
 * Central orchestrator for all service lifecycles
 */
export class ProcessManager extends EventEmitter<ProcessManagerEvents> {
  private config: NormalizedConfig
  private processes: Map<string, ManagedProcess> = new Map()
  private states: Map<string, ServiceState> = new Map()
  private resourceMonitor: ResourceMonitor
  private resourcePollTimer: Timer | null = null

  constructor(config: NormalizedConfig) {
    super()
    this.config = config
    this.resourceMonitor = new ResourceMonitor()

    // Initialize states for all services
    for (const name of config.services.keys()) {
      this.states.set(name, createInitialState(name))
    }

    // Start resource monitoring
    this.startResourceMonitoring()
  }

  /**
   * Start polling for resource stats
   */
  private startResourceMonitoring(): void {
    // Start the resource monitor's internal polling (collects stats via ps)
    this.resourceMonitor.start(1000)

    // Poll every second to update service states with resource data
    this.resourcePollTimer = setInterval(() => {
      this.updateResourceStats()
    }, 1000)
  }

  /**
   * Update resource stats for all running services
   */
  private updateResourceStats(): void {
    const stats = this.resourceMonitor.getAllStats()
    let hasUpdates = false

    for (const [name, resourceStats] of stats) {
      const state = this.states.get(name)
      if (state && resourceStats) {
        // Only update if stats changed significantly
        const prev = state.resources
        if (
          !prev ||
          Math.abs(prev.cpu - resourceStats.cpu) > 0.1 ||
          Math.abs(prev.memory - resourceStats.memory) > 1024
        ) {
          this.states.set(name, { ...state, resources: resourceStats })
          hasUpdates = true
        }
      }
    }

    if (hasUpdates) {
      this.emit("resources-updated", stats)
    }
  }

  /**
   * Get resource history for a service (for graphs)
   */
  getResourceHistory(name: string): ResourceDataPoint[] {
    return this.resourceMonitor.getHistory(name)
  }

  /**
   * Get state for a single service
   */
  getState(name: string): ServiceState | undefined {
    return this.states.get(name)
  }

  /**
   * Get states for all services (in consistent order)
   */
  getAllStates(): ServiceState[] {
    // Return in dependency order for consistent display
    const order = getDependencyOrder(this.config.services)
    return order.map((name) => this.states.get(name)!).filter(Boolean)
  }

  /**
   * Update state and emit event
   */
  private updateState(name: string, updates: Partial<ServiceState>): void {
    const current = this.states.get(name)
    if (!current) return

    const newState = { ...current, ...updates }
    this.states.set(name, newState)
    this.emit("state-change", name, newState)
  }

  /**
   * Emit a log line
   */
  private emitLog(line: LogLine): void {
    this.emit("log", line)
  }

  /**
   * Start a single service
   */
  async start(name: string, options: StartOptions = {}): Promise<void> {
    const serviceConfig = this.config.services.get(name)
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${name}`)
    }

    const state = this.states.get(name)!

    // Check if already running
    if (isRunning(state) && !options.force) {
      return
    }

    // Stop if force restart
    if (options.force && isRunning(state)) {
      await this.stop(name)
    }

    // Wait for dependencies first
    if (!options.skipDeps) {
      await this.waitForDependencies(name)
    }

    this.updateState(name, { status: "starting", error: undefined })

    try {
      const result = spawnService(serviceConfig)
      const proc = result.process

      const managed: ManagedProcess = {
        name,
        process: proc,
        state: this.states.get(name)!,
      }
      this.processes.set(name, managed)

      this.updateState(name, {
        pid: proc.pid,
        startedAt: new Date(),
      })

      // Start tracking resource usage
      if (proc.pid) {
        this.resourceMonitor.track(name, proc.pid)
      }

      // Handle stdout/stderr
      processStreams(result, name, (line) => this.emitLog(line)).catch((err) => this.emit("error", name, err))

      // Handle process exit
      proc.exited.then((exitCode) => {
        this.handleExit(name, exitCode)
      })

      // If there's a healthcheck, wait for it
      if (serviceConfig.healthcheck) {
        const healthy = await waitForHealthy(serviceConfig.healthcheck, (attempt, result) => {
          this.emitLog({
            timestamp: new Date(),
            service: name,
            content: `Healthcheck attempt ${attempt}/${serviceConfig.healthcheck!.retries}: ${result.healthy ? "healthy" : result.error || "unhealthy"}`,
            stream: "stderr",
          })
        })

        if (healthy) {
          this.updateState(name, { status: "healthy" })

          // Start continuous healthcheck polling
          const poller = createHealthcheckPoller(serviceConfig.healthcheck, (result) => {
            if (!result.healthy && this.states.get(name)?.status === "healthy") {
              this.updateState(name, { status: "running" })
            } else if (result.healthy && this.states.get(name)?.status === "running") {
              this.updateState(name, { status: "healthy" })
            }
          })
          managed.healthcheckTimer = poller as unknown as Timer
          poller.start()
        } else {
          this.updateState(name, {
            status: "failed",
            error: "Healthcheck failed after all retries",
          })
          return
        }
      } else {
        this.updateState(name, { status: "running" })
      }
    } catch (error) {
      this.updateState(name, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Wait for a service's dependencies to be ready
   */
  private async waitForDependencies(name: string): Promise<void> {
    const serviceConfig = this.config.services.get(name)
    if (!serviceConfig) return

    for (const [depName, condition] of serviceConfig.dependsOn) {
      const depState = this.states.get(depName)
      if (!depState) continue

      // Start dependency if not running
      if (!isRunning(depState)) {
        await this.start(depName)
      }

      // Wait for the appropriate condition
      if (condition === "healthy") {
        await this.waitForStatus(depName, ["healthy"])
      } else {
        await this.waitForStatus(depName, ["running", "healthy"])
      }
    }
  }

  /**
   * Wait for a service to reach one of the specified statuses
   */
  private waitForStatus(name: string, statuses: ServiceState["status"][], timeoutMs: number = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const current = this.states.get(name)
      if (current && statuses.includes(current.status)) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        this.off("state-change", listener)
        reject(new Error(`Timeout waiting for ${name} to reach ${statuses.join(" or ")}`))
      }, timeoutMs)

      const listener = (changedName: string, state: ServiceState) => {
        if (changedName === name) {
          if (statuses.includes(state.status)) {
            clearTimeout(timeout)
            this.off("state-change", listener)
            resolve()
          } else if (state.status === "failed" || state.status === "crashed") {
            clearTimeout(timeout)
            this.off("state-change", listener)
            reject(new Error(`Service ${name} ${state.status}: ${state.error}`))
          }
        }
      }

      this.on("state-change", listener)
    })
  }

  /**
   * Handle process exit
   */
  private handleExit(name: string, exitCode: number): void {
    const managed = this.processes.get(name)
    if (managed?.healthcheckTimer) {
      ;(managed.healthcheckTimer as unknown as { stop: () => void }).stop?.()
    }
    this.processes.delete(name)

    // Stop tracking resources
    this.resourceMonitor.untrack(name)

    const current = this.states.get(name)
    if (!current) return

    // Determine new status
    const status = exitCode === 0 ? "stopped" : "crashed"

    this.updateState(name, {
      status,
      exitCode,
      stoppedAt: new Date(),
      pid: undefined,
    })

    // Handle restart policy
    const serviceConfig = this.config.services.get(name)
    if (serviceConfig && status === "crashed") {
      if (serviceConfig.restart === "always" || (serviceConfig.restart === "on-failure" && exitCode !== 0)) {
        const restartCount = (current.restartCount || 0) + 1
        this.updateState(name, { restartCount })

        // Delay restart slightly
        setTimeout(() => {
          if (this.states.get(name)?.status === "crashed") {
            this.start(name, { skipDeps: true }).catch((err) => this.emit("error", name, err))
          }
        }, 1000)
      }
    }

    // Check if all services are stopped
    const allStopped = Array.from(this.states.values()).every(
      (s) => s.status === "stopped" || s.status === "crashed" || s.status === "failed",
    )
    if (allStopped) {
      this.emit("all-stopped")
    }
  }

  /**
   * Stop a single service
   */
  async stop(name: string, options: StopOptions = {}): Promise<void> {
    const state = this.states.get(name)
    if (!state || !canStop(state)) {
      return
    }

    // Stop dependent services first
    if (!options.skipDependents) {
      await this.stopDependents(name)
    }

    this.updateState(name, { status: "stopping" })

    const managed = this.processes.get(name)
    if (!managed) {
      this.updateState(name, { status: "stopped" })
      return
    }

    // Stop healthcheck
    if (managed.healthcheckTimer) {
      ;(managed.healthcheckTimer as unknown as { stop: () => void }).stop?.()
    }

    const serviceConfig = this.config.services.get(name)
    const signal = options.signal || serviceConfig?.stopSignal || "SIGTERM"
    const timeout = options.timeout ?? 10000

    // Use compose stop for compose services
    if (serviceConfig?.compose) {
      await stopComposeService(serviceConfig.compose, timeout)
      // Also kill the docker compose up process
      await stopProcess(managed.process, signal, timeout)
    } else {
      await stopProcess(managed.process, signal, timeout)
    }
  }

  /**
   * Stop services that depend on the given service
   */
  private async stopDependents(name: string): Promise<void> {
    const dependents: string[] = []

    for (const [serviceName, config] of this.config.services) {
      if (config.dependsOn.has(name)) {
        dependents.push(serviceName)
      }
    }

    await Promise.all(dependents.map((dep) => this.stop(dep)))
  }

  /**
   * Start all services in dependency order
   */
  async startAll(): Promise<void> {
    const order = getDependencyOrder(this.config.services)

    for (const name of order) {
      await this.start(name)
    }
  }

  /**
   * Stop all services (in reverse dependency order)
   */
  async stopAll(): Promise<void> {
    const order = getDependencyOrder(this.config.services)

    // Stop in reverse order
    for (const name of order.reverse()) {
      await this.stop(name, { skipDependents: true })
    }
  }

  /**
   * Restart a single service
   */
  async restart(name: string): Promise<void> {
    await this.stop(name)
    await this.start(name)
  }

  /**
   * Restart all services
   */
  async restartAll(): Promise<void> {
    await this.stopAll()
    await this.startAll()
  }

  /**
   * Get service names
   */
  getServiceNames(): string[] {
    return Array.from(this.config.services.keys())
  }

  /**
   * Get service config
   */
  getServiceConfig(name: string): NormalizedService | undefined {
    return this.config.services.get(name)
  }

  /**
   * Get all groups
   */
  getGroups(): Map<string, ServiceGroup> {
    return this.config.groups
  }

  /**
   * Get a specific group
   */
  getGroup(name: string): ServiceGroup | undefined {
    return this.config.groups.get(name)
  }

  /**
   * Get group for a service
   */
  getServiceGroup(serviceName: string): string | undefined {
    return this.config.services.get(serviceName)?.group
  }

  /**
   * Start all services in a group
   */
  async startGroup(groupName: string): Promise<void> {
    const group = this.config.groups.get(groupName)
    if (!group) {
      throw new Error(`Unknown group: ${groupName}`)
    }

    // Get services in dependency order, filtered to this group
    const order = getDependencyOrder(this.config.services)
    const groupServices = order.filter((name) => group.services.includes(name))

    for (const name of groupServices) {
      await this.start(name)
    }
  }

  /**
   * Stop all services in a group
   */
  async stopGroup(groupName: string): Promise<void> {
    const group = this.config.groups.get(groupName)
    if (!group) {
      throw new Error(`Unknown group: ${groupName}`)
    }

    // Get services in reverse dependency order, filtered to this group
    const order = getDependencyOrder(this.config.services)
    const groupServices = order.filter((name) => group.services.includes(name)).reverse()

    for (const name of groupServices) {
      await this.stop(name, { skipDependents: true })
    }
  }

  /**
   * Restart all services in a group
   */
  async restartGroup(groupName: string): Promise<void> {
    await this.stopGroup(groupName)
    await this.startGroup(groupName)
  }

  /**
   * Get the current config
   */
  getConfig(): NormalizedConfig {
    return this.config
  }

  /**
   * Reload configuration from disk
   * Returns info about what changed
   */
  async reloadConfig(): Promise<{
    added: string[]
    removed: string[]
    modified: string[]
  }> {
    try {
      const newConfig = await loadConfig(this.config.configPath)

      const added: string[] = []
      const removed: string[] = []
      const modified: string[] = []

      // Find added and modified services
      for (const [name, newService] of newConfig.services) {
        const oldService = this.config.services.get(name)
        if (!oldService) {
          added.push(name)
        } else if (this.serviceConfigChanged(oldService, newService)) {
          modified.push(name)
        }
      }

      // Find removed services
      for (const name of this.config.services.keys()) {
        if (!newConfig.services.has(name)) {
          removed.push(name)
        }
      }

      // Stop and remove services that were removed from config
      for (const name of removed) {
        if (isRunning(this.states.get(name)!)) {
          await this.stop(name)
        }
        this.states.delete(name)
      }

      // Add states for new services
      for (const name of added) {
        this.states.set(name, createInitialState(name))
      }

      // For modified services, restart if running
      for (const name of modified) {
        const state = this.states.get(name)
        if (state && isRunning(state)) {
          // Will restart after config update
          await this.stop(name)
        }
      }

      // Update config
      this.config = newConfig

      // Restart modified services that were running
      for (const name of modified) {
        const state = this.states.get(name)
        if (state?.status === "stopped") {
          // Was running before, restart with new config
          await this.start(name)
        }
      }

      this.emit("config-reloaded", newConfig)

      return { added, removed, modified }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.emit("config-error", err)
      throw err
    }
  }

  /**
   * Check if service config has changed (for reload)
   */
  private serviceConfigChanged(oldService: NormalizedService, newService: NormalizedService): boolean {
    // Compare key fields
    if (oldService.cmd !== newService.cmd) return true
    if (oldService.cwd !== newService.cwd) return true
    if (oldService.restart !== newService.restart) return true
    if (oldService.group !== newService.group) return true

    // Compare env
    const oldEnvKeys = Object.keys(oldService.env).sort()
    const newEnvKeys = Object.keys(newService.env).sort()
    if (oldEnvKeys.length !== newEnvKeys.length) return true
    for (let i = 0; i < oldEnvKeys.length; i++) {
      if (oldEnvKeys[i] !== newEnvKeys[i]) return true
      if (oldService.env[oldEnvKeys[i]!] !== newService.env[newEnvKeys[i]!]) return true
    }

    // Compare dependencies
    if (oldService.dependsOn.size !== newService.dependsOn.size) return true
    for (const [dep, condition] of oldService.dependsOn) {
      if (newService.dependsOn.get(dep) !== condition) return true
    }

    return false
  }

  /**
   * Toggle group collapsed state
   */
  toggleGroupCollapsed(groupName: string): boolean {
    const group = this.config.groups.get(groupName)
    if (group) {
      group.collapsed = !group.collapsed
      return group.collapsed
    }
    return false
  }
}
