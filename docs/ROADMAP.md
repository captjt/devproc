# DevProc Roadmap

This document outlines planned features and improvements for DevProc, organized by priority and complexity.

## Current State (v0.5.x)

- [x] Service management (start, stop, restart)
- [x] Dependency ordering with healthchecks
- [x] Service groups with collapsible UI
- [x] Live log streaming with scrollback
- [x] Hot config reload (manual + file watcher)
- [x] Vim-style keyboard navigation
- [x] Log search with regex support and highlighting
- [x] Log export (plain text and JSON)
- [x] Service details panel
- [x] Animated spinners for starting/stopping
- [x] Restart count badges
- [x] Resource monitoring (CPU/memory per service)

---

## Completed (v0.4.x)

### Log Search & Filtering

- [x] `/` to open search prompt
- [x] `n`/`N` to navigate matches (next/previous)
- [x] Highlight matching text in log view
- [x] Regex support for advanced filtering
- [x] Current match highlighted differently

### Log Export

- [x] `e` to export current service logs to file
- [x] `E` to export all logs
- [x] Plain text format with timestamps
- [x] JSON format support
- [x] Auto-generate filename with timestamp

### Service Details Panel

- [x] Toggle with `i` (info) key
- [x] Display: PID, uptime, restart count, exit codes
- [x] Show environment variables (with sensitive value masking)
- [x] Show the actual command being run
- [x] Show working directory and group

### Improved Status Indicators

- [x] Animated spinner for `starting`/`stopping` states
- [x] Show restart count badge if > 0

---

## Completed (v0.5.x)

### Resource Monitoring

- [x] Real-time CPU % and memory usage in service list
- [x] Resource graph in log panel (toggle with `m`)
- [x] History tracking with sparkline visualization
- [x] Color-coded CPU (green/yellow/red based on usage)
- [x] Implementation: Uses `ps` command on macOS/Linux

---

## Medium Term (v0.6.x)

### Notifications

**Priority: High | Complexity: Medium**

Desktop notifications for important events.

- Notify on service crash
- Notify when service becomes healthy
- Notify on healthcheck failures
- Configurable per-service notification settings
- Implementation options:
  - macOS: `osascript` or `terminal-notifier`
  - Linux: `notify-send`
  - Cross-platform: Node `node-notifier`

### Profiles

**Priority: Medium | Complexity: Medium**

Run subsets of services for different scenarios.

```yaml
profiles:
  backend:
    - api
    - worker
    - postgres
  frontend:
    - web
  minimal:
    - api
    - postgres
# CLI: devproc up --profile backend
```

- `devproc up --profile <name>` to start only those services
- Multiple profiles: `--profile backend --profile frontend`
- Default profile if none specified
- UI indicator showing active profile

### Environment Switching

**Priority: Medium | Complexity: Medium**

Support multiple environment configurations.

```yaml
environments:
  development:
    env:
      DATABASE_URL: postgres://localhost/dev
  staging:
    env:
      DATABASE_URL: postgres://staging.example.com/app
    dotenv: .env.staging
```

- `devproc up --env staging`
- Visual indicator of current environment
- Environment-specific service overrides

### Custom Commands

**Priority: Medium | Complexity: Medium**

Define and run custom commands on services.

```yaml
services:
  api:
    cmd: air
    commands:
      migrate: go run ./cmd/migrate
      seed: go run ./cmd/seed
      shell: go run ./cmd/repl
```

- `:` to open command prompt
- Tab completion for available commands
- Run command in new pane or overlay
- Capture output in logs

---

## Long Term (v1.0+)

### Native Docker Integration

**Priority: High | Complexity: High**

Use Docker API directly instead of shell commands.

- Automatic container cleanup on exit
- Pull images if not present
- Show container logs directly
- Health status from Docker healthchecks
- Volume and network management
- Docker Compose file import

### Kubernetes Support

**Priority: Medium | Complexity: Very High**

Manage local Kubernetes services (minikube, kind, k3s).

- Port-forward services automatically
- Show pod status and logs
- Restart deployments
- Scale replicas from UI

### Remote Services

**Priority: Low | Complexity: High**

Connect to services running on remote machines.

- SSH tunnel for log streaming
- Remote process management
- Useful for debugging staging environments

### Plugin System

**Priority: Low | Complexity: Very High**

Allow extending DevProc with custom functionality.

- Lifecycle hooks (before/after start, on crash, etc.)
- Custom UI panels
- Custom commands
- Service type plugins (Docker, K8s, systemd)

### Web Dashboard

**Priority: Low | Complexity: High**

Optional web UI for remote access.

- View logs from browser
- Start/stop services remotely
- Mobile-friendly for on-the-go monitoring
- Share dashboard URL with team

---

## Quality of Life Improvements

### Configuration

- [ ] JSON schema for IDE autocomplete
- [x] Config validation command: `devproc validate`
- [x] Init command: `devproc init` to generate starter config
- [ ] Import from docker-compose.yml
- [ ] Import from Procfile

### UI/UX

- [ ] Customizable color themes
- [ ] Configurable keyboard shortcuts
- [ ] Mouse support (click to select, scroll)
- [ ] Resize panes with keyboard
- [ ] Multiple log panes (split view)
- [ ] Bookmark log lines
- [x] Copy log lines to clipboard (`y` / `Y`)

### Performance

- [ ] Lazy log loading (only load visible + buffer)
- [ ] Log compression for long-running sessions
- [ ] Reduce memory usage for many services
- [ ] Faster startup time

### Developer Experience

- [ ] Debug mode with verbose logging
- [ ] Dry-run mode to preview what would happen
- [ ] Service templates for common stacks
- [ ] Shell completions (bash, zsh, fish)

---

## Non-Goals

Things we explicitly won't do to keep DevProc focused:

- **Production deployment** - DevProc is for local development only
- **Distributed systems** - No clustering or multi-node support
- **Proprietary integrations** - Focus on open standards and tools
- **GUI application** - Terminal-first, web dashboard is optional

---

## Contributing

Want to help build these features? Here's how:

1. Check [GitHub Issues](https://github.com/captjt/devproc/issues) for existing discussions
2. Open an issue to discuss your idea before implementing
3. Start with "Low Complexity" items if you're new to the codebase
4. See `docs/DESIGN.md` for architecture overview

### Good First Issues

- Log export functionality
- Improved status indicators
- Shell completions
- Config validation command

### Help Wanted

- Docker API integration
- Kubernetes support

---

## Changelog

### v0.5.0 (Current)

- Added resource monitoring (CPU/memory per service)
- Real-time CPU % and memory usage displayed in service list
- Resource graph view with sparkline visualization (toggle with `m`)
- Color-coded CPU usage indicators
- Added `devproc init` command to scaffold starter config
- Added `devproc validate` command to check config for errors
- Added clipboard support (`y` to copy last log, `Y` to copy all visible logs)

### v0.4.0

- Added log search with regex support
- Added search match highlighting
- Added log export (plain text and JSON formats)
- Added service details panel
- Added animated spinners for starting/stopping states
- Added restart count badges

### v0.3.0

- Added service groups
- Added hot config reload
- Added log scrolling with vim keys
- Added file watcher for auto-reload

### v0.2.0

- Initial TUI implementation
- Service lifecycle management
- Dependency ordering
- Healthcheck support

### v0.1.0

- Project inception
- Basic process spawning
- Config parsing
