import { createSignal, createEffect, onMount, onCleanup, For, Show, Switch, Match } from "solid-js";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ProcessManager } from "./process/manager";
import { useServices, type DisplayItem } from "./ui/hooks/useServices";
import { useLogs } from "./ui/hooks/useLogs";

interface AppProps {
  manager: ProcessManager;
  projectName: string;
}

// Status indicator symbols and colors
const STATUS_SYMBOLS = {
  stopped: "○",
  starting: "◐",
  running: "●",
  healthy: "●",
  stopping: "◑",
  crashed: "✗",
  failed: "✗",
} as const;

const STATUS_COLORS = {
  stopped: "gray",
  starting: "yellow",
  running: "blue",
  healthy: "green",
  stopping: "yellow",
  crashed: "red",
  failed: "red",
} as const;

// Format uptime
function formatUptime(startedAt?: Date): string {
  if (!startedAt) return "   ";
  const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`.padStart(3);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`.padStart(3);
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`.padStart(3);
  return `${Math.floor(seconds / 86400)}d`.padStart(3);
}

// Format timestamp for logs
function formatLogTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function App(props: AppProps) {
  const dimensions = useTerminalDimensions();
  const {
    services,
    displayItems,
    selectedIndex,
    selectedService,
    selectedGroup,
    selectedName,
    selectNext,
    selectPrev,
    toggleGroupCollapsed,
    isGroupCollapsed,
  } = useServices(props.manager);
  const { getServiceLogs, clearLogs, filteredLogs } = useLogs(props.manager);

  // Status message for reload feedback
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

  const [viewMode, setViewMode] = createSignal<"single" | "all">("single");
  const [showHelp, setShowHelp] = createSignal(false);
  const [following, setFollowing] = createSignal(true);

  // Scrollbox ref for manual scrolling
  let scrollboxRef: ScrollBoxRenderable | undefined;

  // Scroll position for indicator (updated when scrolling)
  const [scrollInfo, setScrollInfo] = createSignal({ current: 0, total: 0 });

  // Calculate layout dimensions
  const sidebarWidth = () => Math.min(30, Math.floor(dimensions().width * 0.3));
  const contentHeight = () => dimensions().height - 3; // Header and footer

  // Get visible logs - return all logs, let scrollbox handle windowing
  const visibleLogs = () => {
    const selected = selectedService();
    if (viewMode() === "single" && selected) {
      return getServiceLogs(selected.name);
    }
    return filteredLogs();
  };

  // Update scroll info from scrollbox
  const updateScrollInfo = () => {
    if (scrollboxRef) {
      const total = visibleLogs().length;
      const viewportHeight = contentHeight() - 2;
      const scrollTop = scrollboxRef.scrollTop;
      // Approximate current line based on scroll position
      const current = Math.min(scrollTop + viewportHeight, total);
      setScrollInfo({ current, total });
    }
  };

  // Scroll helper functions
  const scrollUp = (lines = 1) => {
    if (scrollboxRef) {
      scrollboxRef.scrollBy(-lines);
      setFollowing(false);
      updateScrollInfo();
    }
  };

  const scrollDown = (lines = 1) => {
    if (scrollboxRef) {
      scrollboxRef.scrollBy(lines);
      // Check if we're at the bottom to re-enable following
      const atBottom = scrollboxRef.scrollTop >= scrollboxRef.scrollHeight - contentHeight();
      if (atBottom) {
        setFollowing(true);
      }
      updateScrollInfo();
    }
  };

  const scrollToTop = () => {
    if (scrollboxRef) {
      scrollboxRef.scrollTo(0);
      setFollowing(false);
      updateScrollInfo();
    }
  };

  const scrollToBottom = () => {
    if (scrollboxRef) {
      scrollboxRef.scrollTo(scrollboxRef.scrollHeight);
      setFollowing(true);
      updateScrollInfo();
    }
  };

  const pageUp = () => {
    scrollUp(contentHeight() - 2);
  };

  const pageDown = () => {
    scrollDown(contentHeight() - 2);
  };

  // Update uptime display periodically
  const [, setTick] = createSignal(0);
  let tickInterval: Timer;

  onMount(() => {
    tickInterval = setInterval(() => setTick((t) => t + 1), 1000);
  });

  onCleanup(() => {
    clearInterval(tickInterval);
  });

  // Update scroll info when logs change
  createEffect(() => {
    const logs = visibleLogs();
    if (following()) {
      setScrollInfo({ current: logs.length, total: logs.length });
    }
  });

  // Keyboard handling
  useKeyboard(
    (event: { name: string; ctrl: boolean; shift: boolean; preventDefault: () => void }) => {
      if (showHelp()) {
        setShowHelp(false);
        event.preventDefault();
        return;
      }

      switch (event.name) {
        case "q":
          if (!event.ctrl) {
            // Quit - stop all services and exit
            props.manager.stopAll().then(() => process.exit(0));
            event.preventDefault();
          }
          break;

        case "up":
        case "k":
          selectPrev();
          event.preventDefault();
          break;

        case "down":
        case "j":
          selectNext();
          event.preventDefault();
          break;

        case "s":
          // Start selected service
          const toStart = selectedService();
          if (toStart) {
            props.manager.start(toStart.name).catch(console.error);
          }
          event.preventDefault();
          break;

        case "x":
          if (event.shift) {
            // Stop all
            props.manager.stopAll().catch(console.error);
          } else {
            // Stop selected
            const toStop = selectedService();
            if (toStop) {
              props.manager.stop(toStop.name).catch(console.error);
            }
          }
          event.preventDefault();
          break;

        case "r":
          if (event.shift) {
            // Restart all
            props.manager.restartAll().catch(console.error);
          } else {
            // Restart selected
            const toRestart = selectedService();
            if (toRestart) {
              props.manager.restart(toRestart.name).catch(console.error);
            }
          }
          event.preventDefault();
          break;

        case "a":
          // Start all
          props.manager.startAll().catch(console.error);
          event.preventDefault();
          break;

        case "tab":
          // Toggle view mode
          setViewMode((m) => (m === "single" ? "all" : "single"));
          event.preventDefault();
          break;

        case "c":
          // Clear logs
          const toClear = selectedService();
          if (toClear) {
            clearLogs(toClear.name);
          }
          event.preventDefault();
          break;

        case "f":
          // Toggle follow mode
          setFollowing((f) => !f);
          event.preventDefault();
          break;

        case "?":
          setShowHelp(true);
          event.preventDefault();
          break;

        // Log scrolling
        case "pageup":
          pageUp();
          event.preventDefault();
          break;

        case "pagedown":
          pageDown();
          event.preventDefault();
          break;

        case "g":
          if (event.shift) {
            // G - scroll to bottom
            scrollToBottom();
          } else {
            // g - scroll to top
            scrollToTop();
          }
          event.preventDefault();
          break;

        case "u":
          if (event.ctrl) {
            // Ctrl+U - half page up
            scrollUp(Math.floor((contentHeight() - 2) / 2));
            event.preventDefault();
          }
          break;

        case "d":
          if (event.ctrl) {
            // Ctrl+D - half page down
            scrollDown(Math.floor((contentHeight() - 2) / 2));
            event.preventDefault();
          }
          break;

        // Config reload
        case "l":
          if (event.ctrl) {
            // Ctrl+L - reload config
            setStatusMessage("Reloading config...");
            props.manager
              .reloadConfig()
              .then((result) => {
                const changes = [
                  result.added.length > 0 ? `+${result.added.length}` : "",
                  result.removed.length > 0 ? `-${result.removed.length}` : "",
                  result.modified.length > 0 ? `~${result.modified.length}` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                setStatusMessage(changes ? `Reloaded: ${changes}` : "Config unchanged");
                setTimeout(() => setStatusMessage(null), 3000);
              })
              .catch((err) => {
                setStatusMessage(`Reload failed: ${err.message}`);
                setTimeout(() => setStatusMessage(null), 5000);
              });
            event.preventDefault();
          }
          break;

        // Group operations
        case "space":
        case " ":
          // Toggle group collapsed (if current service is in a group)
          const group = selectedGroup();
          if (group) {
            toggleGroupCollapsed(group);
          }
          event.preventDefault();
          break;

        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          // Quick group operations with number keys + shift
          if (event.shift) {
            const groupIdx = parseInt(event.name) - 1;
            const groups = Array.from(props.manager.getGroups().keys());
            if (groupIdx < groups.length) {
              const groupName = groups[groupIdx]!;
              // Start the group
              props.manager.startGroup(groupName).catch(console.error);
            }
          }
          break;
      }
    },
  );

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg="cyan" attributes={TextAttributes.BOLD}>
          DevProc
        </text>
        <text fg="gray"> - </text>
        <text>{props.projectName}</text>
        <box flexGrow={1} />
        <text fg="gray">{new Date().toLocaleTimeString()}</text>
      </box>

      {/* Main content */}
      <box flexDirection="row" flexGrow={1}>
        {/* Service list */}
        <box width={sidebarWidth()} flexDirection="column" borderStyle="rounded" borderColor="gray">
          <box height={1} paddingLeft={1} flexDirection="row">
            <text fg="cyan" attributes={TextAttributes.BOLD}>
              Services
            </text>
            <box flexGrow={1} />
            <Show when={statusMessage()}>
              <text fg="yellow">{statusMessage()}</text>
            </Show>
          </box>
          <box flexDirection="column" flexGrow={1}>
            <For each={displayItems()}>
              {(item) => (
                <Switch>
                  <Match when={item.type === "group"}>
                    {(() => {
                      const groupItem = item as DisplayItem & { type: "group" };
                      const collapsed = isGroupCollapsed(groupItem.group.name);
                      const runningCount = groupItem.services.filter(
                        (s) => s.status === "running" || s.status === "healthy",
                      ).length;
                      return (
                        <box height={1} paddingLeft={1} paddingRight={1} flexDirection="row">
                          <text fg="magenta">{collapsed ? "▸" : "▾"}</text>
                          <text> </text>
                          <text fg="magenta" attributes={TextAttributes.BOLD}>
                            {groupItem.group.name}
                          </text>
                          <text fg="gray">
                            {" "}
                            ({runningCount}/{groupItem.services.length})
                          </text>
                        </box>
                      );
                    })()}
                  </Match>
                  <Match when={item.type === "service"}>
                    {(() => {
                      const serviceItem = item as DisplayItem & { type: "service" };
                      const service = serviceItem.service;
                      const isSelected = selectedName() === service.name;
                      const indent = serviceItem.group ? "  " : "";
                      return (
                        <box height={1} paddingLeft={1} paddingRight={1} flexDirection="row">
                          <text>{indent}</text>
                          <text fg={STATUS_COLORS[service.status]}>
                            {STATUS_SYMBOLS[service.status]}
                          </text>
                          <text> </text>
                          <text
                            fg={isSelected ? "white" : undefined}
                            attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}
                            flexGrow={1}
                          >
                            {service.name}
                          </text>
                          <text fg="gray">{service.port ? `:${service.port}` : ""}</text>
                          <text> </text>
                          <text fg="gray">{formatUptime(service.startedAt)}</text>
                        </box>
                      );
                    })()}
                  </Match>
                </Switch>
              )}
            </For>
          </box>
        </box>

        {/* Log panel */}
        <box flexGrow={1} flexDirection="column" borderStyle="rounded" borderColor="gray">
          <box height={1} paddingLeft={1} flexDirection="row">
            <text fg="cyan" attributes={TextAttributes.BOLD}>
              Logs{" "}
              {viewMode() === "single" && selectedService()
                ? `(${selectedService()!.name})`
                : "(all)"}
            </text>
            <box flexGrow={1} />
            <Show when={!following() && scrollInfo().total > 0}>
              <text fg="gray">
                {scrollInfo().current}/{scrollInfo().total}{" "}
              </text>
            </Show>
            <text fg={following() ? "green" : "gray"}>{following() ? "[follow]" : "[scroll]"}</text>
          </box>
          <scrollbox
            ref={(el: ScrollBoxRenderable) => (scrollboxRef = el)}
            flexGrow={1}
            stickyScroll={following()}
            stickyStart="bottom"
          >
            <box flexDirection="column">
              <For each={visibleLogs()}>
                {(log) => (
                  <box height={1} paddingLeft={1} flexDirection="row">
                    <text fg="gray">[{formatLogTime(log.timestamp)}]</text>
                    <text> </text>
                    <Show when={viewMode() === "all"}>
                      <text fg="cyan">{log.service}</text>
                      <text fg="gray"> | </text>
                    </Show>
                    <text fg={log.stream === "stderr" ? "red" : undefined}>{log.content}</text>
                  </box>
                )}
              </For>
            </box>
          </scrollbox>
        </box>
      </box>

      {/* Footer / Status bar */}
      <box height={1} paddingLeft={1} paddingRight={1} flexDirection="row">
        <text fg="gray">[s]</text>
        <text>tart </text>
        <text fg="gray">[x]</text>
        <text>stop </text>
        <text fg="gray">[r]</text>
        <text>estart </text>
        <text fg="gray">[a]</text>
        <text>ll </text>
        <text fg="gray">| </text>
        <text fg="gray">[c]</text>
        <text>lear </text>
        <text fg="gray">[f]</text>
        <text>ollow </text>
        <text fg="gray">| </text>
        <text fg="gray">[?]</text>
        <text>help </text>
        <text fg="gray">[q]</text>
        <text>uit</text>
      </box>

      {/* Help modal */}
      <Show when={showHelp()}>
        <box
          position="absolute"
          top="25%"
          left="25%"
          width="50%"
          height="50%"
          borderStyle="rounded"
          borderColor="cyan"
          backgroundColor="#1e1e1e"
          flexDirection="column"
          padding={1}
        >
          <text fg="cyan" attributes={TextAttributes.BOLD}>
            Keyboard Shortcuts
          </text>
          <text> </text>
          <text fg="yellow">Services</text>
          <text>↑/↓ j/k Navigate | s Start | x Stop | r Restart</text>
          <text>a Start all | X Stop all | R Restart all</text>
          <text>Space Toggle group collapsed</text>
          <text> </text>
          <text fg="yellow">Logs</text>
          <text>Tab Toggle view | c Clear | f Follow</text>
          <text>g/G Top/bottom | PgUp/PgDn | Ctrl+u/d</text>
          <text> </text>
          <text fg="yellow">Config</text>
          <text>Ctrl+L Reload config from disk</text>
          <text> </text>
          <text>? Help | q Quit</text>
          <text> </text>
          <text fg="gray">Press any key to close</text>
        </box>
      </Show>
    </box>
  );
}

export default App;
