import { spawn, type Subprocess } from "bun"
import type { NormalizedService } from "../config/types"
import type { LogLine } from "./types"

export interface SpawnResult {
  process: Subprocess
  stdoutReader: AsyncIterable<string>
  stderrReader: AsyncIterable<string>
}

/**
 * Parse a command string into arguments, handling quotes
 */
function parseCommand(cmd: string): string[] {
  const args: string[] = []
  let current = ""
  let inQuote: string | null = null

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i]!

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = char
    } else if (char === " " || char === "\t") {
      if (current) {
        args.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

/**
 * Create an async iterable that reads lines from a ReadableStream
 */
async function* readLines(
  stream: ReadableStream<Uint8Array> | null,
  service: string,
  streamType: "stdout" | "stderr",
): AsyncIterable<string> {
  if (!stream) return

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Emit any remaining content
        if (buffer) {
          yield buffer
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Split on newlines and emit complete lines
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (line) {
          yield line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Spawn a service process
 */
export function spawnService(config: NormalizedService): SpawnResult {
  const args = parseCommand(config.cmd)

  const proc = spawn({
    cmd: args,
    cwd: config.cwd,
    env: {
      ...process.env,
      ...config.env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    process: proc,
    stdoutReader: readLines(proc.stdout, config.name, "stdout"),
    stderrReader: readLines(proc.stderr, config.name, "stderr"),
  }
}

/**
 * Process stdout/stderr streams and emit log lines
 */
export async function processStreams(
  result: SpawnResult,
  serviceName: string,
  onLog: (line: LogLine) => void,
): Promise<void> {
  const processStream = async (reader: AsyncIterable<string>, stream: "stdout" | "stderr") => {
    for await (const content of reader) {
      onLog({
        timestamp: new Date(),
        service: serviceName,
        content,
        stream,
      })
    }
  }

  await Promise.all([processStream(result.stdoutReader, "stdout"), processStream(result.stderrReader, "stderr")])
}

/**
 * Send a signal to a process and wait for it to exit
 */
export async function stopProcess(
  proc: Subprocess,
  signal: NodeJS.Signals = "SIGTERM",
  timeoutMs: number = 10000,
): Promise<number | null> {
  // Check if already exited
  if (proc.exitCode !== null) {
    return proc.exitCode
  }

  // Send the signal
  proc.kill(signal === "SIGTERM" ? 15 : signal === "SIGKILL" ? 9 : 15)

  // Wait for exit with timeout
  const exitPromise = proc.exited

  const timeoutPromise = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs))

  const result = await Promise.race([exitPromise, timeoutPromise])

  if (result === "timeout") {
    // Force kill if timeout
    proc.kill(9) // SIGKILL
    return await proc.exited
  }

  return result
}
