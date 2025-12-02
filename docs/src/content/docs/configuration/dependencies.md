---
title: Dependencies
description: Managing service startup order with dependencies
---

Dependencies ensure services start in the correct order. DevProc resolves dependencies using topological sorting, so you don't need to worry about the order you define services.

## Simple Dependencies

The simplest form waits for a process to start (not necessarily be ready):

```yaml
services:
  postgres:
    cmd: docker run --rm -p 5432:5432 postgres:16

  api:
    cmd: npm run dev
    depends_on:
      - postgres
```

With this config, DevProc will:

1. Start `postgres`
2. Wait for the process to spawn
3. Start `api`

## Health-Based Dependencies

For more reliable startup, wait for a service to be healthy:

```yaml
services:
  postgres:
    cmd: docker run --rm -p 5432:5432 postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      retries: 30

  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
```

Now DevProc will:

1. Start `postgres`
2. Run the health check repeatedly
3. Once healthy, start `api`

## Dependency Types

### `started`

Wait for the process to spawn. Equivalent to the simple array form.

```yaml
depends_on:
  postgres: started
```

### `healthy`

Wait for the service's health check to pass. Requires a `healthcheck` on the dependency.

```yaml
depends_on:
  postgres: healthy
```

## Mixed Dependencies

You can mix dependency types:

```yaml
services:
  postgres:
    cmd: docker run --rm postgres:16
    healthcheck:
      cmd: pg_isready -h localhost

  redis:
    cmd: docker run --rm redis:7
    # No healthcheck defined

  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy # Wait for healthy
      redis: started # Just wait for start
```

## Complex Dependency Graphs

DevProc handles complex dependency chains:

```yaml
services:
  postgres:
    cmd: docker run postgres:16
    healthcheck:
      cmd: pg_isready

  redis:
    cmd: docker run redis:7
    healthcheck:
      cmd: redis-cli ping

  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: healthy

  worker:
    cmd: npm run worker
    depends_on:
      - api # Inherits api's dependencies transitively

  web:
    cmd: npm run dev
    cwd: ./frontend
    depends_on:
      - api
```

Startup order will be:

1. `postgres` and `redis` (in parallel, no dependencies)
2. `api` (after postgres and redis are healthy)
3. `worker` and `web` (in parallel, after api starts)

## Circular Dependencies

DevProc detects circular dependencies and will fail to start:

```yaml
# This will error!
services:
  a:
    cmd: echo a
    depends_on:
      - b

  b:
    cmd: echo b
    depends_on:
      - a
```

```
Error: Circular dependency detected: a -> b -> a
```

## Stopping Order

When stopping all services, DevProc reverses the dependency order:

1. Services with dependents are stopped last
2. Services with no dependents are stopped first

This ensures graceful shutdown where dependent services stop before their dependencies.

## Starting Individual Services

When you start a service with dependencies, DevProc automatically starts the dependencies first:

```bash
# In the TUI, selecting 'web' and pressing 's' will:
# 1. Start postgres (if not running)
# 2. Wait for postgres health check
# 3. Start api (if not running)
# 4. Start web
```

## Best Practices

### Always Use Health Checks for Databases

```yaml
services:
  postgres:
    cmd: docker run postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      retries: 30
```

### Keep Dependency Chains Short

Avoid deeply nested dependencies when possible. Prefer:

```yaml
# Good: flat structure
api:
  depends_on:
    postgres: healthy
    redis: healthy
```

Over:

```yaml
# Avoid: unnecessary chaining
redis:
  depends_on:
    postgres: healthy
api:
  depends_on:
    redis: healthy
```

### Group Related Services

Use groups to organize services that share dependencies:

```yaml
groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api
    - worker
```
