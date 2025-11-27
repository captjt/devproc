#!/usr/bin/env bun
import { render } from "@opentui/solid"
import { watch } from "fs"
import { loadConfig } from "./config/loader"
import { ProcessManager } from "./process/manager"
import { App } from "./app"
import { getCompletion, SUPPORTED_SHELLS } from "./utils/completions"

const VERSION = "0.5.0"

function printHelp() {
  console.log(`
DevProc v${VERSION} - Developer Process Manager

Usage:
  devproc [options] [command]

Commands:
  up                    Start all services (default)
  down                  Stop all services
  restart               Restart all services
  status                Show service status (non-interactive)
  init                  Create a new devproc.yaml config file
  validate              Validate the config file without starting services
  completions <shell>   Generate shell completions (bash, zsh, fish)

Options:
  -c, --config <file>   Path to config file (default: devproc.yaml)
  -w, --watch           Watch config file for changes and auto-reload
  -h, --help            Show this help message
  -v, --version         Show version

Examples:
  devproc               Start all services with TUI
  devproc up            Start all services with TUI
  devproc init          Create a starter config file
  devproc validate      Check config for errors
  devproc -c dev.yaml   Use custom config file
  devproc -w            Auto-reload on config changes

Shell Completions:
  # Bash (add to ~/.bashrc)
  eval "$(devproc completions bash)"

  # Zsh (add to ~/.zshrc)
  eval "$(devproc completions zsh)"

  # Fish (add to ~/.config/fish/config.fish)
  devproc completions fish | source
`)
}

/**
 * Generate a starter devproc.yaml config file
 */
async function initConfig(): Promise<void> {
  const configPath = "devproc.yaml"
  const file = Bun.file(configPath)

  if (await file.exists()) {
    console.error(`Error: ${configPath} already exists`)
    console.log("Use a different directory or remove the existing file.")
    process.exit(1)
  }

  // Try to detect project type from package.json
  let projectName = "my-project"
  let suggestedServices = ""

  const pkgFile = Bun.file("package.json")
  if (await pkgFile.exists()) {
    try {
      const pkg = await pkgFile.json()
      projectName = pkg.name || projectName

      // Suggest services based on scripts
      const scripts = pkg.scripts || {}
      const suggestions: string[] = []

      if (scripts.dev) {
        suggestions.push(`  # Frontend dev server
  web:
    cmd: ${pkg.packageManager?.startsWith("bun") ? "bun" : "npm"} run dev
    color: cyan`)
      }

      if (scripts.start) {
        suggestions.push(`  # Main application
  app:
    cmd: ${pkg.packageManager?.startsWith("bun") ? "bun" : "npm"} run start
    color: green`)
      }

      if (scripts["start:dev"] || scripts["dev:server"]) {
        const script = scripts["start:dev"] ? "start:dev" : "dev:server"
        suggestions.push(`  # Dev server
  server:
    cmd: ${pkg.packageManager?.startsWith("bun") ? "bun" : "npm"} run ${script}
    color: green`)
      }

      if (suggestions.length > 0) {
        suggestedServices = suggestions.join("\n\n")
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Default services if we couldn't detect any
  if (!suggestedServices) {
    suggestedServices = `  # Example: Web server
  # web:
  #   cmd: npm run dev
  #   color: cyan

  # Example: API server
  # api:
  #   cmd: go run ./cmd/api
  #   healthcheck:
  #     cmd: curl -f http://localhost:8080/health
  #     interval: 2s
  #     retries: 30
  #   color: green

  # Example: Worker process
  # worker:
  #   cmd: npm run worker
  #   depends_on:
  #     - api
  #   restart: on-failure

  # Example: Docker database
  # postgres:
  #   cmd: docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
  #   healthcheck: pg_isready -h localhost -p 5432

  # Placeholder service (remove this)
  echo:
    cmd: "bash -c 'while true; do echo Hello from devproc; sleep 5; done'"
    color: cyan`
  }

  const configContent = `# DevProc Configuration
# Documentation: https://github.com/captjt/devproc

name: ${projectName}

# Global environment variables (applied to all services)
# env:
#   NODE_ENV: development

# Load environment from .env file
# dotenv: .env

# Organize services into groups (optional)
# groups:
#   backend:
#     - api
#     - worker
#   frontend:
#     - web

services:
${suggestedServices}
`

  await Bun.write(configPath, configContent)
  console.log(`Created ${configPath}`)
  console.log("")
  console.log("Next steps:")
  console.log("  1. Edit devproc.yaml to configure your services")
  console.log("  2. Run 'devproc' to start all services")
  console.log("  3. Press '?' for keyboard shortcuts")
}

/**
 * Validate the config file and report any errors
 */
async function validateConfig(configPath?: string): Promise<void> {
  console.log("Validating configuration...")
  console.log("")

  try {
    const config = await loadConfig(configPath)

    console.log(`✓ Config file: ${config.configPath}`)
    console.log(`✓ Project name: ${config.name}`)
    console.log(`✓ Services: ${config.services.size}`)

    // List services with their dependencies
    console.log("")
    console.log("Services:")
    for (const [name, service] of config.services) {
      const deps = Array.from(service.dependsOn.keys())
      const depStr = deps.length > 0 ? ` (depends on: ${deps.join(", ")})` : ""
      const healthStr = service.healthcheck ? " [healthcheck]" : ""
      const groupStr = service.group ? ` [group: ${service.group}]` : ""
      console.log(`  • ${name}${depStr}${healthStr}${groupStr}`)
    }

    // List groups
    if (config.groups.size > 0) {
      console.log("")
      console.log("Groups:")
      for (const [name, group] of config.groups) {
        console.log(`  • ${name}: ${group.services.join(", ")}`)
      }
    }

    console.log("")
    console.log("✓ Configuration is valid!")
  } catch (error) {
    console.error("✗ Configuration error:")
    console.error("")
    if (error instanceof Error) {
      // Format the error message nicely
      const lines = error.message.split("\n")
      for (const line of lines) {
        console.error(`  ${line}`)
      }
    } else {
      console.error(`  ${error}`)
    }
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  let configPath: string | undefined
  let command = "up"
  let watchConfig = false

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "-h" || arg === "--help") {
      printHelp()
      process.exit(0)
    }

    if (arg === "-v" || arg === "--version") {
      console.log(`DevProc v${VERSION}`)
      process.exit(0)
    }

    if (arg === "-c" || arg === "--config") {
      configPath = args[++i]
      continue
    }

    if (arg === "-w" || arg === "--watch") {
      watchConfig = true
      continue
    }

    // Commands
    if (["up", "down", "restart", "status", "init", "validate", "completions"].includes(arg!)) {
      command = arg!
      continue
    }

    // Shell argument for completions command
    if (SUPPORTED_SHELLS.includes(arg!)) {
      // This will be handled after the loop
      continue
    }

    console.error(`Unknown option: ${arg}`)
    printHelp()
    process.exit(1)
  }

  // Handle completions command
  if (command === "completions") {
    // Find the shell argument
    const shellArg = args.find((arg) => SUPPORTED_SHELLS.includes(arg))
    if (!shellArg) {
      console.error("Error: Please specify a shell (bash, zsh, or fish)")
      console.log("")
      console.log("Usage: devproc completions <shell>")
      console.log("")
      console.log("Examples:")
      console.log("  devproc completions bash")
      console.log("  devproc completions zsh")
      console.log("  devproc completions fish")
      process.exit(1)
    }

    const script = getCompletion(shellArg)
    if (script) {
      console.log(script)
    }
    process.exit(0)
  }

  // Handle init command (doesn't need existing config)
  if (command === "init") {
    await initConfig()
    process.exit(0)
  }

  // Handle validate command
  if (command === "validate") {
    await validateConfig(configPath)
    process.exit(0)
  }

  try {
    // Load configuration
    const config = await loadConfig(configPath)
    console.log(`Loading project: ${config.name}`)

    // Create process manager
    const manager = new ProcessManager(config)

    // Handle non-interactive commands
    if (command === "status") {
      const states = manager.getAllStates()
      console.log("\nService Status:")
      for (const state of states) {
        const symbol = state.status === "running" || state.status === "healthy" ? "●" : "○"
        console.log(`  ${symbol} ${state.name}: ${state.status}`)
      }
      process.exit(0)
    }

    if (command === "down") {
      console.log("Stopping all services...")
      await manager.stopAll()
      console.log("All services stopped.")
      process.exit(0)
    }

    // Handle graceful shutdown
    const handleExit = async () => {
      console.log("\nStopping all services...")
      await manager.stopAll()
      process.exit(0)
    }

    process.on("SIGINT", handleExit)
    process.on("SIGTERM", handleExit)

    // For 'up' and 'restart', start the TUI
    if (command === "restart") {
      await manager.restartAll()
    }

    // Set up config file watcher if enabled
    if (watchConfig) {
      let debounceTimer: Timer | null = null
      const watcher = watch(config.configPath, (eventType) => {
        if (eventType === "change") {
          // Debounce rapid changes (editors often write multiple times)
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            manager.reloadConfig().catch((err) => {
              // Errors are emitted via events, handled in UI
              console.error("Config reload error:", err.message)
            })
          }, 500)
        }
      })

      // Clean up watcher on exit
      process.on("exit", () => watcher.close())
    }

    // Render the TUI
    await render(() => <App manager={manager} projectName={config.name} />)

    // Start all services if 'up'
    if (command === "up") {
      await manager.startAll()
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
