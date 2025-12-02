---
title: Services
description: Configuring individual services in DevProc
---

Services are the core of DevProc. Each service represents a long-running process in your development environment.

## Basic Service

A minimal service needs only a command:

```yaml
services:
  api:
    cmd: npm run dev
```

## Service Options

### `cmd`

**Type:** `string`
**Required:** Yes (unless `compose` is set)

The command to run. Can be a simple command or a complex shell command.

```yaml
services:
  api:
    cmd: npm run dev

  build:
    cmd: npm run build -- --watch

  server:
    cmd: go run ./cmd/server -port 8080
```

### `cwd`

**Type:** `string`
**Required:** No
**Default:** Current directory

Working directory for the command. Relative paths are resolved from the config file location.

```yaml
services:
  frontend:
    cmd: npm run dev
    cwd: ./apps/web

  api:
    cmd: air
    cwd: ./services/api
```

### `env`

**Type:** `object`
**Required:** No

Environment variables for this service. Merged with global env vars (service takes precedence).

```yaml
services:
  api:
    cmd: npm run dev
    env:
      PORT: "3000"
      DATABASE_URL: postgres://localhost/myapp
      DEBUG: "api:*"
```

### `depends_on`

**Type:** `array` or `object`
**Required:** No

Service dependencies. See [Dependencies](/devproc/configuration/dependencies/) for details.

```yaml
services:
  # Simple form - wait for process to start
  worker:
    cmd: npm run worker
    depends_on:
      - api

  # Object form - wait for healthy status
  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: started
```

### `healthcheck`

**Type:** `string` or `object`
**Required:** No

Health check configuration. See [Health Checks](/devproc/configuration/health-checks/) for details.

```yaml
services:
  api:
    cmd: npm run dev
    healthcheck:
      cmd: curl -f http://localhost:3000/health
      interval: 2s
      timeout: 5s
      retries: 30
```

### `restart`

**Type:** `string`
**Required:** No
**Default:** `"no"`
**Options:** `"no"`, `"on-failure"`, `"always"`

Restart policy when the process exits.

```yaml
services:
  # Never restart (default)
  api:
    cmd: npm run dev
    restart: "no"

  # Restart only if exit code is non-zero
  worker:
    cmd: npm run worker
    restart: on-failure

  # Always restart (useful for flaky services)
  watcher:
    cmd: npm run watch
    restart: always
```

### `stop_signal`

**Type:** `string`
**Required:** No
**Default:** `"SIGTERM"`

Signal to send when stopping the service.

```yaml
services:
  api:
    cmd: npm run dev
    stop_signal: SIGTERM

  legacy-app:
    cmd: ./run.sh
    stop_signal: SIGINT
```

### `color`

**Type:** `string`
**Required:** No
**Options:** `"red"`, `"green"`, `"yellow"`, `"blue"`, `"magenta"`, `"cyan"`

Color for log output when viewing all services.

```yaml
services:
  api:
    cmd: npm run dev
    color: green

  web:
    cmd: npm run dev
    color: cyan
```

### `compose`

**Type:** `boolean` or `string`
**Required:** No

Use Docker Compose to manage this service. See [Docker Compose](/devproc/configuration/docker-compose/) for details.

```yaml
services:
  postgres:
    compose: true # Use service name

  redis:
    compose: my-redis # Use different compose service name
```

### `group`

**Type:** `string`
**Required:** No

Assign this service to a group. Alternative to defining groups at the top level.

```yaml
services:
  api:
    cmd: npm run dev
    group: backend

  web:
    cmd: npm run dev
    group: frontend
```

## Service Lifecycle

Services go through these states:

```
stopped → starting → running → stopping → stopped
              ↓          ↓
           failed     crashed
```

- **stopped** - Not running
- **starting** - Process spawned, waiting for health check (if configured)
- **running** - Process running (no health check) or health check not yet passing
- **healthy** - Process running and health check passing
- **stopping** - Shutdown signal sent, waiting for exit
- **crashed** - Process exited unexpectedly (may restart based on policy)
- **failed** - Failed to start or health check never passed

## Examples

### Web Server with Hot Reload

```yaml
services:
  api:
    cmd: air
    cwd: ./backend
    env:
      PORT: "8080"
      GIN_MODE: debug
    healthcheck:
      cmd: curl -f http://localhost:8080/health
      interval: 2s
      retries: 30
```

### Background Worker

```yaml
services:
  worker:
    cmd: npm run worker
    depends_on:
      api: healthy
    restart: on-failure
    env:
      REDIS_URL: redis://localhost:6379
```

### Docker Container

```yaml
services:
  postgres:
    cmd: docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
    stop_signal: SIGTERM
```

### Frontend Dev Server

```yaml
services:
  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on:
      - api
    color: cyan
```
