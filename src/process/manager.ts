import { EventEmitter } from "events";
import type { NormalizedConfig, NormalizedService } from "../config/types";
import { getDependencyOrder } from "../config/loader";
import {
  type ServiceState,
  type LogLine,
  type ManagedProcess,
  type StartOptions,
  type StopOptions,
  createInitialState,
  isRunning,
  canStart,
  canStop,
} from "./types";
import { spawnService, processStreams, stopProcess } from "./spawner";
import { waitForHealthy, createHealthcheckPoller } from "./healthcheck";

interface ProcessManagerEvents {
  "state-change": [name: string, state: ServiceState];
  log: [line: LogLine];
  error: [name: string, error: Error];
  "all-stopped": [];
}

/**
 * Central orchestrator for all service lifecycles
 */
export class ProcessManager extends EventEmitter<ProcessManagerEvents> {
  private config: NormalizedConfig;
  private processes: Map<string, ManagedProcess> = new Map();
  private states: Map<string, ServiceState> = new Map();

  constructor(config: NormalizedConfig) {
    super();
    this.config = config;

    // Initialize states for all services
    for (const name of config.services.keys()) {
      this.states.set(name, createInitialState(name));
    }
  }

  /**
   * Get state for a single service
   */
  getState(name: string): ServiceState | undefined {
    return this.states.get(name);
  }

  /**
   * Get states for all services (in consistent order)
   */
  getAllStates(): ServiceState[] {
    // Return in dependency order for consistent display
    const order = getDependencyOrder(this.config.services);
    return order.map((name) => this.states.get(name)!).filter(Boolean);
  }

  /**
   * Update state and emit event
   */
  private updateState(name: string, updates: Partial<ServiceState>): void {
    const current = this.states.get(name);
    if (!current) return;

    const newState = { ...current, ...updates };
    this.states.set(name, newState);
    this.emit("state-change", name, newState);
  }

  /**
   * Emit a log line
   */
  private emitLog(line: LogLine): void {
    this.emit("log", line);
  }

  /**
   * Start a single service
   */
  async start(name: string, options: StartOptions = {}): Promise<void> {
    const serviceConfig = this.config.services.get(name);
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${name}`);
    }

    const state = this.states.get(name)!;

    // Check if already running
    if (isRunning(state) && !options.force) {
      return;
    }

    // Stop if force restart
    if (options.force && isRunning(state)) {
      await this.stop(name);
    }

    // Wait for dependencies first
    if (!options.skipDeps) {
      await this.waitForDependencies(name);
    }

    this.updateState(name, { status: "starting", error: undefined });

    try {
      const result = spawnService(serviceConfig);
      const proc = result.process;

      const managed: ManagedProcess = {
        name,
        process: proc,
        state: this.states.get(name)!,
      };
      this.processes.set(name, managed);

      this.updateState(name, {
        pid: proc.pid,
        startedAt: new Date(),
      });

      // Handle stdout/stderr
      processStreams(result, name, (line) => this.emitLog(line)).catch((err) =>
        this.emit("error", name, err),
      );

      // Handle process exit
      proc.exited.then((exitCode) => {
        this.handleExit(name, exitCode);
      });

      // If there's a healthcheck, wait for it
      if (serviceConfig.healthcheck) {
        const healthy = await waitForHealthy(serviceConfig.healthcheck, (attempt, result) => {
          this.emitLog({
            timestamp: new Date(),
            service: name,
            content: `Healthcheck attempt ${attempt}/${serviceConfig.healthcheck!.retries}: ${result.healthy ? "healthy" : result.error || "unhealthy"}`,
            stream: "stderr",
          });
        });

        if (healthy) {
          this.updateState(name, { status: "healthy" });

          // Start continuous healthcheck polling
          const poller = createHealthcheckPoller(serviceConfig.healthcheck, (result) => {
            if (!result.healthy && this.states.get(name)?.status === "healthy") {
              this.updateState(name, { status: "running" });
            } else if (result.healthy && this.states.get(name)?.status === "running") {
              this.updateState(name, { status: "healthy" });
            }
          });
          managed.healthcheckTimer = poller as unknown as Timer;
          poller.start();
        } else {
          this.updateState(name, {
            status: "failed",
            error: "Healthcheck failed after all retries",
          });
          return;
        }
      } else {
        this.updateState(name, { status: "running" });
      }
    } catch (error) {
      this.updateState(name, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Wait for a service's dependencies to be ready
   */
  private async waitForDependencies(name: string): Promise<void> {
    const serviceConfig = this.config.services.get(name);
    if (!serviceConfig) return;

    for (const [depName, condition] of serviceConfig.dependsOn) {
      const depState = this.states.get(depName);
      if (!depState) continue;

      // Start dependency if not running
      if (!isRunning(depState)) {
        await this.start(depName);
      }

      // Wait for the appropriate condition
      if (condition === "healthy") {
        await this.waitForStatus(depName, ["healthy"]);
      } else {
        await this.waitForStatus(depName, ["running", "healthy"]);
      }
    }
  }

  /**
   * Wait for a service to reach one of the specified statuses
   */
  private waitForStatus(
    name: string,
    statuses: ServiceState["status"][],
    timeoutMs: number = 60000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const current = this.states.get(name);
      if (current && statuses.includes(current.status)) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.off("state-change", listener);
        reject(new Error(`Timeout waiting for ${name} to reach ${statuses.join(" or ")}`));
      }, timeoutMs);

      const listener = (changedName: string, state: ServiceState) => {
        if (changedName === name) {
          if (statuses.includes(state.status)) {
            clearTimeout(timeout);
            this.off("state-change", listener);
            resolve();
          } else if (state.status === "failed" || state.status === "crashed") {
            clearTimeout(timeout);
            this.off("state-change", listener);
            reject(new Error(`Service ${name} ${state.status}: ${state.error}`));
          }
        }
      };

      this.on("state-change", listener);
    });
  }

  /**
   * Handle process exit
   */
  private handleExit(name: string, exitCode: number): void {
    const managed = this.processes.get(name);
    if (managed?.healthcheckTimer) {
      (managed.healthcheckTimer as unknown as { stop: () => void }).stop?.();
    }
    this.processes.delete(name);

    const current = this.states.get(name);
    if (!current) return;

    // Determine new status
    const status = exitCode === 0 ? "stopped" : "crashed";

    this.updateState(name, {
      status,
      exitCode,
      stoppedAt: new Date(),
      pid: undefined,
    });

    // Handle restart policy
    const serviceConfig = this.config.services.get(name);
    if (serviceConfig && status === "crashed") {
      if (
        serviceConfig.restart === "always" ||
        (serviceConfig.restart === "on-failure" && exitCode !== 0)
      ) {
        const restartCount = (current.restartCount || 0) + 1;
        this.updateState(name, { restartCount });

        // Delay restart slightly
        setTimeout(() => {
          if (this.states.get(name)?.status === "crashed") {
            this.start(name, { skipDeps: true }).catch((err) => this.emit("error", name, err));
          }
        }, 1000);
      }
    }

    // Check if all services are stopped
    const allStopped = Array.from(this.states.values()).every(
      (s) => s.status === "stopped" || s.status === "crashed" || s.status === "failed",
    );
    if (allStopped) {
      this.emit("all-stopped");
    }
  }

  /**
   * Stop a single service
   */
  async stop(name: string, options: StopOptions = {}): Promise<void> {
    const state = this.states.get(name);
    if (!state || !canStop(state)) {
      return;
    }

    // Stop dependent services first
    if (!options.skipDependents) {
      await this.stopDependents(name);
    }

    this.updateState(name, { status: "stopping" });

    const managed = this.processes.get(name);
    if (!managed) {
      this.updateState(name, { status: "stopped" });
      return;
    }

    // Stop healthcheck
    if (managed.healthcheckTimer) {
      (managed.healthcheckTimer as unknown as { stop: () => void }).stop?.();
    }

    const serviceConfig = this.config.services.get(name);
    const signal = options.signal || serviceConfig?.stopSignal || "SIGTERM";
    const timeout = options.timeout ?? 10000;

    await stopProcess(managed.process, signal, timeout);
  }

  /**
   * Stop services that depend on the given service
   */
  private async stopDependents(name: string): Promise<void> {
    const dependents: string[] = [];

    for (const [serviceName, config] of this.config.services) {
      if (config.dependsOn.has(name)) {
        dependents.push(serviceName);
      }
    }

    await Promise.all(dependents.map((dep) => this.stop(dep)));
  }

  /**
   * Start all services in dependency order
   */
  async startAll(): Promise<void> {
    const order = getDependencyOrder(this.config.services);

    for (const name of order) {
      await this.start(name);
    }
  }

  /**
   * Stop all services (in reverse dependency order)
   */
  async stopAll(): Promise<void> {
    const order = getDependencyOrder(this.config.services);

    // Stop in reverse order
    for (const name of order.reverse()) {
      await this.stop(name, { skipDependents: true });
    }
  }

  /**
   * Restart a single service
   */
  async restart(name: string): Promise<void> {
    await this.stop(name);
    await this.start(name);
  }

  /**
   * Restart all services
   */
  async restartAll(): Promise<void> {
    await this.stopAll();
    await this.startAll();
  }

  /**
   * Get service names
   */
  getServiceNames(): string[] {
    return Array.from(this.config.services.keys());
  }

  /**
   * Get service config
   */
  getServiceConfig(name: string): NormalizedService | undefined {
    return this.config.services.get(name);
  }
}
