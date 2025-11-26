#!/usr/bin/env bun
import { render } from "@opentui/solid";
import { watch } from "fs";
import { loadConfig } from "./config/loader";
import { ProcessManager } from "./process/manager";
import { App } from "./app";

const VERSION = "0.3.0";

function printHelp() {
  console.log(`
DevProc v${VERSION} - Developer Process Manager

Usage:
  devproc [options] [command]

Commands:
  up            Start all services (default)
  down          Stop all services
  restart       Restart all services
  status        Show service status (non-interactive)

Options:
  -c, --config <file>   Path to config file (default: devproc.yaml)
  -w, --watch           Watch config file for changes and auto-reload
  -h, --help            Show this help message
  -v, --version         Show version

Examples:
  devproc               Start all services with TUI
  devproc up            Start all services with TUI
  devproc -c dev.yaml   Use custom config file
  devproc -w            Auto-reload on config changes
`);
}

async function main() {
  const args = process.argv.slice(2);
  let configPath: string | undefined;
  let command = "up";
  let watchConfig = false;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      console.log(`DevProc v${VERSION}`);
      process.exit(0);
    }

    if (arg === "-c" || arg === "--config") {
      configPath = args[++i];
      continue;
    }

    if (arg === "-w" || arg === "--watch") {
      watchConfig = true;
      continue;
    }

    // Commands
    if (["up", "down", "restart", "status"].includes(arg!)) {
      command = arg!;
      continue;
    }

    console.error(`Unknown option: ${arg}`);
    printHelp();
    process.exit(1);
  }

  try {
    // Load configuration
    const config = await loadConfig(configPath);
    console.log(`Loading project: ${config.name}`);

    // Create process manager
    const manager = new ProcessManager(config);

    // Handle non-interactive commands
    if (command === "status") {
      const states = manager.getAllStates();
      console.log("\nService Status:");
      for (const state of states) {
        const symbol = state.status === "running" || state.status === "healthy" ? "●" : "○";
        console.log(`  ${symbol} ${state.name}: ${state.status}`);
      }
      process.exit(0);
    }

    if (command === "down") {
      console.log("Stopping all services...");
      await manager.stopAll();
      console.log("All services stopped.");
      process.exit(0);
    }

    // Handle graceful shutdown
    const handleExit = async () => {
      console.log("\nStopping all services...");
      await manager.stopAll();
      process.exit(0);
    };

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    // For 'up' and 'restart', start the TUI
    if (command === "restart") {
      await manager.restartAll();
    }

    // Set up config file watcher if enabled
    if (watchConfig) {
      let debounceTimer: Timer | null = null;
      const watcher = watch(config.configPath, (eventType) => {
        if (eventType === "change") {
          // Debounce rapid changes (editors often write multiple times)
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            manager.reloadConfig().catch((err) => {
              // Errors are emitted via events, handled in UI
              console.error("Config reload error:", err.message);
            });
          }, 500);
        }
      });

      // Clean up watcher on exit
      process.on("exit", () => watcher.close());
    }

    // Render the TUI
    await render(() => <App manager={manager} projectName={config.name} />);

    // Start all services if 'up'
    if (command === "up") {
      await manager.startAll();
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
