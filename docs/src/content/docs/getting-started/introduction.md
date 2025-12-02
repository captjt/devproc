---
title: Introduction
description: What is DevProc and why you should use it
---

DevProc is a terminal UI application built for developers who need to manage multiple services during local development. Instead of opening multiple terminal windows for your API server, database, frontend dev server, and background workers, DevProc orchestrates everything from a single interface.

## The Problem

Modern development often involves running multiple processes:

- **Backend API** with hot reload (Air, nodemon, cargo-watch)
- **Frontend** dev server (Vite, Next.js, etc.)
- **Databases** (PostgreSQL, MySQL, Redis)
- **Background workers** and queue processors
- **Supporting services** (Elasticsearch, MinIO, etc.)

Managing these manually means:

- Opening 5+ terminal tabs
- Remembering startup order and dependencies
- Manually checking if services are healthy
- Scrolling through mixed log output
- Forgetting to stop services when switching projects

## The Solution

DevProc provides:

- **Single config file** (`devproc.yaml`) defining all your services
- **Automatic dependency ordering** - databases start before APIs
- **Health checks** - wait for services to be ready
- **Unified log view** - see all logs or focus on one service
- **One command to start everything** - `devproc up`
- **Keyboard-driven TUI** - fast navigation without the mouse

## Key Features

### Service Management

Start, stop, and restart services individually or all at once. Services are organized in a sidebar with status indicators.

### Service Groups

Organize related services into collapsible groups. Keep your infrastructure, backend, and frontend services organized.

### Log Streaming

View logs from all services interleaved by time, or focus on a single service. Search with regex, export to files, and copy to clipboard.

### Health Checks

Define health checks for services. Dependent services wait for health checks to pass before starting.

### Docker Compose Integration

Manage Docker Compose services alongside native processes. DevProc handles starting, stopping, and streaming logs from containers.

### Resource Monitoring

See real-time CPU and memory usage for each service. Toggle a resource graph view with historical data.

### Hot Config Reload

Update your config file and reload without restarting DevProc. New services are added, removed services are stopped.

## When to Use DevProc

DevProc is ideal for:

- **Monorepo projects** with multiple services
- **Microservices development** on your local machine
- **Full-stack projects** with frontend and backend
- **Projects with external dependencies** like databases

DevProc is **not** for:

- Production deployment (use proper orchestration tools)
- Single-service projects (just run the command directly)
- Remote server management (it's for local development)

## Next Steps

- [Installation](/devproc/getting-started/installation/) - Install DevProc on your system
- [Quick Start](/devproc/getting-started/quick-start/) - Get up and running in 5 minutes
