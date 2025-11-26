# DevProc

A terminal UI application for managing your local development environment - hot reload servers, Docker containers, and background workers in one unified interface.

![DevProc Screenshot](https://raw.githubusercontent.com/captjt/devproc/master/screenshot.png)

## Features

- **Unified Process Management** - Start, stop, and restart multiple services from a single TUI
- **Dependency Ordering** - Services start in the correct order based on dependencies
- **Health Checks** - Wait for services to be healthy before starting dependents
- **Live Log Streaming** - View logs from all services or focus on one
- **Keyboard-Driven** - Fast navigation with vim-style keybindings

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap captjt/devproc
brew install devproc
```

### From Source

```bash
# Clone the repository
git clone https://github.com/captjt/devproc.git
cd devproc

# Install dependencies
bun install

# Run
bun run start
```

### Download Binary

Download the latest binary from [GitHub Releases](https://github.com/captjt/devproc/releases).

## Quick Start

1. Create a `devproc.yaml` in your project root:

```yaml
name: my-project

services:
  api:
    cmd: go run ./cmd/api
    healthcheck:
      cmd: curl -f http://localhost:8080/health
      interval: 2s
      retries: 30

  worker:
    cmd: go run ./cmd/worker
    depends_on:
      api: healthy

  web:
    cmd: bun run dev
    cwd: ./frontend
    depends_on:
      - api
```

2. Run DevProc:

```bash
bun run start
# or
./src/index.tsx
```

## Configuration

### Full Example

```yaml
name: my-project

# Global environment variables
env:
  NODE_ENV: development

# Load from .env file
dotenv: .env.local

services:
  postgres:
    cmd: docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
    healthcheck:
      cmd: pg_isready -h localhost -p 5432
      interval: 2s
      timeout: 5s
      retries: 30
    stop_signal: SIGTERM

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
    color: green

  worker:
    cmd: go run ./cmd/worker
    depends_on:
      - api
    restart: on-failure

  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on:
      - api
    color: cyan
```

### Service Options

| Option        | Type          | Description                                                    |
| ------------- | ------------- | -------------------------------------------------------------- |
| `cmd`         | string        | Command to run (required)                                      |
| `cwd`         | string        | Working directory                                              |
| `env`         | object        | Environment variables                                          |
| `depends_on`  | array/object  | Service dependencies                                           |
| `healthcheck` | string/object | Health check configuration                                     |
| `restart`     | string        | Restart policy: `no`, `on-failure`, `always`                   |
| `color`       | string        | Log color: `red`, `green`, `yellow`, `blue`, `magenta`, `cyan` |
| `stop_signal` | string        | Signal to send on stop (default: `SIGTERM`)                    |

### Dependencies

Simple form (wait for process to start):

```yaml
depends_on:
  - postgres
  - redis
```

Object form (wait for healthy):

```yaml
depends_on:
  postgres: healthy
  redis: started
```

### Health Checks

Simple form:

```yaml
healthcheck: curl -f http://localhost:8080/health
```

Full form:

```yaml
healthcheck:
  cmd: pg_isready -h localhost
  interval: 2s
  timeout: 5s
  retries: 30
```

## Keyboard Shortcuts

| Key            | Action                      |
| -------------- | --------------------------- |
| `↑/↓` or `j/k` | Navigate services           |
| `s`            | Start selected service      |
| `x`            | Stop selected service       |
| `r`            | Restart selected service    |
| `a`            | Start all services          |
| `X` (shift)    | Stop all services           |
| `R` (shift)    | Restart all services        |
| `Tab`          | Toggle single/all logs view |
| `c`            | Clear logs                  |
| `f`            | Toggle follow mode          |
| `?`            | Show help                   |
| `q`            | Quit (stops all services)   |

## CLI Options

```bash
devproc [options] [command]

Commands:
  up            Start all services (default)
  down          Stop all services
  restart       Restart all services
  status        Show service status

Options:
  -c, --config  Path to config file (default: devproc.yaml)
  -h, --help    Show help
  -v, --version Show version
```

## Requirements

- [Bun](https://bun.sh) >= 1.0

## License

MIT
