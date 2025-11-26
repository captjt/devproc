# DevProc - Developer Process Manager

A terminal UI application built with opentui for managing your local development environment - hot reload servers, Docker containers, and background workers in one unified interface.

## Overview

DevProc solves the problem of juggling multiple terminal windows/tabs when developing. Instead of manually starting Vite, Air, Docker containers, and workers in separate terminals, DevProc orchestrates everything from a single interactive TUI.

## Core Concepts

### Services

A service is any long-running process in your dev environment:

- Hot reload dev servers (Vite, Air, cargo-watch, nodemon)
- Docker containers (Postgres, Redis, Elasticsearch)
- Background workers, queue processors
- Any command that runs continuously

### Configuration

Projects define their services in a `devproc.yaml` file at the project root.

### Lifecycle

```
stopped → starting → running → stopping → stopped
              ↓          ↓
           failed     crashed
```

## Configuration Format

```yaml
# devproc.yaml
name: my-project

# Global environment variables (applied to all services)
env:
  NODE_ENV: development

# Optional: load from .env file
dotenv: .env.local

services:
  # Docker-based database
  postgres:
    cmd: docker run --rm --name devproc-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      timeout: 5s
      retries: 30
    stop_signal: SIGTERM

  redis:
    cmd: docker run --rm --name devproc-redis -p 6379:6379 redis:7
    healthcheck:
      cmd: redis-cli ping

  # Go API with Air hot reload
  api:
    cmd: air
    cwd: ./services/api
    depends_on:
      postgres: healthy
      redis: healthy
    env:
      DATABASE_URL: postgres://postgres:dev@localhost:5432/myapp
      REDIS_URL: redis://localhost:6379
    color: green # Log color coding

  # Background worker
  worker:
    cmd: go run ./cmd/worker
    cwd: ./services/api
    depends_on:
      - api # Short form: just wait for process to start
    restart: on-failure

  # Vite frontend
  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on:
      - api
    color: cyan
```

## Architecture

### Directory Structure

```
devproc/
├── src/
│   ├── index.ts              # Entry point, CLI parsing
│   ├── app.tsx               # Main opentui application
│   │
│   ├── config/
│   │   ├── loader.ts         # YAML config parsing
│   │   ├── schema.ts         # Config validation (Zod)
│   │   └── types.ts          # TypeScript types
│   │
│   ├── process/
│   │   ├── manager.ts        # Process lifecycle management
│   │   ├── spawner.ts        # Child process spawning
│   │   ├── healthcheck.ts    # Healthcheck runner
│   │   └── types.ts          # Process state types
│   │
│   ├── ui/
│   │   ├── components/
│   │   │   ├── ServiceList.tsx    # Left panel service list
│   │   │   ├── ServiceRow.tsx     # Individual service row
│   │   │   ├── LogPanel.tsx       # Right panel log viewer
│   │   │   ├── StatusBar.tsx      # Bottom status/help bar
│   │   │   └── HelpModal.tsx      # Keyboard shortcuts help
│   │   ├── hooks/
│   │   │   ├── useServices.ts     # Service state management
│   │   │   ├── useLogs.ts         # Log buffer management
│   │   │   └── useKeyboard.ts     # Keyboard shortcut handling
│   │   └── Layout.tsx             # Main layout composition
│   │
│   └── utils/
│       ├── logger.ts         # Internal logging (to file, not stdout)
│       ├── ansi.ts           # ANSI color parsing for logs
│       └── port.ts           # Port detection utilities
│
├── devproc.yaml              # Example config
├── package.json
└── tsconfig.json
```

### Core Components

#### 1. Process Manager (`process/manager.ts`)

Central orchestrator for all service lifecycles.

```typescript
interface ServiceState {
  name: string
  status: "stopped" | "starting" | "running" | "stopping" | "crashed" | "failed"
  pid?: number
  startedAt?: Date
  exitCode?: number
  port?: number
  error?: string
}

class ProcessManager extends EventEmitter {
  // Start a single service (resolves dependencies first)
  async start(name: string): Promise<void>

  // Start all services in dependency order
  async startAll(): Promise<void>

  // Stop a service gracefully
  async stop(name: string): Promise<void>

  // Stop all services (reverse dependency order)
  async stopAll(): Promise<void>

  // Restart a service
  async restart(name: string): Promise<void>

  // Get current state
  getState(name: string): ServiceState
  getAllStates(): ServiceState[]

  // Events: 'state-change', 'log', 'error'
}
```

#### 2. Log Buffer (`ui/hooks/useLogs.ts`)

Manages log lines per service with configurable buffer size.

```typescript
interface LogLine {
  timestamp: Date
  service: string
  content: string
  stream: "stdout" | "stderr"
}

interface LogBuffer {
  // Add log line
  append(service: string, line: string, stream: "stdout" | "stderr"): void

  // Get logs for a service (most recent N lines)
  get(service: string, limit?: number): LogLine[]

  // Get interleaved logs from all services
  getAll(limit?: number): LogLine[]

  // Clear logs for a service
  clear(service: string): void
}
```

#### 3. UI State Management

```typescript
interface AppState {
  services: ServiceState[]
  selectedService: string | null
  viewMode: "single" | "all" // View one service's logs or all interleaved
  following: boolean // Auto-scroll to new logs
  filter: string // Log search/filter
}
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ DevProc - my-project                                    12:34:56 PM │
├─────────────────────────┬───────────────────────────────────────────┤
│ Services                │ Logs (api)                          [F1]  │
│                         │                                           │
│ ● postgres    :5432  5m │ [12:30:01] Starting server...             │
│ ● redis       :6379  5m │ [12:30:02] Connected to postgres          │
│ ▶ api         :8080  4m │ [12:30:02] Connected to redis             │
│ ● worker             4m │ [12:30:03] Listening on :8080             │
│ ● web         :5173  3m │ [12:34:15] GET /api/users 200 12ms        │
│                         │ [12:34:16] GET /api/posts 200 8ms         │
│                         │ [12:34:20] POST /api/auth 201 45ms        │
│                         │                                           │
│                         │                                           │
│                         │                                           │
├─────────────────────────┴───────────────────────────────────────────┤
│ [s]tart [x]stop [r]estart [a]ll │ [/]filter [c]lear │ [?]help [q]uit│
└─────────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Key            | Action                              |
| -------------- | ----------------------------------- |
| `↑/↓` or `j/k` | Navigate service list               |
| `Enter`        | Select service / view logs          |
| `s`            | Start selected service              |
| `x`            | Stop selected service               |
| `r`            | Restart selected service            |
| `a`            | Start all services                  |
| `X`            | Stop all services                   |
| `R`            | Restart all services                |
| `Tab`          | Switch between single/all logs view |
| `/`            | Filter/search logs                  |
| `c`            | Clear logs for selected service     |
| `f`            | Toggle follow mode (auto-scroll)    |
| `?`            | Show help                           |
| `q`            | Quit (stops all services)           |

## Implementation Plan

### Phase 1: Foundation

1. **Project setup** - Initialize with Bun, TypeScript, opentui dependencies
2. **Config loader** - Parse YAML, validate with Zod
3. **Basic process spawning** - Start/stop child processes, capture stdout/stderr
4. **Simple TUI** - Service list, basic log display

### Phase 2: Core Features

5. **Dependency resolution** - Topological sort, start in correct order
6. **Healthchecks** - Poll healthcheck commands, track healthy state
7. **Log buffer** - Efficient circular buffer, per-service storage
8. **Full TUI** - Split panes, keyboard navigation, status bar

### Phase 3: Polish

9. **Log filtering** - Regex search, log level filtering
10. **Port detection** - Parse output or use lsof to detect ports
11. **Graceful shutdown** - SIGTERM handling, cleanup on exit
12. **Error recovery** - Restart policies, crash detection

### Phase 4: Nice-to-haves

13. **Docker integration** - Native Docker API instead of shell commands
14. **Profile support** - `devproc up --profile backend` for partial stacks
15. **Environment switching** - Dev/staging/local configs
16. **Notifications** - Desktop notifications on crash

## Development Steps

### Step 1: Initialize Project

```bash
mkdir devproc && cd devproc
bun init
bun add @opentui/core @opentui/solid yaml zod
```

Use Solid (from `@opentui/solid`) as it's reactive and works well for this use case.

### Step 2: Config Schema

Start with config types and validation - this defines the contract for everything else.

```typescript
// src/config/schema.ts
import { z } from "zod"

const HealthcheckSchema = z.object({
  cmd: z.string(),
  interval: z.string().default("2s"),
  timeout: z.string().default("5s"),
  retries: z.number().default(10),
})

const ServiceSchema = z.object({
  cmd: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  depends_on: z.union([z.array(z.string()), z.record(z.enum(["started", "healthy"]))]).optional(),
  healthcheck: z.union([z.string(), HealthcheckSchema]).optional(),
  restart: z.enum(["no", "on-failure", "always"]).default("no"),
  color: z.string().optional(),
  stop_signal: z.string().default("SIGTERM"),
})

export const ConfigSchema = z.object({
  name: z.string(),
  env: z.record(z.string()).optional(),
  dotenv: z.string().optional(),
  services: z.record(ServiceSchema),
})
```

### Step 3: Process Spawner

Basic child process management using Bun's spawn API.

```typescript
// src/process/spawner.ts
import { spawn, type Subprocess } from "bun"

export function spawnService(config: ServiceConfig): Subprocess {
  const proc = spawn({
    cmd: config.cmd.split(" "), // TODO: proper shell parsing
    cwd: config.cwd,
    env: { ...process.env, ...config.env },
    stdout: "pipe",
    stderr: "pipe",
  })

  return proc
}
```

### Step 4: Basic UI Shell

Start with the layout structure, then fill in components.

```tsx
// src/app.tsx
import { Box, Text, ScrollBox } from "@opentui/solid"

export function App() {
  return (
    <Box flexDirection="row" width="100%" height="100%">
      {/* Service List */}
      <Box width={30} borderStyle="rounded" borderColor="gray">
        <ServiceList />
      </Box>

      {/* Log Panel */}
      <Box flexGrow={1} borderStyle="rounded" borderColor="gray">
        <LogPanel />
      </Box>
    </Box>
  )
}
```

### Step 5: Wire It Together

Connect process manager events to UI state updates using Solid's reactivity.

## Testing Strategy

1. **Unit tests** - Config parsing, dependency resolution, log buffer
2. **Integration tests** - Process spawning with mock commands (`sleep`, `echo`)
3. **Manual testing** - Real-world configs with actual services

```typescript
// Example test
import { test, expect } from "bun:test"
import { resolveDependencyOrder } from "./process/dependencies"

test("resolves dependency order correctly", () => {
  const services = {
    web: { depends_on: ["api"] },
    api: { depends_on: ["postgres", "redis"] },
    postgres: {},
    redis: {},
  }

  const order = resolveDependencyOrder(services)
  expect(order).toEqual(["postgres", "redis", "api", "web"])
})
```

## Key opentui Components to Use

Based on the opentui packages:

| Component   | Use Case                                |
| ----------- | --------------------------------------- |
| `Box`       | Layout containers, borders, flex layout |
| `Text`      | Service names, log lines, status text   |
| `ScrollBox` | Scrollable log viewer                   |
| `useInput`  | Keyboard event handling                 |
| `useStdout` | Terminal size, raw mode                 |

## References

- [opentui core docs](https://github.com/sst/opentui/tree/main/packages/core/docs)
- [opentui solid examples](https://github.com/sst/opentui/tree/main/packages/solid/examples)
- Similar tools for inspiration: [overmind](https://github.com/DarthSim/overmind), [foreman](https://github.com/ddollar/foreman), [pm2](https://pm2.keymetrics.io/)
