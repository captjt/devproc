---
title: Quick Start
description: Get up and running with DevProc in 5 minutes
---

This guide will help you create your first DevProc configuration and start managing your development services.

## Create a Config File

DevProc looks for a `devproc.yaml` file in your project root. You can create one manually or use the init command:

```bash
devproc init
```

This creates a starter config with examples. Let's look at a simple example:

```yaml
name: my-project

services:
  api:
    cmd: npm run dev
    healthcheck:
      cmd: curl -f http://localhost:3000/health
      interval: 2s
      retries: 30

  web:
    cmd: npm run dev
    cwd: ./frontend
    depends_on:
      - api
```

This config defines:

- An **api** service with a health check
- A **web** service that depends on the api

## Validate Your Config

Before running, you can validate your configuration:

```bash
devproc validate
```

This checks for syntax errors, missing dependencies, and other issues.

## Start DevProc

Run DevProc from your project directory:

```bash
devproc
```

Or explicitly:

```bash
devproc up
```

You'll see the TUI interface with your services listed on the left and logs on the right.

## Basic Navigation

| Key            | Action                      |
| -------------- | --------------------------- |
| `↑/↓` or `j/k` | Navigate services           |
| `s`            | Start selected service      |
| `x`            | Stop selected service       |
| `r`            | Restart selected service    |
| `a`            | Start all services          |
| `Tab`          | Toggle single/all logs view |
| `?`            | Show help                   |
| `q`            | Quit (stops all services)   |

## A More Complete Example

Here's a more realistic configuration:

```yaml
name: my-fullstack-app

# Global environment variables
env:
  NODE_ENV: development

# Load additional env from file
dotenv: .env.local

# Organize services into groups
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
    cmd: docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      retries: 30

  redis:
    cmd: docker run --rm -p 6379:6379 redis:7
    healthcheck:
      cmd: redis-cli ping

  api:
    cmd: air
    cwd: ./services/api
    depends_on:
      postgres: healthy
      redis: healthy
    env:
      DATABASE_URL: postgres://postgres:dev@localhost:5432/myapp

  worker:
    cmd: go run ./cmd/worker
    cwd: ./services/api
    depends_on:
      - api
    restart: on-failure

  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on:
      - api
```

## Using Docker Compose

If you already have a `docker-compose.yml`, you can integrate it with DevProc:

```yaml
name: my-project

# Path to your docker-compose file
compose: docker-compose.yml

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

DevProc will use `docker compose up/stop` for compose services while managing native services directly.

## Next Steps

- [Configuration](/devproc/configuration/config-file/) - Learn all configuration options
- [Keyboard Shortcuts](/devproc/usage/keyboard-shortcuts/) - Master the TUI
- [Docker Compose](/devproc/configuration/docker-compose/) - Deep dive into Docker integration
