import type { Config, ServiceConfig, HealthcheckConfig, DependsOn, Groups } from "./schema"

// Re-export types from schema
export type { Config, ServiceConfig, HealthcheckConfig, DependsOn, Groups }

// Normalized healthcheck config (after parsing shorthand)
export interface NormalizedHealthcheck {
  cmd: string
  intervalMs: number
  timeoutMs: number
  retries: number
}

// Normalized service config (after processing)
export interface NormalizedService {
  name: string
  cmd: string
  cwd: string
  env: Record<string, string>
  dependsOn: Map<string, "started" | "healthy">
  healthcheck?: NormalizedHealthcheck
  restart: "no" | "on-failure" | "always"
  color?: string
  stopSignal: NodeJS.Signals
  group?: string // Group this service belongs to (if any)
}

// Group definition
export interface ServiceGroup {
  name: string
  services: string[]
  collapsed: boolean // UI state
}

// Full normalized config
export interface NormalizedConfig {
  name: string
  env: Record<string, string>
  services: Map<string, NormalizedService>
  groups: Map<string, ServiceGroup>
  configPath: string // Store path for reload functionality
}

// Utility to parse duration strings like "2s", "500ms", "1m"
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)$/)
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`)
  }

  const value = parseInt(match[1]!, 10)
  const unit = match[2]!

  switch (unit) {
    case "ms":
      return value
    case "s":
      return value * 1000
    case "m":
      return value * 60 * 1000
    case "h":
      return value * 60 * 60 * 1000
    default:
      throw new Error(`Unknown duration unit: ${unit}`)
  }
}
