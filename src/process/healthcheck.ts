import { spawn } from "bun"
import type { NormalizedHealthcheck } from "../config/types"

export interface HealthcheckResult {
  healthy: boolean
  output?: string
  error?: string
  duration: number
}

/**
 * Run a healthcheck command once
 */
export async function runHealthcheck(config: NormalizedHealthcheck): Promise<HealthcheckResult> {
  const startTime = Date.now()

  try {
    // Parse the command
    const args = config.cmd.split(" ")

    const proc = spawn({
      cmd: args,
      stdout: "pipe",
      stderr: "pipe",
    })

    // Create timeout
    const timeoutPromise = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), config.timeoutMs))

    const exitPromise = proc.exited
    const result = await Promise.race([exitPromise, timeoutPromise])

    const duration = Date.now() - startTime

    if (result === "timeout") {
      proc.kill(9)
      return {
        healthy: false,
        error: "Healthcheck timed out",
        duration,
      }
    }

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    return {
      healthy: result === 0,
      output: stdout.trim() || undefined,
      error: stderr.trim() || undefined,
      duration,
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Run healthcheck with retries
 */
export async function waitForHealthy(
  config: NormalizedHealthcheck,
  onAttempt?: (attempt: number, result: HealthcheckResult) => void,
): Promise<boolean> {
  for (let attempt = 1; attempt <= config.retries; attempt++) {
    const result = await runHealthcheck(config)

    if (onAttempt) {
      onAttempt(attempt, result)
    }

    if (result.healthy) {
      return true
    }

    // Wait before next attempt (unless this was the last one)
    if (attempt < config.retries) {
      await sleep(config.intervalMs)
    }
  }

  return false
}

/**
 * Create a healthcheck poller that runs continuously
 */
export function createHealthcheckPoller(
  config: NormalizedHealthcheck,
  onResult: (result: HealthcheckResult) => void,
): { start: () => void; stop: () => void } {
  let timer: Timer | null = null
  let running = false

  const poll = async () => {
    if (!running) return

    const result = await runHealthcheck(config)
    onResult(result)

    if (running) {
      timer = setTimeout(poll, config.intervalMs)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      poll()
    },
    stop() {
      running = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
