---
title: Resource Monitoring
description: Monitoring CPU and memory usage per service
---

DevProc provides real-time resource monitoring for all running services, helping you identify performance issues and resource-hungry processes.

## Overview

Resource monitoring shows:

- **CPU usage** - Percentage of CPU time used
- **Memory usage** - RAM consumed by the process

Data is collected every second using the system's `ps` command.

## Service List View

Running services display resource metrics inline:

```
● api         12.5%   45.2MB  :8080  4m
● worker       2.1%   23.1MB         3m
● web          8.3%   67.8MB  :5173  3m
```

- **CPU %** - Color-coded: green (<50%), yellow (50-80%), red (>80%)
- **Memory** - Displayed in appropriate units (KB, MB, GB)

Resources only show for running/healthy services.

## Resource Graph View

Press `m` to toggle the resource graph for the selected service.

```
CPU Usage
▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃  12.5%

Memory Usage
▅▅▅▅▅▅▅▅▅▅▅▅▅▆▆▆▆▆▆▆▆▆▆▆▆▆▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  45.2MB

History: 60 samples (60s)
Memory %: 0.8% of system
```

### Sparkline Graph

The sparkline shows historical data:

- Each character represents one sample (1 second)
- Height indicates relative usage
- Up to 60 seconds of history

### Graph Information

- **Current value** - Live reading next to the graph
- **Sample count** - How much history is shown
- **Memory %** - Percentage of total system memory

Press `m` again to return to log view.

## Color Coding

CPU usage is color-coded for quick identification:

| Color      | CPU Range | Indication |
| ---------- | --------- | ---------- |
| Green/Cyan | 0-50%     | Normal     |
| Yellow     | 50-80%    | Elevated   |
| Red        | 80%+      | High       |

## How It Works

DevProc uses the `ps` command to collect metrics:

```bash
ps -p <pid> -o %cpu=,rss=,%mem=
```

- **%cpu** - CPU percentage
- **rss** - Resident Set Size (physical memory)
- **%mem** - Memory percentage of total system RAM

Metrics are polled every second for running processes.

## Monitoring Multiple Services

While the graph shows one service at a time, the service list always shows current metrics for all running services.

Quick comparison:

1. Look at the service list
2. Identify services with high CPU (red) or high memory
3. Select a service and press `m` for detailed history

## Process Trees

For services that spawn child processes, only the main process is monitored. Child processes aren't included in the metrics.

If your service uses workers or child processes, consider:

- Monitoring at the OS level (`htop`, `top`)
- Using application-level metrics

## Docker Compose Services

For Docker Compose services, DevProc monitors the `docker compose` process, not the container itself.

To monitor actual container resources:

- Use `docker stats`
- Use Docker Desktop dashboard
- Configure container resource limits

## Limitations

### Platform Support

Resource monitoring works on:

- **macOS** - Full support
- **Linux** - Full support
- **Windows/WSL** - Limited support (may need additional tools)

### Refresh Rate

Metrics update every second. Sub-second spikes may not be captured.

### CPU Accuracy

CPU percentage is calculated over the sampling interval. Brief spikes may be averaged out.

## Best Practices

### Monitor During Development

Keep an eye on resource usage while developing:

- Unexpected CPU spikes may indicate infinite loops
- Memory growth may indicate leaks
- Compare before/after code changes

### Identify Resource Hogs

Use the service list to quickly identify which services are consuming the most resources.

### Check After Deployment Changes

When you change configuration or code:

1. Restart the service
2. Monitor resource usage
3. Compare to previous baseline

### Set Resource Expectations

Know what's normal for your services:

- Database connections typically use more memory
- Build/watch processes have CPU spikes
- Idle services should use minimal resources
