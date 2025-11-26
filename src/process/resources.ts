import { spawn } from "bun"

/**
 * Resource usage stats for a process
 */
export interface ResourceStats {
  /** CPU usage percentage (0-100+) */
  cpu: number
  /** Memory usage in bytes */
  memory: number
  /** Memory usage as percentage of system memory */
  memoryPercent: number
  /** Timestamp when stats were collected */
  timestamp: Date
}

/**
 * Historical resource data point for graphing
 */
export interface ResourceDataPoint {
  timestamp: Date
  cpu: number
  memory: number
}

/**
 * Resource history for a service
 */
export interface ResourceHistory {
  /** Service name */
  name: string
  /** Historical data points (most recent last) */
  history: ResourceDataPoint[]
  /** Current/latest stats */
  current: ResourceStats | null
}

const DEFAULT_HISTORY_SIZE = 60 // Keep 60 data points (1 minute at 1s intervals)

/**
 * Monitor resource usage for processes
 */
export class ResourceMonitor {
  private histories: Map<string, ResourceHistory> = new Map()
  private pollInterval: Timer | null = null
  private historySize: number
  private pidMap: Map<string, number> = new Map() // service name -> pid

  constructor(historySize = DEFAULT_HISTORY_SIZE) {
    this.historySize = historySize
  }

  /**
   * Start monitoring a process
   */
  track(name: string, pid: number): void {
    this.pidMap.set(name, pid)
    if (!this.histories.has(name)) {
      this.histories.set(name, {
        name,
        history: [],
        current: null,
      })
    }
  }

  /**
   * Stop monitoring a process
   */
  untrack(name: string): void {
    this.pidMap.delete(name)
    // Keep history for a bit in case service restarts
  }

  /**
   * Clear all history for a service
   */
  clearHistory(name: string): void {
    this.histories.delete(name)
  }

  /**
   * Get current stats for a service
   */
  getStats(name: string): ResourceStats | null {
    return this.histories.get(name)?.current || null
  }

  /**
   * Get resource history for a service
   */
  getHistory(name: string): ResourceDataPoint[] {
    return this.histories.get(name)?.history || []
  }

  /**
   * Get all current stats
   */
  getAllStats(): Map<string, ResourceStats | null> {
    const result = new Map<string, ResourceStats | null>()
    for (const [name] of this.pidMap) {
      result.set(name, this.getStats(name))
    }
    return result
  }

  /**
   * Start polling for resource stats
   */
  start(intervalMs = 1000): void {
    if (this.pollInterval) return

    this.pollInterval = setInterval(() => {
      this.poll().catch(() => {
        // Ignore polling errors
      })
    }, intervalMs)

    // Do initial poll
    this.poll().catch(() => {})
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Poll all tracked processes for stats
   */
  private async poll(): Promise<void> {
    const pids = Array.from(this.pidMap.entries())
    if (pids.length === 0) return

    try {
      // Get stats for all PIDs in one ps call
      const pidList = pids.map(([, pid]) => pid).join(",")
      const stats = await getProcessStats(pidList)

      const now = new Date()

      for (const [name, pid] of pids) {
        const stat = stats.get(pid)
        if (stat) {
          const history = this.histories.get(name)
          if (history) {
            history.current = {
              ...stat,
              timestamp: now,
            }

            // Add to history
            history.history.push({
              timestamp: now,
              cpu: stat.cpu,
              memory: stat.memory,
            })

            // Trim history if needed
            if (history.history.length > this.historySize) {
              history.history = history.history.slice(-this.historySize)
            }
          }
        }
      }
    } catch {
      // Ignore errors - process may have exited
    }
  }
}

/**
 * Get resource stats for multiple PIDs using ps command
 * Works on macOS and Linux
 */
async function getProcessStats(pids: string): Promise<Map<number, Omit<ResourceStats, "timestamp">>> {
  const result = new Map<number, Omit<ResourceStats, "timestamp">>()

  try {
    // Use ps to get CPU%, MEM%, RSS for the PIDs
    // -p specifies PIDs, -o specifies output format
    const proc = spawn({
      cmd: ["ps", "-p", pids, "-o", "pid=,pcpu=,pmem=,rss="],
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited

    // Parse output - each line is: PID %CPU %MEM RSS
    const lines = output.trim().split("\n").filter(Boolean)

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4) {
        const pid = parseInt(parts[0]!, 10)
        const cpu = parseFloat(parts[1]!) || 0
        const memoryPercent = parseFloat(parts[2]!) || 0
        // RSS is in KB, convert to bytes
        const memory = (parseInt(parts[3]!, 10) || 0) * 1024

        result.set(pid, {
          cpu,
          memory,
          memoryPercent,
        })
      }
    }
  } catch {
    // Process may have exited or ps failed
  }

  return result
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  if (i >= units.length) {
    return `${(bytes / Math.pow(k, units.length - 1)).toFixed(1)} ${units[units.length - 1]}`
  }

  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

/**
 * Format CPU percentage
 */
export function formatCpu(cpu: number): string {
  if (cpu < 10) {
    return `${cpu.toFixed(1)}%`
  }
  return `${Math.round(cpu)}%`
}

/**
 * Generate a simple ASCII sparkline for resource history
 */
export function generateSparkline(values: number[], width: number = 10): string {
  if (values.length === 0) return "".padStart(width)

  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

  // Get the last `width` values
  const data = values.slice(-width)

  // Find min/max for scaling
  const max = Math.max(...data, 1) // Avoid division by zero
  const min = Math.min(...data, 0)
  const range = max - min || 1

  let result = ""
  for (const value of data) {
    const normalized = (value - min) / range
    const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1)
    result += chars[index]
  }

  // Pad to width if needed
  return result.padStart(width)
}
