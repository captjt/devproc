---
title: Health Checks
description: Configuring health checks for service readiness
---

Health checks verify that a service is ready to accept connections. They're essential for reliable dependency ordering.

## Simple Health Check

The simplest form is a command string:

```yaml
services:
  api:
    cmd: npm run dev
    healthcheck: curl -f http://localhost:3000/health
```

## Full Health Check Configuration

For more control, use the object form:

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

## Options

### `cmd`

**Type:** `string`
**Required:** Yes

The command to run. Exit code 0 = healthy, non-zero = unhealthy.

```yaml
healthcheck:
  cmd: curl -f http://localhost:3000/health
```

### `interval`

**Type:** `string`
**Required:** No
**Default:** `"2s"`

Time between health check attempts.

```yaml
healthcheck:
  cmd: pg_isready
  interval: 1s # Check every second
```

### `timeout`

**Type:** `string`
**Required:** No
**Default:** `"5s"`

Maximum time to wait for the health check command to complete.

```yaml
healthcheck:
  cmd: curl http://localhost:3000/health
  timeout: 10s # Allow slow responses
```

### `retries`

**Type:** `number`
**Required:** No
**Default:** `10`

Number of consecutive failures before marking the service as unhealthy.

```yaml
healthcheck:
  cmd: pg_isready
  retries: 30 # Try for ~60 seconds with 2s interval
```

## Common Health Check Patterns

### HTTP Endpoint

```yaml
healthcheck:
  cmd: curl -f http://localhost:3000/health
  interval: 2s
  retries: 30
```

The `-f` flag makes curl return a non-zero exit code on HTTP errors.

### PostgreSQL

```yaml
healthcheck:
  cmd: pg_isready -h localhost -p 5432
  interval: 2s
  retries: 30
```

Or with authentication:

```yaml
healthcheck:
  cmd: pg_isready -h localhost -p 5432 -U postgres
```

### Redis

```yaml
healthcheck:
  cmd: redis-cli ping
  interval: 1s
  retries: 30
```

Or with custom port:

```yaml
healthcheck:
  cmd: redis-cli -p 6380 ping
```

### MySQL

```yaml
healthcheck:
  cmd: mysqladmin ping -h localhost -u root
  interval: 2s
  retries: 30
```

### MongoDB

```yaml
healthcheck:
  cmd: mongosh --eval "db.adminCommand('ping')"
  interval: 2s
  retries: 30
```

### Elasticsearch

```yaml
healthcheck:
  cmd: curl -f http://localhost:9200/_cluster/health
  interval: 5s
  retries: 60
```

### TCP Port Check

For services without specific health check tools:

```yaml
healthcheck:
  cmd: nc -z localhost 8080
  interval: 1s
  retries: 30
```

### gRPC Service

```yaml
healthcheck:
  cmd: grpc_health_probe -addr=localhost:50051
  interval: 2s
  retries: 30
```

## Health Check States

A service goes through these health-related states:

1. **starting** - Process spawned, health check running
2. **running** - Process running, health check not configured or not yet passed
3. **healthy** - Health check passing
4. **failed** - Health check never passed after all retries

## Without Health Checks

If no health check is configured, the service transitions directly to `running` once the process spawns. Dependent services will start immediately.

```yaml
services:
  # No healthcheck - considered "started" immediately
  worker:
    cmd: npm run worker

  # Depends on worker being started (not healthy)
  monitor:
    cmd: npm run monitor
    depends_on:
      - worker # Starts as soon as worker process spawns
```

## Docker Compose Services

For Docker Compose services, DevProc auto-generates a health check that verifies the container is running:

```yaml
services:
  postgres:
    compose: true
    # Auto-generated: docker compose ps postgres --format json
```

You can override with a custom health check:

```yaml
services:
  postgres:
    compose: true
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
```

## Best Practices

### Set Appropriate Retries

Calculate retries based on how long the service takes to start:

```yaml
# If postgres takes ~30 seconds to be ready
healthcheck:
  cmd: pg_isready
  interval: 2s
  retries: 20 # 2s × 20 = 40 seconds max wait
```

### Use Dedicated Health Endpoints

Create lightweight health endpoints in your services:

```javascript
// Express example
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})
```

### Check What Matters

For databases, check connectivity. For APIs, check the health endpoint, not an actual endpoint that does work:

```yaml
# Good - lightweight check
healthcheck:
  cmd: curl -f http://localhost:3000/health

# Avoid - may be slow or have side effects
healthcheck:
  cmd: curl -f http://localhost:3000/api/users
```

### Handle Slow Starts

Some services (Elasticsearch, Java apps) take longer to start:

```yaml
services:
  elasticsearch:
    cmd: docker run elasticsearch:8
    healthcheck:
      cmd: curl -f http://localhost:9200
      interval: 5s
      timeout: 10s
      retries: 60 # Wait up to 5 minutes
```
