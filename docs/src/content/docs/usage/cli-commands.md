---
title: CLI Commands
description: DevProc command line interface reference
---

DevProc provides several commands for managing your development environment.

## Basic Usage

```bash
devproc [options] [command]
```

If no command is specified, `up` is used by default.

## Commands

### `up` (default)

Start all services and launch the TUI.

```bash
devproc up
# or simply
devproc
```

Services start in dependency order. The TUI remains active for managing services.

### `down`

Stop all running services.

```bash
devproc down
```

Services stop in reverse dependency order (dependents stop first).

### `restart`

Restart all services.

```bash
devproc restart
```

Equivalent to `down` followed by `up`.

### `status`

Show service status without the TUI (non-interactive).

```bash
devproc status
```

Output:

```
Service       Status    PID     Uptime
postgres      healthy   12345   5m
redis         healthy   12346   5m
api           running   12347   4m
worker        stopped   -       -
web           running   12348   3m
```

### `init`

Create a new `devproc.yaml` configuration file.

```bash
devproc init
```

This will:

- Detect project name from `package.json`
- Suggest services based on npm scripts
- Create a commented template

If `devproc.yaml` already exists, you'll be prompted to overwrite.

### `validate`

Validate the configuration file without starting services.

```bash
devproc validate
```

Checks for:

- Valid YAML syntax
- Required fields
- Valid service references in dependencies
- Valid group references
- Health check configuration

```bash
# Validate a specific config file
devproc validate -c ./configs/dev.yaml
```

### `completions`

Generate shell completion scripts.

```bash
devproc completions <shell>
```

Available shells: `bash`, `zsh`, `fish`

```bash
# Generate and install completions
eval "$(devproc completions bash)"
eval "$(devproc completions zsh)"
devproc completions fish | source
```

See [Installation](/devproc/getting-started/installation/#shell-completions) for detailed setup instructions.

## Options

### `-c, --config <file>`

Specify a custom configuration file.

```bash
devproc -c ./configs/development.yaml
devproc --config /path/to/devproc.yaml
```

Default: `devproc.yaml` in the current directory.

### `-w, --watch`

Watch the config file for changes and auto-reload.

```bash
devproc -w
devproc --watch
```

When the config file changes:

- New services are added (stopped state)
- Removed services are stopped
- Modified services are restarted

### `-h, --help`

Show help information.

```bash
devproc --help
devproc -h
```

### `-v, --version`

Show version information.

```bash
devproc --version
devproc -v
```

## Examples

### Start with Default Config

```bash
cd my-project
devproc
```

### Start with Custom Config

```bash
devproc -c ./docker/devproc.yaml
```

### Start with Auto-Reload

```bash
devproc -w
```

### Check Config Before Running

```bash
devproc validate && devproc
```

### Generate Starter Config

```bash
cd my-project
devproc init
devproc validate
devproc
```

### Non-Interactive Status Check

```bash
# Great for scripts
devproc status
```

## Exit Codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | Success              |
| 1    | General error        |
| 2    | Configuration error  |
| 130  | Interrupted (Ctrl+C) |

## Environment Variables

### `LOG_LEVEL`

Set internal logging level.

```bash
LOG_LEVEL=debug devproc
```

Values: `debug`, `info`, `warn`, `error`

### `LOG_FILE`

Write internal logs to a file.

```bash
LOG_FILE=/tmp/devproc.log devproc
```

Useful for debugging DevProc itself without cluttering the TUI.
