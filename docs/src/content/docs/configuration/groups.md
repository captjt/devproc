---
title: Groups
description: Organizing services into collapsible groups
---

Groups help organize related services in the DevProc UI. Services in a group appear under a collapsible header showing the group name and running count.

## Defining Groups

### Top-Level Definition

Define groups at the top level and list member services:

```yaml
name: my-project

groups:
  infrastructure:
    - postgres
    - redis
  backend:
    - api
    - worker
  frontend:
    - web
    - storybook

services:
  postgres:
    cmd: docker run postgres:16
  redis:
    cmd: docker run redis:7
  api:
    cmd: npm run dev
  worker:
    cmd: npm run worker
  web:
    cmd: npm run dev
    cwd: ./frontend
  storybook:
    cmd: npm run storybook
    cwd: ./frontend
```

### Per-Service Definition

Alternatively, assign groups on each service:

```yaml
services:
  postgres:
    cmd: docker run postgres:16
    group: infrastructure

  api:
    cmd: npm run dev
    group: backend

  web:
    cmd: npm run dev
    group: frontend
```

You can mix both approaches.

## UI Behavior

In the TUI, groups appear as collapsible headers:

```
▾ infrastructure (2/2)
  ● postgres    :5432  5m
  ● redis       :6379  5m
▾ backend (1/2)
  ● api         :8080  4m
  ○ worker
▸ frontend (0/2)
```

- **▾** indicates an expanded group
- **▸** indicates a collapsed group
- **(1/2)** shows running count / total count

### Collapsing Groups

Press `Space` when a service in a group is selected to toggle the group's collapsed state.

When collapsed:

- Only the group header is visible
- Services in the group are hidden
- You can still start/stop the entire group

## Group Display Order

Groups appear in the order they're defined in the config. Services not in any group appear at the bottom.

```yaml
groups:
  # These appear first, in this order
  infrastructure:
    - postgres
    - redis
  backend:
    - api
  frontend:
    - web

services:
  # This service has no group, appears at bottom
  standalone-tool:
    cmd: npm run tool
```

## Group Operations

### Quick Start with Number Keys

Press `Shift + 1-9` to start groups by their position:

- `Shift + 1` - Start first group (infrastructure)
- `Shift + 2` - Start second group (backend)
- etc.

### Start/Stop All in Group

Currently, starting a service automatically starts its dependencies, which may span groups. Future versions may add explicit group start/stop commands.

## Best Practices

### Organize by Layer

```yaml
groups:
  infrastructure: # Databases, caches
    - postgres
    - redis
    - elasticsearch
  backend: # APIs, workers
    - api
    - worker
    - scheduler
  frontend: # UI, tools
    - web
    - storybook
    - docs
```

### Keep Groups Focused

Aim for 2-5 services per group. Too many services defeats the purpose of organization.

### Match Your Architecture

Name groups to reflect your project structure:

```yaml
# Monorepo with packages
groups:
  packages/database:
    - migrations
    - seed
  packages/api:
    - api
    - worker
  apps/web:
    - web
    - storybook
```

```yaml
# Microservices
groups:
  user-service:
    - user-api
    - user-worker
  order-service:
    - order-api
    - order-worker
  shared:
    - postgres
    - redis
```

## Without Groups

If you don't define groups, all services appear in a flat list ordered by their definition in the config:

```yaml
services:
  postgres:
    cmd: docker run postgres:16
  api:
    cmd: npm run dev
  web:
    cmd: npm run dev
# UI shows:
# ● postgres
# ● api
# ● web
```

Groups are optional but recommended for projects with more than 4-5 services.
