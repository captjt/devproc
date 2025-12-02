---
title: Configuration Reference
description: Complete reference for devproc.yaml options
---

Complete reference for all configuration options in `devproc.yaml`.

## Top-Level Options

```yaml
name: string # Required - Project name
env: object # Optional - Global environment variables
dotenv: string # Optional - Path to .env file
compose: string # Optional - Path to docker-compose.yml
groups: object # Optional - Service group definitions
services: object # Required - Service definitions
```

### `name`

**Type:** `string`
**Required:** Yes

Project name displayed in the DevProc header.

### `env`

**Type:** `Record<string, string>`
**Required:** No

Global environment variables applied to all services.

```yaml
env:
  NODE_ENV: development
  LOG_LEVEL: debug
```

### `dotenv`

**Type:** `string`
**Required:** No

Path to a `.env` file to load. Variables are merged with `env` (dotenv takes precedence).

```yaml
dotenv: .env.local
```

### `compose`

**Type:** `string`
**Required:** No

Path to Docker Compose file for `compose` services.

```yaml
compose: docker-compose.yml
```

### `groups`

**Type:** `Record<string, string[]>`
**Required:** No

Service groups for UI organization.

```yaml
groups:
  backend:
    - api
    - worker
  frontend:
    - web
```

### `services`

**Type:** `Record<string, ServiceConfig>`
**Required:** Yes

Service definitions. At least one service is required.

## Service Options

```yaml
services:
  my-service:
    cmd: string # Required (unless compose is set)
    cwd: string # Optional - Working directory
    env: object # Optional - Environment variables
    depends_on: array|object # Optional - Dependencies
    healthcheck: string|object # Optional - Health check
    restart: string # Optional - Restart policy
    stop_signal: string # Optional - Stop signal
    color: string # Optional - Log color
    compose: boolean|string # Optional - Docker Compose service
    group: string # Optional - Group assignment
```

### `cmd`

**Type:** `string`
**Required:** Yes (unless `compose` is set)

Command to execute. Parsed as shell command.

```yaml
cmd: npm run dev
cmd: go run ./cmd/server -port 8080
cmd: docker run --rm -p 5432:5432 postgres:16
```

### `cwd`

**Type:** `string`
**Required:** No
**Default:** Config file directory

Working directory for the command.

```yaml
cwd: ./services/api
cwd: /absolute/path/to/service
```

### `env`

**Type:** `Record<string, string>`
**Required:** No

Service-specific environment variables. Merged with global env (service takes precedence).

```yaml
env:
  PORT: "3000"
  DATABASE_URL: postgres://localhost/myapp
```

### `depends_on`

**Type:** `string[]` or `Record<string, "started" | "healthy">`
**Required:** No

Service dependencies.

```yaml
# Simple form - wait for process start
depends_on:
  - postgres
  - redis

# Object form - wait for specific state
depends_on:
  postgres: healthy
  redis: started
```

### `healthcheck`

**Type:** `string` or `HealthcheckConfig`
**Required:** No

Health check configuration.

```yaml
# Simple form
healthcheck: curl -f http://localhost:3000/health

# Full form
healthcheck:
  cmd: curl -f http://localhost:3000/health
  interval: 2s
  timeout: 5s
  retries: 30
```

#### HealthcheckConfig

| Field      | Type     | Default  | Description                   |
| ---------- | -------- | -------- | ----------------------------- |
| `cmd`      | `string` | Required | Command to run                |
| `interval` | `string` | `"2s"`   | Time between checks           |
| `timeout`  | `string` | `"5s"`   | Command timeout               |
| `retries`  | `number` | `10`     | Max failures before unhealthy |

### `restart`

**Type:** `"no" | "on-failure" | "always"`
**Required:** No
**Default:** `"no"`

Restart policy when process exits.

| Value        | Behavior                 |
| ------------ | ------------------------ |
| `no`         | Never restart            |
| `on-failure` | Restart if exit code ≠ 0 |
| `always`     | Always restart           |

### `stop_signal`

**Type:** `string`
**Required:** No
**Default:** `"SIGTERM"`

Signal to send when stopping the service.

```yaml
stop_signal: SIGTERM
stop_signal: SIGINT
stop_signal: SIGKILL
```

### `color`

**Type:** `"red" | "green" | "yellow" | "blue" | "magenta" | "cyan"`
**Required:** No

Log color in "all services" view.

### `compose`

**Type:** `boolean | string`
**Required:** No

Docker Compose integration.

```yaml
compose: true       # Use service name
compose: pg         # Use different compose service name
```

### `group`

**Type:** `string`
**Required:** No

Assign service to a group.

```yaml
group: backend
```

## Duration Format

Duration strings support these formats:

| Format | Example | Meaning        |
| ------ | ------- | -------------- |
| `Ns`   | `2s`    | N seconds      |
| `Nms`  | `500ms` | N milliseconds |
| `Nm`   | `1m`    | N minutes      |

## Complete Example

```yaml
name: my-fullstack-app

env:
  NODE_ENV: development
  LOG_LEVEL: debug

dotenv: .env.local

compose: docker-compose.yml

groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api
    - worker
  frontend:
    - web

services:
  postgres:
    compose: true
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      timeout: 5s
      retries: 30

  redis:
    compose: true
    healthcheck:
      cmd: redis-cli ping
      interval: 1s
      retries: 30

  api:
    cmd: air
    cwd: ./services/api
    depends_on:
      postgres: healthy
      redis: healthy
    env:
      PORT: "8080"
      DATABASE_URL: postgres://postgres:dev@localhost:5432/myapp
    healthcheck:
      cmd: curl -f http://localhost:8080/health
      interval: 2s
      retries: 30
    color: green

  worker:
    cmd: go run ./cmd/worker
    cwd: ./services/api
    depends_on:
      - api
    restart: on-failure
    env:
      REDIS_URL: redis://localhost:6379
    color: yellow

  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on:
      - api
    env:
      VITE_API_URL: http://localhost:8080
    color: cyan
```

## Validation

Validate your configuration:

```bash
devproc validate
```

Common validation errors:

| Error                                         | Cause                                             |
| --------------------------------------------- | ------------------------------------------------- |
| `Missing required field: name`                | No project name                                   |
| `Missing required field: services`            | No services defined                               |
| `Unknown service in depends_on`               | Dependency doesn't exist                          |
| `Circular dependency detected`                | A → B → A                                         |
| `healthcheck required for healthy dependency` | `depends_on: x: healthy` but x has no healthcheck |
