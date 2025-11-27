import { createSignal, createEffect, onMount, onCleanup, For, Show, Switch, Match } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { ProcessManager } from "./process/manager"
import { useServices, type DisplayItem } from "./ui/hooks/useServices"
import { useLogs, type SearchMatch } from "./ui/hooks/useLogs"
import { formatBytes, formatCpu, generateSparkline } from "./process/resources"
import { copyToClipboard } from "./utils/clipboard"

interface AppProps {
  manager: ProcessManager
  projectName: string
}

// Spinner frames for animated status
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Status indicator symbols and colors
const STATUS_SYMBOLS = {
  stopped: "○",
  starting: "◐",
  running: "●",
  healthy: "●",
  stopping: "◑",
  crashed: "✗",
  failed: "✗",
} as const

const STATUS_COLORS = {
  stopped: "gray",
  starting: "yellow",
  running: "blue",
  healthy: "green",
  stopping: "yellow",
  crashed: "red",
  failed: "red",
} as const

// Format uptime
function formatUptime(startedAt?: Date): string {
  if (!startedAt) return "   "
  const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`.padStart(3)
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`.padStart(3)
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`.padStart(3)
  return `${Math.floor(seconds / 86400)}d`.padStart(3)
}

// Format timestamp for logs
function formatLogTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function App(props: AppProps) {
  const dimensions = useTerminalDimensions()
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
  } = useServices(props.manager)
  const {
    getServiceLogs,
    clearLogs,
    filteredLogs,
    searchQuery,
    setSearchQuery,
    getSearchMatches,
    currentMatchIndex,
    setCurrentMatchIndex,
    nextMatch,
    prevMatch,
    clearSearch,
    isSearchActive,
    exportLogs,
    logs,
  } = useLogs(props.manager)

  // Status message for reload feedback
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null)

  const [viewMode, setViewMode] = createSignal<"single" | "all">("single")
  const [showHelp, setShowHelp] = createSignal(false)
  const [following, setFollowing] = createSignal(true)

  // Search mode state
  const [searchMode, setSearchMode] = createSignal(false)
  const [searchInput, setSearchInput] = createSignal("")

  // Service details panel
  const [showDetails, setShowDetails] = createSignal(false)

  // Resource graph view
  const [showResourceGraph, setShowResourceGraph] = createSignal(false)

  // Spinner animation state
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)

  // Scrollbox ref for manual scrolling
  let scrollboxRef: ScrollBoxRenderable | undefined

  // Scroll position for indicator (updated when scrolling)
  const [scrollInfo, setScrollInfo] = createSignal({ current: 0, total: 0 })

  // Calculate layout dimensions
  const sidebarWidth = () => Math.min(30, Math.floor(dimensions().width * 0.3))
  const contentHeight = () => dimensions().height - 3 // Header and footer

  // Get visible logs - return all logs, let scrollbox handle windowing
  const visibleLogs = () => {
    const selected = selectedService()
    if (viewMode() === "single" && selected) {
      return getServiceLogs(selected.name)
    }
    return filteredLogs()
  }

  // Compute search matches based on visible logs
  const searchMatches = () => getSearchMatches(visibleLogs())

  // Clear search when switching services or view mode
  const [lastSelectedName, setLastSelectedName] = createSignal<string | null>(null)
  const [lastViewMode, setLastViewMode] = createSignal<"single" | "all">("single")

  createEffect(() => {
    const currentName = selectedName()
    const currentViewMode = viewMode()
    const prevName = lastSelectedName()
    const prevViewMode = lastViewMode()

    // Clear search if service or view mode changed
    if ((currentName !== prevName || currentViewMode !== prevViewMode) && isSearchActive()) {
      clearSearch()
    }

    setLastSelectedName(currentName)
    setLastViewMode(currentViewMode)
  })

  // Update scroll info from scrollbox
  const updateScrollInfo = () => {
    if (scrollboxRef) {
      const total = visibleLogs().length
      const viewportHeight = contentHeight() - 2
      const scrollTop = scrollboxRef.scrollTop
      // Approximate current line based on scroll position
      const current = Math.min(scrollTop + viewportHeight, total)
      setScrollInfo({ current, total })
    }
  }

  // Scroll helper functions
  const scrollUp = (lines = 1) => {
    if (scrollboxRef) {
      scrollboxRef.scrollBy(-lines)
      setFollowing(false)
      updateScrollInfo()
    }
  }

  const scrollDown = (lines = 1) => {
    if (scrollboxRef) {
      scrollboxRef.scrollBy(lines)
      // Check if we're at the bottom to re-enable following
      const atBottom = scrollboxRef.scrollTop >= scrollboxRef.scrollHeight - contentHeight()
      if (atBottom) {
        setFollowing(true)
      }
      updateScrollInfo()
    }
  }

  const scrollToTop = () => {
    if (scrollboxRef) {
      scrollboxRef.scrollTo(0)
      setFollowing(false)
      updateScrollInfo()
    }
  }

  const scrollToBottom = () => {
    if (scrollboxRef) {
      scrollboxRef.scrollTo(scrollboxRef.scrollHeight)
      setFollowing(true)
      updateScrollInfo()
    }
  }

  const pageUp = () => {
    scrollUp(contentHeight() - 2)
  }

  const pageDown = () => {
    scrollDown(contentHeight() - 2)
  }

  // Update uptime display periodically
  const [, setTick] = createSignal(0)
  let tickInterval: Timer
  let spinnerInterval: Timer

  onMount(() => {
    tickInterval = setInterval(() => setTick((t) => t + 1), 1000)
    // Spinner animation at 80ms intervals
    spinnerInterval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
  })

  onCleanup(() => {
    clearInterval(tickInterval)
    clearInterval(spinnerInterval)
  })

  // Get animated spinner symbol for starting/stopping states
  const getStatusSymbol = (status: keyof typeof STATUS_SYMBOLS) => {
    if (status === "starting" || status === "stopping") {
      return SPINNER_FRAMES[spinnerFrame()]!
    }
    return STATUS_SYMBOLS[status]
  }

  // Update scroll info when logs change
  createEffect(() => {
    const logs = visibleLogs()
    if (following()) {
      setScrollInfo({ current: logs.length, total: logs.length })
    }
  })

  // Handle search input submission
  const submitSearch = () => {
    const query = searchInput()
    if (query) {
      setSearchQuery(query)
      setCurrentMatchIndex(0)
      // Scroll to first match after query is set
      setTimeout(() => {
        const matches = searchMatches()
        if (matches.length > 0 && scrollboxRef) {
          scrollboxRef.scrollTo(matches[0]!.logIndex)
          setFollowing(false)
        }
      }, 0)
    }
    setSearchMode(false)
    setSearchInput("")
  }

  // Export logs to file
  const handleExport = async (allLogs: boolean) => {
    const service = allLogs ? undefined : selectedService()?.name
    const filename = service ? `devproc-${service}-${Date.now()}.log` : `devproc-all-${Date.now()}.log`

    const content = exportLogs(service, "plain")

    try {
      await Bun.write(filename, content)
      setStatusMessage(`Exported to ${filename}`)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      setStatusMessage(`Export failed: ${err}`)
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  // Copy last log line to clipboard
  const handleCopyLog = async () => {
    const logs = visibleLogs()
    if (logs.length === 0) {
      setStatusMessage("No logs to copy")
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }

    // Get the last log line
    const lastLog = logs[logs.length - 1]!
    const time = formatLogTime(lastLog.timestamp)
    const logLine = `[${time}] ${lastLog.service} | ${lastLog.content}`

    const success = await copyToClipboard(logLine)
    if (success) {
      setStatusMessage("Copied to clipboard")
    } else {
      setStatusMessage("Copy failed")
    }
    setTimeout(() => setStatusMessage(null), 2000)
  }

  // Copy all visible logs to clipboard
  const handleCopyAllLogs = async () => {
    const logs = visibleLogs()
    if (logs.length === 0) {
      setStatusMessage("No logs to copy")
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }

    const content = logs
      .map((log) => {
        const time = formatLogTime(log.timestamp)
        return `[${time}] ${log.service} | ${log.content}`
      })
      .join("\n")

    const success = await copyToClipboard(content)
    if (success) {
      setStatusMessage(`Copied ${logs.length} lines`)
    } else {
      setStatusMessage("Copy failed")
    }
    setTimeout(() => setStatusMessage(null), 2000)
  }

  // Keyboard handling
  useKeyboard((event: { name: string; ctrl: boolean; shift: boolean; preventDefault: () => void }) => {
    // Handle search mode input
    if (searchMode()) {
      if (event.name === "escape") {
        setSearchMode(false)
        setSearchInput("")
        event.preventDefault()
        return
      }
      if (event.name === "return" || event.name === "enter") {
        submitSearch()
        event.preventDefault()
        return
      }
      if (event.name === "backspace") {
        setSearchInput((prev) => prev.slice(0, -1))
        event.preventDefault()
        return
      }
      // Add character to search input
      if (event.name.length === 1 && !event.ctrl) {
        setSearchInput((prev) => prev + event.name)
        event.preventDefault()
        return
      }
      return
    }

    if (showHelp()) {
      setShowHelp(false)
      event.preventDefault()
      return
    }

    if (showDetails()) {
      setShowDetails(false)
      event.preventDefault()
      return
    }

    switch (event.name) {
      case "q":
        if (!event.ctrl) {
          // Quit - stop all services and exit
          props.manager.stopAll().then(() => process.exit(0))
          event.preventDefault()
        }
        break

      case "up":
      case "k":
        selectPrev()
        event.preventDefault()
        break

      case "down":
      case "j":
        selectNext()
        event.preventDefault()
        break

      case "s":
        // Start selected service
        const toStart = selectedService()
        if (toStart) {
          props.manager.start(toStart.name).catch(console.error)
        }
        event.preventDefault()
        break

      case "x":
        if (event.shift) {
          // Stop all
          props.manager.stopAll().catch(console.error)
        } else {
          // Stop selected
          const toStop = selectedService()
          if (toStop) {
            props.manager.stop(toStop.name).catch(console.error)
          }
        }
        event.preventDefault()
        break

      case "r":
        if (event.shift) {
          // Restart all
          props.manager.restartAll().catch(console.error)
        } else {
          // Restart selected
          const toRestart = selectedService()
          if (toRestart) {
            props.manager.restart(toRestart.name).catch(console.error)
          }
        }
        event.preventDefault()
        break

      case "a":
        // Start all
        props.manager.startAll().catch(console.error)
        event.preventDefault()
        break

      case "tab":
        // Toggle view mode
        setViewMode((m) => (m === "single" ? "all" : "single"))
        event.preventDefault()
        break

      case "c":
        // Clear logs
        const toClear = selectedService()
        if (toClear) {
          clearLogs(toClear.name)
        }
        event.preventDefault()
        break

      case "f":
        // Toggle follow mode
        setFollowing((f) => !f)
        event.preventDefault()
        break

      case "?":
        setShowHelp(true)
        event.preventDefault()
        break

      // Log scrolling
      case "pageup":
        pageUp()
        event.preventDefault()
        break

      case "pagedown":
        pageDown()
        event.preventDefault()
        break

      case "g":
        if (event.shift) {
          // G - scroll to bottom
          scrollToBottom()
        } else {
          // g - scroll to top
          scrollToTop()
        }
        event.preventDefault()
        break

      case "u":
        if (event.ctrl) {
          // Ctrl+U - half page up
          scrollUp(Math.floor((contentHeight() - 2) / 2))
          event.preventDefault()
        }
        break

      case "d":
        if (event.ctrl) {
          // Ctrl+D - half page down
          scrollDown(Math.floor((contentHeight() - 2) / 2))
          event.preventDefault()
        }
        break

      // Config reload
      case "l":
        if (event.ctrl) {
          // Ctrl+L - reload config
          setStatusMessage("Reloading config...")
          props.manager
            .reloadConfig()
            .then((result) => {
              const changes = [
                result.added.length > 0 ? `+${result.added.length}` : "",
                result.removed.length > 0 ? `-${result.removed.length}` : "",
                result.modified.length > 0 ? `~${result.modified.length}` : "",
              ]
                .filter(Boolean)
                .join(" ")
              setStatusMessage(changes ? `Reloaded: ${changes}` : "Config unchanged")
              setTimeout(() => setStatusMessage(null), 3000)
            })
            .catch((err) => {
              setStatusMessage(`Reload failed: ${err.message}`)
              setTimeout(() => setStatusMessage(null), 5000)
            })
          event.preventDefault()
        }
        break

      // Group operations
      case "space":
      case " ":
        // Toggle group collapsed (if current service is in a group)
        const group = selectedGroup()
        if (group) {
          toggleGroupCollapsed(group)
        }
        event.preventDefault()
        break

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
          const groupIdx = parseInt(event.name) - 1
          const groups = Array.from(props.manager.getGroups().keys())
          if (groupIdx < groups.length) {
            const groupName = groups[groupIdx]!
            // Start the group
            props.manager.startGroup(groupName).catch(console.error)
          }
        }
        break

      // Search
      case "/":
        setSearchMode(true)
        setSearchInput("")
        event.preventDefault()
        break

      case "n":
        // Next search match
        if (isSearchActive()) {
          const matches = searchMatches()
          nextMatch(matches.length)
          // Get updated index after nextMatch
          setTimeout(() => {
            const idx = currentMatchIndex()
            if (matches.length > 0 && scrollboxRef && matches[idx]) {
              scrollboxRef.scrollTo(matches[idx]!.logIndex)
              setFollowing(false)
            }
          }, 0)
        }
        event.preventDefault()
        break

      case "p":
        if (event.shift) {
          // Previous match (N in vim)
          if (isSearchActive()) {
            const matches = searchMatches()
            prevMatch(matches.length)
            // Get updated index after prevMatch
            setTimeout(() => {
              const idx = currentMatchIndex()
              if (matches.length > 0 && scrollboxRef && matches[idx]) {
                scrollboxRef.scrollTo(matches[idx]!.logIndex)
                setFollowing(false)
              }
            }, 0)
          }
          event.preventDefault()
        }
        break

      case "escape":
        // Clear search
        if (isSearchActive()) {
          clearSearch()
        }
        event.preventDefault()
        break

      // Export logs
      case "e":
        if (event.shift) {
          // Export all logs
          handleExport(true)
        } else {
          // Export current service logs
          handleExport(false)
        }
        event.preventDefault()
        break

      // Service details
      case "i":
        setShowDetails(true)
        event.preventDefault()
        break

      // Resource graph toggle
      case "m":
        setShowResourceGraph((prev) => !prev)
        event.preventDefault()
        break

      // Copy to clipboard
      case "y":
        if (event.shift) {
          // Y - copy all visible logs
          handleCopyAllLogs()
        } else {
          // y - copy last log line
          handleCopyLog()
        }
        event.preventDefault()
        break
    }
  })

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
                      const groupItem = item as DisplayItem & { type: "group" }
                      const collapsed = isGroupCollapsed(groupItem.group.name)
                      const runningCount = groupItem.services.filter(
                        (s) => s.status === "running" || s.status === "healthy",
                      ).length
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
                      )
                    })()}
                  </Match>
                  <Match when={item.type === "service"}>
                    {(() => {
                      const serviceItem = item as DisplayItem & { type: "service" }
                      const service = serviceItem.service
                      const isSelected = selectedName() === service.name
                      const indent = serviceItem.group ? "  " : ""
                      const restartBadge = service.restartCount > 0 ? `↻${service.restartCount}` : ""
                      const resources = service.resources
                      const isRunning = service.status === "running" || service.status === "healthy"
                      return (
                        <box height={1} paddingLeft={1} paddingRight={1} flexDirection="row">
                          <text>{indent}</text>
                          <text fg={STATUS_COLORS[service.status]}>{getStatusSymbol(service.status)}</text>
                          <text> </text>
                          <text
                            fg={isSelected ? "white" : undefined}
                            attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}
                            flexGrow={1}
                          >
                            {service.name}
                          </text>
                          <Show when={restartBadge}>
                            <text fg="yellow">{restartBadge} </text>
                          </Show>
                          <Show when={isRunning && resources}>
                            <text fg={resources!.cpu > 80 ? "red" : resources!.cpu > 50 ? "yellow" : "cyan"}>
                              {formatCpu(resources!.cpu).padStart(5)}
                            </text>
                            <text> </text>
                            <text fg="cyan">{formatBytes(resources!.memory).padStart(7)}</text>
                            <text> </text>
                          </Show>
                          <text fg="gray">{service.port ? `:${service.port}` : ""}</text>
                          <text> </text>
                          <text fg="gray">{formatUptime(service.startedAt)}</text>
                        </box>
                      )
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
            <Show
              when={showResourceGraph()}
              fallback={
                <text fg="cyan" attributes={TextAttributes.BOLD}>
                  Logs {viewMode() === "single" && selectedService() ? `(${selectedService()!.name})` : "(all)"}
                </text>
              }
            >
              <text fg="cyan" attributes={TextAttributes.BOLD}>
                Resources {selectedService() ? `(${selectedService()!.name})` : ""}
              </text>
            </Show>
            <box flexGrow={1} />
            <Show when={!showResourceGraph() && isSearchActive()}>
              <text fg="yellow">
                /{searchQuery()} [{currentMatchIndex() + 1}/{searchMatches().length}]{" "}
              </text>
            </Show>
            <Show when={!showResourceGraph() && searchMode()}>
              <text fg="cyan">/{searchInput()}_</text>
            </Show>
            <Show when={!showResourceGraph() && !searchMode() && !following() && scrollInfo().total > 0}>
              <text fg="gray">
                {scrollInfo().current}/{scrollInfo().total}{" "}
              </text>
            </Show>
            <Show when={!showResourceGraph()}>
              <text fg={following() ? "green" : "gray"}>{following() ? "[follow]" : "[scroll]"}</text>
            </Show>
            <Show when={showResourceGraph()}>
              <text fg="cyan">[m] logs</text>
            </Show>
          </box>

          {/* Resource graph view */}
          <Show when={showResourceGraph() && selectedService()}>
            {(() => {
              const service = selectedService()!
              const history = props.manager.getResourceHistory(service.name)
              const cpuValues = history.map((h) => h.cpu)
              const memValues = history.map((h) => h.memory / (1024 * 1024)) // Convert to MB for display
              const resources = service.resources

              return (
                <box flexDirection="column" padding={1} flexGrow={1}>
                  <text fg="yellow" attributes={TextAttributes.BOLD}>
                    CPU Usage
                  </text>
                  <box height={1} flexDirection="row">
                    <text fg="cyan">{generateSparkline(cpuValues, 50)}</text>
                    <text> </text>
                    <text
                      fg={
                        resources && resources.cpu > 80 ? "red" : resources && resources.cpu > 50 ? "yellow" : "green"
                      }
                    >
                      {resources ? formatCpu(resources.cpu) : "N/A"}
                    </text>
                  </box>
                  <text> </text>
                  <text fg="yellow" attributes={TextAttributes.BOLD}>
                    Memory Usage
                  </text>
                  <box height={1} flexDirection="row">
                    <text fg="magenta">{generateSparkline(memValues, 50)}</text>
                    <text> </text>
                    <text fg="green">{resources ? formatBytes(resources.memory) : "N/A"}</text>
                  </box>
                  <text> </text>
                  <text fg="gray">
                    History: {history.length} samples ({history.length}s)
                  </text>
                  <Show when={resources}>
                    <text fg="gray">Memory %: {resources!.memoryPercent.toFixed(1)}% of system</text>
                  </Show>
                  <box flexGrow={1} />
                  <text fg="gray">Press [m] to return to logs</text>
                </box>
              )
            })()}
          </Show>

          {/* Logs view */}
          <Show when={!showResourceGraph()}>
            <scrollbox
              ref={(el: ScrollBoxRenderable) => (scrollboxRef = el)}
              flexGrow={1}
              stickyScroll={following()}
              stickyStart="bottom"
            >
              <box flexDirection="column">
                <For each={visibleLogs()}>
                  {(log, logIdx) => {
                    // Reactive accessors for search matches - must be functions for SolidJS reactivity
                    const matches = () => searchMatches().filter((m) => m.logIndex === logIdx())
                    const currentMatch = () => searchMatches()[currentMatchIndex()]
                    const isCurrentMatchLine = () => currentMatch()?.logIndex === logIdx()

                    // Compute highlighted parts reactively
                    const highlightedParts = () => {
                      const m = matches()
                      if (m.length === 0) return null

                      const content = log.content
                      const parts: { text: string; highlight: boolean; isCurrent: boolean }[] = []
                      let lastEnd = 0
                      const current = currentMatch()
                      const isCurrentLine = isCurrentMatchLine()

                      m.forEach((match) => {
                        if (match.startIndex > lastEnd) {
                          parts.push({
                            text: content.slice(lastEnd, match.startIndex),
                            highlight: false,
                            isCurrent: false,
                          })
                        }
                        parts.push({
                          text: content.slice(match.startIndex, match.endIndex),
                          highlight: true,
                          isCurrent: isCurrentLine && match === current,
                        })
                        lastEnd = match.endIndex
                      })

                      if (lastEnd < content.length) {
                        parts.push({
                          text: content.slice(lastEnd),
                          highlight: false,
                          isCurrent: false,
                        })
                      }

                      return parts
                    }

                    return (
                      <box height={1} paddingLeft={1} flexDirection="row">
                        <text fg="gray">[{formatLogTime(log.timestamp)}]</text>
                        <text> </text>
                        <Show when={viewMode() === "all"}>
                          <text fg="cyan">{log.service}</text>
                          <text fg="gray"> | </text>
                        </Show>
                        <Show
                          when={highlightedParts()}
                          fallback={<text fg={log.stream === "stderr" ? "red" : undefined}>{log.content}</text>}
                        >
                          {(parts: () => { text: string; highlight: boolean; isCurrent: boolean }[]) => (
                            <box flexDirection="row">
                              <For each={parts()}>
                                {(part) => (
                                  <Show
                                    when={part.highlight}
                                    fallback={<text fg={log.stream === "stderr" ? "red" : undefined}>{part.text}</text>}
                                  >
                                    <box backgroundColor={part.isCurrent ? "#ffff00" : "#555500"}>
                                      <text fg="black">{part.text}</text>
                                    </box>
                                  </Show>
                                )}
                              </For>
                            </box>
                          )}
                        </Show>
                      </box>
                    )
                  }}
                </For>
              </box>
            </scrollbox>
          </Show>
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
        <text fg="gray">[m]</text>
        <text>onitor </text>
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
          top="20%"
          left="20%"
          width="60%"
          height="60%"
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
          <text>Space Toggle group | i Service info</text>
          <text> </text>
          <text fg="yellow">Logs</text>
          <text>Tab Toggle view | c Clear | f Follow | m Monitor</text>
          <text>g/G Top/bottom | PgUp/PgDn | Ctrl+u/d</text>
          <text>e Export service logs | E Export all logs</text>
          <text> </text>
          <text fg="yellow">Search</text>
          <text>/ Start search | n Next match | N Prev match</text>
          <text>Esc Clear search</text>
          <text> </text>
          <text fg="yellow">Clipboard</text>
          <text>y Copy last log | Y Copy all visible logs</text>
          <text> </text>
          <text fg="yellow">Config</text>
          <text>Ctrl+L Reload config from disk</text>
          <text> </text>
          <text>? Help | q Quit</text>
          <text> </text>
          <text fg="gray">Press any key to close</text>
        </box>
      </Show>

      {/* Service Details modal */}
      <Show when={showDetails() && selectedService()}>
        {(() => {
          const service = selectedService()!
          const config = props.manager.getServiceConfig(service.name)
          const uptime = service.startedAt ? Math.floor((Date.now() - service.startedAt.getTime()) / 1000) : 0
          const uptimeStr = service.startedAt
            ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`
            : "N/A"

          // Mask sensitive env values
          const envEntries = config
            ? Object.entries(config.env).map(([key, value]) => {
                const isSensitive =
                  key.toLowerCase().includes("password") ||
                  key.toLowerCase().includes("secret") ||
                  key.toLowerCase().includes("key") ||
                  key.toLowerCase().includes("token")
                return [key, isSensitive ? "********" : value]
              })
            : []

          return (
            <box
              position="absolute"
              top="15%"
              left="15%"
              width="70%"
              height="70%"
              borderStyle="rounded"
              borderColor="cyan"
              backgroundColor="#1e1e1e"
              flexDirection="column"
              padding={1}
            >
              <text fg="cyan" attributes={TextAttributes.BOLD}>
                Service Details: {service.name}
              </text>
              <text> </text>
              <text fg="yellow">Status</text>
              <text>
                Status: {service.status} | PID: {service.pid || "N/A"} | Restarts: {service.restartCount}
              </text>
              <text>Uptime: {uptimeStr}</text>
              <Show when={service.exitCode !== undefined}>
                <text>Last Exit Code: {service.exitCode}</text>
              </Show>
              <Show when={service.error}>
                <text fg="red">Error: {service.error}</text>
              </Show>
              <text> </text>
              <text fg="yellow">Configuration</text>
              <text>Command: {config?.cmd || "N/A"}</text>
              <text>Working Dir: {config?.cwd || "N/A"}</text>
              <text>Restart Policy: {config?.restart || "no"}</text>
              <Show when={config?.group}>
                <text>Group: {config?.group}</text>
              </Show>
              <text> </text>
              <text fg="yellow">Environment ({envEntries.length} vars)</text>
              <box flexDirection="column" height={5}>
                <For each={envEntries.slice(0, 5)}>
                  {([key, value]) => (
                    <text fg="gray">
                      {key}={value}
                    </text>
                  )}
                </For>
                <Show when={envEntries.length > 5}>
                  <text fg="gray">... and {envEntries.length - 5} more</text>
                </Show>
              </box>
              <text> </text>
              <text fg="gray">Press any key to close</text>
            </box>
          )
        })()}
      </Show>
    </box>
  )
}

export default App
