import { z } from "zod"

// Healthcheck configuration schema
export const HealthcheckSchema = z.object({
  cmd: z.string(),
  interval: z.string().default("2s"),
  timeout: z.string().default("5s"),
  retries: z.number().default(10),
})

// Dependency configuration - either simple string array or object with conditions
export const DependsOnSchema = z.union([z.array(z.string()), z.record(z.string(), z.enum(["started", "healthy"]))])

// Service configuration schema
export const ServiceSchema = z.object({
  cmd: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  depends_on: DependsOnSchema.optional(),
  healthcheck: z.union([z.string(), HealthcheckSchema]).optional(),
  restart: z.enum(["no", "on-failure", "always"]).default("no"),
  color: z.string().optional(),
  stop_signal: z.string().default("SIGTERM"),
})

// Group configuration - maps group name to array of service names
export const GroupsSchema = z.record(z.string(), z.array(z.string()))

// Main configuration schema
export const ConfigSchema = z.object({
  name: z.string(),
  env: z.record(z.string(), z.string()).optional(),
  dotenv: z.string().optional(),
  groups: GroupsSchema.optional(),
  services: z.record(z.string(), ServiceSchema),
})

// Infer TypeScript types from Zod schemas
export type HealthcheckConfig = z.infer<typeof HealthcheckSchema>
export type DependsOn = z.infer<typeof DependsOnSchema>
export type ServiceConfig = z.infer<typeof ServiceSchema>
export type Groups = z.infer<typeof GroupsSchema>
export type Config = z.infer<typeof ConfigSchema>
