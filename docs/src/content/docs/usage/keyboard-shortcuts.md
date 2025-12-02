---
title: Keyboard Shortcuts
description: Complete guide to DevProc keyboard controls
---

DevProc is designed to be keyboard-driven with vim-style navigation. Here's a complete reference of all keyboard shortcuts.

## Service Management

| Key           | Action                          |
| ------------- | ------------------------------- |
| `↑` / `k`     | Move selection up               |
| `↓` / `j`     | Move selection down             |
| `s`           | Start selected service          |
| `x`           | Stop selected service           |
| `r`           | Restart selected service        |
| `a`           | Start all services              |
| `X` (Shift+x) | Stop all services               |
| `R` (Shift+r) | Restart all services            |
| `Space`       | Toggle group collapsed/expanded |
| `i`           | Show service details panel      |

### Starting Services

When you press `s` to start a service:

- Dependencies are automatically started first
- Health checks are awaited for `healthy` dependencies
- The service then starts

### Stopping Services

When you press `x` to stop a service:

- Only the selected service stops
- Dependents continue running (they may fail)

When you press `X` to stop all:

- Services stop in reverse dependency order
- Dependents stop before their dependencies

## Log Navigation

| Key           | Action                                 |
| ------------- | -------------------------------------- |
| `Tab`         | Toggle between single/all service logs |
| `f`           | Toggle follow mode (auto-scroll)       |
| `c`           | Clear logs for selected service        |
| `g`           | Scroll to top of logs                  |
| `G` (Shift+g) | Scroll to bottom of logs               |
| `PgUp`        | Page up                                |
| `PgDn`        | Page down                              |
| `Ctrl+u`      | Half page up                           |
| `Ctrl+d`      | Half page down                         |

### View Modes

- **Single service view** (default): Shows logs only from the selected service
- **All services view**: Shows interleaved logs from all services, with service name prefix

Press `Tab` to switch between views.

### Follow Mode

When follow mode is enabled (green `[follow]` indicator):

- New logs automatically scroll into view
- Manual scrolling temporarily disables follow

When disabled (gray `[scroll]` indicator):

- Logs don't auto-scroll
- Press `G` or `f` to re-enable

## Log Search

| Key           | Action                       |
| ------------- | ---------------------------- |
| `/`           | Start search                 |
| `Enter`       | Submit search                |
| `Esc`         | Cancel search / Clear search |
| `n`           | Jump to next match           |
| `N` (Shift+n) | Jump to previous match       |

### Search Features

- Supports regular expressions
- Case-insensitive by default
- Matches are highlighted in yellow
- Current match is highlighted in bright yellow
- Search status shows `[1/15]` (current/total matches)

### Search Examples

```
/error          # Find "error" anywhere
/ERROR|WARN     # Find errors or warnings
/\d{3}          # Find 3-digit numbers (status codes)
/user.*created  # Find user creation logs
```

## Log Export

| Key           | Action                              |
| ------------- | ----------------------------------- |
| `e`           | Export current service logs to file |
| `E` (Shift+e) | Export all logs to file             |

Files are saved as:

- `devproc-<service>-<timestamp>.log` for single service
- `devproc-all-<timestamp>.log` for all logs

## Clipboard

| Key           | Action                             |
| ------------- | ---------------------------------- |
| `y`           | Copy last log line to clipboard    |
| `Y` (Shift+y) | Copy all visible logs to clipboard |

Works on macOS (pbcopy), Linux (xclip/xsel), and WSL (clip.exe).

## Resource Monitoring

| Key | Action                       |
| --- | ---------------------------- |
| `m` | Toggle resource monitor view |

The resource view shows:

- CPU usage with sparkline graph
- Memory usage with sparkline graph
- Historical data (1 sample per second)

Press `m` again to return to logs.

## Configuration

| Key      | Action                         |
| -------- | ------------------------------ |
| `Ctrl+L` | Reload configuration from disk |

When config is reloaded:

- New services are added (stopped state)
- Removed services are stopped
- Modified services are restarted with new config

Status message shows changes: `Reloaded: +2 -1 ~1`

## Group Operations

| Key                         | Action                                                     |
| --------------------------- | ---------------------------------------------------------- |
| `Space`                     | Toggle group collapsed (when service in group is selected) |
| `Shift+1` through `Shift+9` | Start group by position                                    |

### Quick Start Groups

Press `Shift+1` to start the first group, `Shift+2` for the second, etc.

Groups are numbered in the order they appear in your config.

## General

| Key | Action          |
| --- | --------------- |
| `?` | Show help panel |
| `q` | Quit DevProc    |

### Quitting

When you press `q`:

1. All running services are stopped
2. Services stop in reverse dependency order
3. DevProc exits when all services have stopped

## Quick Reference Card

```
Navigation          Services            Logs
─────────────────   ─────────────────   ─────────────────
↑/k  Move up        s    Start          Tab  Toggle view
↓/j  Move down      x    Stop           f    Follow mode
                    r    Restart        c    Clear
                    a    Start all      g/G  Top/bottom
                    X    Stop all       /    Search
                    R    Restart all    n/N  Next/prev match

Resources           Export/Copy         Other
─────────────────   ─────────────────   ─────────────────
m    Toggle view    e    Export logs    ?    Help
                    E    Export all     q    Quit
                    y    Copy line      Ctrl+L  Reload
                    Y    Copy all       Space   Toggle group
```

## Customization

Currently, keyboard shortcuts are not configurable. This is planned for a future release.
