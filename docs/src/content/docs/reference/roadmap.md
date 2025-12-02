---
title: Roadmap
description: Planned features and improvements for DevProc
---

This document outlines planned features and improvements for DevProc.

## Current Features (v0.5.x)

- Service management (start, stop, restart)
- Dependency ordering with health checks
- Service groups with collapsible UI
- Live log streaming with scrollback
- Hot config reload (manual + file watcher)
- Vim-style keyboard navigation
- Log search with regex support and highlighting
- Log export (plain text)
- Service details panel
- Animated spinners for starting/stopping
- Restart count badges
- Resource monitoring (CPU/memory per service)
- Docker Compose integration
- Shell completions (bash, zsh, fish)
- Clipboard support

## Medium Term (v0.6.x)

### Notifications

Desktop notifications for important events.

- Notify on service crash
- Notify when service becomes healthy
- Notify on health check failures
- Configurable per-service

**Implementation:** `osascript` on macOS, `notify-send` on Linux

### Profiles

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
```

```bash
devproc up --profile backend
```

### Environment Switching

Support multiple environment configurations.

```yaml
environments:
  development:
    env:
      DATABASE_URL: postgres://localhost/dev
  staging:
    dotenv: .env.staging
```

```bash
devproc up --env staging
```

### Custom Commands

Define and run custom commands on services.

```yaml
services:
  api:
    cmd: air
    commands:
      migrate: go run ./cmd/migrate
      seed: go run ./cmd/seed
```

## Long Term (v1.0+)

### Native Docker Integration

Use Docker API directly instead of shell commands.

- Automatic container cleanup
- Pull images if not present
- Direct container log streaming
- Health status from Docker health checks

### Plugin System

Extend DevProc with custom functionality.

- Lifecycle hooks
- Custom UI panels
- Custom commands
- Service type plugins

### Web Dashboard

Optional web UI for remote access.

- View logs from browser
- Start/stop services remotely
- Share dashboard URL with team

## Quality of Life

### Configuration

- [ ] JSON schema for IDE autocomplete
- [ ] Import from docker-compose.yml
- [ ] Import from Procfile
- [ ] Service templates for common stacks

### UI/UX

- [ ] Customizable color themes
- [ ] Configurable keyboard shortcuts
- [ ] Mouse support
- [ ] Resize panes with keyboard
- [ ] Multiple log panes (split view)
- [ ] Bookmark log lines

### Performance

- [ ] Lazy log loading
- [ ] Log compression for long sessions
- [ ] Faster startup time

## Non-Goals

Things we explicitly won't do:

- **Production deployment** - DevProc is for local development only
- **Distributed systems** - No clustering or multi-node support
- **GUI application** - Terminal-first, web dashboard is optional

## Contributing

Want to help build these features?

1. Check [GitHub Issues](https://github.com/captjt/devproc/issues)
2. Open an issue to discuss before implementing
3. See the design doc in the repo for architecture overview

### Good First Issues

- JSON schema generation
- Additional shell completions
- Documentation improvements

### Help Wanted

- Docker API integration
- Plugin system design
