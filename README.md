<p align="center">
  <img src="./assets/devproc_logo.png" alt="DevProc Logo" width="400">
</p>

<p align="center">
  <strong>A terminal UI application for managing your local development environment</strong><br>
  Hot reload servers, Docker containers, and background workers in one unified interface.
</p>

<p align="center">
  <a href="https://github.com/captjt/devproc/releases"><img src="https://img.shields.io/github/v/release/captjt/devproc" alt="Release"></a>
  <a href="https://github.com/captjt/devproc/blob/main/LICENSE"><img src="https://img.shields.io/github/license/captjt/devproc" alt="License"></a>
  <a href="https://github.com/captjt/devproc/stargazers"><img src="https://img.shields.io/github/stars/captjt/devproc" alt="Stars"></a>
</p>

---

![DevProc Demo](./assets/demo.gif)

## Features

- **Unified Process Management** - Start, stop, and restart multiple services from a single TUI
- **Service Groups** - Organize services into collapsible groups for better organization
- **Dependency Ordering** - Services start in the correct order based on dependencies
- **Health Checks** - Wait for services to be healthy before starting dependents
- **Live Log Streaming** - View logs from all services or focus on one with scrollback
- **Log Search** - Search and filter logs with regex support and match highlighting
- **Log Export** - Export logs to files for debugging or sharing
- **Service Details** - View detailed service info including PID, env vars, and uptime
- **Resource Monitoring** - Real-time CPU and memory usage per service with sparkline graphs
- **Hot Config Reload** - Update your config without restarting DevProc
- **Keyboard-Driven** - Fast navigation with vim-style keybindings

## Installation

### Homebrew (macOS/Linux)

```bash
# To be remaned soon!
brew tap captjt/devproc https://github.com/captjt/devproc
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

# Optional: organize services into groups
groups:
  backend:
    - api
    - worker
  frontend:
    - web

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

# Organize services into groups (optional)
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

### Docker Compose Integration

DevProc can manage Docker Compose services alongside native services, giving you unified control over your entire development stack.

```yaml
name: my-project

# Path to docker-compose file (default: docker-compose.yml)
compose: docker-compose.yml

groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api

services:
  # Docker Compose services - just add compose: true
  postgres:
    compose: true # Uses service name from devproc
    # Optional: custom healthcheck (default checks if container is running)
    healthcheck:
      cmd: pg_isready -h localhost -p 5432

  redis:
    compose: redis # Or specify a different compose service name

  # Native services work alongside compose services
  api:
    cmd: npm run dev
    depends_on:
      postgres: healthy
      redis: healthy
```

The `compose` option can be:

- `true` - Use the devproc service name as the compose service name
- `string` - Specify a different compose service name

DevProc will:

- Start compose services with `docker compose up <service>`
- Stop them with `docker compose stop <service>`
- Stream logs from the container
- Auto-generate healthchecks to verify the container is running

Compose services are indicated with a ⬡ symbol in the UI.

### Service Options

| Option        | Type          | Description                                                    |
| ------------- | ------------- | -------------------------------------------------------------- |
| `cmd`         | string        | Command to run (required unless `compose` is set)              |
| `compose`     | bool/string   | Docker Compose service (true or service name)                  |
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

### Service Groups

Groups let you organize related services together in the UI. Services in a group are displayed under a collapsible header showing the group name and running count.

```yaml
groups:
  backend:
    - api
    - worker
  frontend:
    - web
    - storybook
```

- Groups appear in the order they're defined in the config
- Services not in any group appear at the bottom
- Press `Space` to collapse/expand a group when a service in that group is selected

## Keyboard Shortcuts

### Services

| Key            | Action                   |
| -------------- | ------------------------ |
| `↑/↓` or `j/k` | Navigate services        |
| `s`            | Start selected service   |
| `x`            | Stop selected service    |
| `r`            | Restart selected service |
| `a`            | Start all services       |
| `X` (shift)    | Stop all services        |
| `R` (shift)    | Restart all services     |
| `Space`        | Toggle group collapsed   |
| `i`            | Show service details     |

### Logs

| Key             | Action                       |
| --------------- | ---------------------------- |
| `Tab`           | Toggle single/all logs view  |
| `c`             | Clear logs                   |
| `f`             | Toggle follow mode           |
| `m`             | Toggle resource monitor view |
| `g` / `G`       | Scroll to top / bottom       |
| `PgUp` / `PgDn` | Page up / down               |
| `Ctrl+u/d`      | Half page up / down          |
| `e`             | Export current service logs  |
| `E` (shift)     | Export all logs              |
| `y`             | Copy last log to clipboard   |
| `Y` (shift)     | Copy all visible logs        |

### Search

| Key   | Action                        |
| ----- | ----------------------------- |
| `/`   | Start search (supports regex) |
| `n`   | Jump to next match            |
| `N`   | Jump to previous match        |
| `Esc` | Clear search                  |

### Config

| Key      | Action                  |
| -------- | ----------------------- |
| `Ctrl+L` | Reload config from disk |

### General

| Key | Action                    |
| --- | ------------------------- |
| `?` | Show help                 |
| `q` | Quit (stops all services) |

## CLI Options

```bash
devproc [options] [command]

Commands:
  up                    Start all services (default)
  down                  Stop all services
  restart               Restart all services
  status                Show service status
  init                  Create a new devproc.yaml config file
  validate              Validate the config file without starting services
  completions <shell>   Generate shell completions (bash, zsh, fish)

Options:
  -c, --config  Path to config file (default: devproc.yaml)
  -w, --watch   Watch config file and auto-reload on changes
  -h, --help    Show help
  -v, --version Show version
```

### Quick Start with `init`

```bash
# Create a new config file in the current directory
devproc init

# Validate your config before running
devproc validate
```

The `init` command will:

- Detect your project name from `package.json` if present
- Suggest services based on npm scripts (dev, start, etc.)
- Create a commented template with examples

### Config Reload

DevProc supports hot-reloading your configuration without restarting:

- **Manual reload**: Press `Ctrl+L` to reload the config file
- **Auto reload**: Run with `-w` flag to watch for file changes

When config is reloaded:

- New services are added (in stopped state)
- Removed services are stopped and removed
- Modified services are restarted with the new configuration

### Shell Completions

**Homebrew users**: Completions are installed automatically! Just ensure your shell is configured to load Homebrew completions.

**Manual installation**: Enable tab completion for commands and options:

```bash
# Bash (add to ~/.bashrc)
eval "$(devproc completions bash)"

# Zsh (add to ~/.zshrc)
eval "$(devproc completions zsh)"

# Fish (add to ~/.config/fish/config.fish)
devproc completions fish | source
```

Or save to a file for faster shell startup:

```bash
# Bash
devproc completions bash > /usr/local/etc/bash_completion.d/devproc

# Zsh (ensure ~/.zsh/completions is in your fpath)
devproc completions zsh > ~/.zsh/completions/_devproc

# Fish
devproc completions fish > ~/.config/fish/completions/devproc.fish
```

## Requirements

- [Bun](https://bun.sh) >= 1.0

---

<p align="center">
  <img src="./assets/bobby.png" alt="Bobby - DevProc Mascot">
</p>

<p align="center">
  <em>Meet Bobby, the DevProc mascot. He keeps your processes running smoothly.</em>
</p>

## License

MIT
