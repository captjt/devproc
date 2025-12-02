---
title: Config File
description: Understanding the devproc.yaml configuration file
---

DevProc uses a YAML configuration file to define your development environment. By default, it looks for `devproc.yaml` in the current directory.

## File Location

DevProc searches for configuration in this order:

1. Path specified with `-c` or `--config` flag
2. `devproc.yaml` in the current directory
3. `devproc.yml` in the current directory

```bash
# Use default location
devproc

# Specify custom config
devproc -c ./configs/dev.yaml
```

## Basic Structure

```yaml
# Project name (displayed in the header)
name: my-project

# Global environment variables (applied to all services)
env:
  NODE_ENV: development
  LOG_LEVEL: debug

# Load additional env vars from a .env file
dotenv: .env.local

# Path to docker-compose file (optional)
compose: docker-compose.yml

# Service groups for organization (optional)
groups:
  backend:
    - api
    - worker
  frontend:
    - web

# Service definitions (required)
services:
  api:
    cmd: npm run dev
    # ... service options
```

## Top-Level Options

### `name`

**Type:** `string`
**Required:** Yes

The project name, displayed in the DevProc header.

```yaml
name: my-awesome-project
```

### `env`

**Type:** `object`
**Required:** No

Global environment variables applied to all services. Service-specific env vars take precedence.

```yaml
env:
  NODE_ENV: development
  API_URL: http://localhost:3000
```

### `dotenv`

**Type:** `string`
**Required:** No

Path to a `.env` file to load. Variables are merged with the `env` block.

```yaml
dotenv: .env.local
```

### `compose`

**Type:** `string`
**Required:** No

Path to a Docker Compose file. Enables the `compose` option on services.

```yaml
compose: docker-compose.yml
# or
compose: ./docker/docker-compose.dev.yml
```

### `groups`

**Type:** `object`
**Required:** No

Define service groups for UI organization. See [Groups](/devproc/configuration/groups/) for details.

```yaml
groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api
    - worker
```

### `services`

**Type:** `object`
**Required:** Yes

Service definitions. See [Services](/devproc/configuration/services/) for all options.

```yaml
services:
  api:
    cmd: npm run dev
  web:
    cmd: npm run dev
    cwd: ./frontend
```

## Generating a Config

Use the `init` command to generate a starter configuration:

```bash
devproc init
```

This will:

- Detect your project name from `package.json`
- Suggest services based on npm scripts
- Create a commented template with examples

## Validating Your Config

Check your configuration for errors before running:

```bash
devproc validate
```

This validates:

- YAML syntax
- Required fields
- Service dependencies exist
- Health check configurations
- Group references

## Hot Reloading

DevProc supports reloading configuration without restarting:

**Manual reload:** Press `Ctrl+L` in the TUI

**Auto reload:** Run with the `-w` flag:

```bash
devproc -w
```

When config is reloaded:

- New services are added (stopped state)
- Removed services are stopped and removed
- Modified services are restarted with new config

## Example Configurations

### Minimal

```yaml
name: simple-api

services:
  api:
    cmd: npm run dev
```

### Full-Stack Project

```yaml
name: fullstack-app

env:
  NODE_ENV: development

dotenv: .env.local

groups:
  database:
    - postgres
  backend:
    - api
  frontend:
    - web

services:
  postgres:
    cmd: docker run --rm -p 5432:5432 postgres:16
    healthcheck:
      cmd: pg_isready -h localhost

  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
    env:
      DATABASE_URL: postgres://localhost/myapp

  web:
    cmd: npm run dev
    cwd: ./frontend
    depends_on:
      - api
```

### With Docker Compose

```yaml
name: compose-project

compose: docker-compose.yml

services:
  postgres:
    compose: true
  redis:
    compose: true
  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: healthy
```
