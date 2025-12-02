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

// Docker Compose service configuration
// Can be: true (use service name), or string (custom compose service name)
export const ComposeSchema = z.union([z.literal(true), z.string()])

// Service configuration schema
export const ServiceSchema = z
  .object({
    cmd: z.string().optional(), // Optional when compose is set
    cwd: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    depends_on: DependsOnSchema.optional(),
    healthcheck: z.union([z.string(), HealthcheckSchema]).optional(),
    restart: z.enum(["no", "on-failure", "always"]).default("no"),
    color: z.string().optional(),
    stop_signal: z.string().default("SIGTERM"),
    compose: ComposeSchema.optional(), // Docker Compose integration
  })
  .refine((data) => data.cmd !== undefined || data.compose !== undefined, {
    message: "Either 'cmd' or 'compose' must be specified",
  })

// Group configuration - maps group name to array of service names
export const GroupsSchema = z.record(z.string(), z.array(z.string()))

// Main configuration schema
export const ConfigSchema = z.object({
  name: z.string(),
  env: z.record(z.string(), z.string()).optional(),
  dotenv: z.string().optional(),
  compose: z.string().optional(), // Path to docker-compose file (default: docker-compose.yml)
  groups: GroupsSchema.optional(),
  services: z.record(z.string(), ServiceSchema),
})

// Infer TypeScript types from Zod schemas
export type HealthcheckConfig = z.infer<typeof HealthcheckSchema>
export type DependsOn = z.infer<typeof DependsOnSchema>
export type ServiceConfig = z.infer<typeof ServiceSchema>
export type Groups = z.infer<typeof GroupsSchema>
export type Config = z.infer<typeof ConfigSchema>
