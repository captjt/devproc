---
title: Docker Compose
description: Integrating Docker Compose services with DevProc
---

DevProc can manage Docker Compose services alongside native processes, giving you unified control over your entire development stack.

## Basic Integration

First, specify your Docker Compose file:

```yaml
name: my-project

compose: docker-compose.yml

services:
  postgres:
    compose: true
```

Then in your `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: dev
```

DevProc will use `docker compose up postgres` to start and `docker compose stop postgres` to stop.

## Compose Options

### `compose: true`

Use the DevProc service name as the Docker Compose service name:

```yaml
services:
  postgres:
    compose: true # Matches 'postgres' in docker-compose.yml
```

### `compose: "service-name"`

Specify a different Docker Compose service name:

```yaml
services:
  db:
    compose: postgres # Uses 'postgres' from docker-compose.yml
```

This is useful when you want different names in DevProc vs Docker Compose.

## Mixing Compose and Native Services

```yaml
name: fullstack-app

compose: docker-compose.yml

groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api

services:
  # Docker Compose services
  postgres:
    compose: true
    healthcheck:
      cmd: pg_isready -h localhost -p 5432

  redis:
    compose: true

  # Native services
  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: healthy
```

## Health Checks

### Auto-Generated Health Check

For compose services without a custom healthcheck, DevProc generates one that checks if the container is running:

```yaml
services:
  postgres:
    compose: true
    # Auto-generated healthcheck verifies container is running
```

### Custom Health Check

Override with your own health check:

```yaml
services:
  postgres:
    compose: true
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      retries: 30
```

This is recommended for more reliable dependency ordering.

## How It Works

When you start a compose service:

1. DevProc runs `docker compose -f <file> up -d <service>`
2. Logs are streamed from the container
3. Health checks run against the container

When you stop a compose service:

1. DevProc runs `docker compose -f <file> stop <service>`
2. If timeout, runs `docker compose -f <file> kill <service>`

## UI Indicators

Compose services are marked with a ⬡ symbol in the service list:

```
● postgres    ⬡ :5432  5m
● redis       ⬡ :6379  5m
● api            :8080  4m
```

## Example docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myapp_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  elasticsearch:
    image: elasticsearch:8.11.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

volumes:
  postgres_data:
```

Corresponding DevProc config:

```yaml
name: my-project

compose: docker-compose.yml

groups:
  infrastructure:
    - postgres
    - redis
    - elasticsearch
  backend:
    - api

services:
  postgres:
    compose: true
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      retries: 30

  redis:
    compose: true
    healthcheck:
      cmd: redis-cli ping

  elasticsearch:
    compose: true
    healthcheck:
      cmd: curl -f http://localhost:9200/_cluster/health
      interval: 5s
      retries: 60

  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: healthy
```

## Best Practices

### Use Compose for Stateful Services

Keep databases and caches in Docker Compose for easy data persistence:

```yaml
services:
  postgres:
    compose: true # Data persists in Docker volume

  api:
    cmd: npm run dev # Code reloads on change
```

### Keep Native Services Native

Don't put your application code in Docker Compose during development - you lose hot reload benefits:

```yaml
# Good
api:
  cmd: npm run dev  # Hot reload works

# Avoid during development
api:
  compose: true  # No hot reload
```

### Custom Compose File Location

```yaml
compose: ./docker/docker-compose.dev.yml
```

### Multiple Compose Files

Currently, DevProc supports a single compose file. If you need multiple files, combine them:

```bash
# Merge compose files manually
docker compose -f docker-compose.yml -f docker-compose.dev.yml config > docker-compose.merged.yml
```

Then reference the merged file in DevProc.

## Troubleshooting

### Container Won't Start

Check Docker Compose directly:

```bash
docker compose up postgres
```

### Health Check Failing

Verify the health check command works:

```bash
pg_isready -h localhost -p 5432
```

### Logs Not Streaming

Ensure the container is running:

```bash
docker compose ps
docker compose logs -f postgres
```
