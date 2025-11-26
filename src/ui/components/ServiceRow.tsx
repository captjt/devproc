import { type Component } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { ServiceState, ServiceStatus } from "../../process/types";

interface ServiceRowProps {
  service: ServiceState;
  selected: boolean;
  width: number;
}

// Status indicator symbols
const STATUS_SYMBOLS: Record<ServiceStatus, string> = {
  stopped: "○",
  starting: "◐",
  running: "●",
  healthy: "●",
  stopping: "◑",
  crashed: "✗",
  failed: "✗",
};

// Status colors
const STATUS_COLORS: Record<ServiceStatus, string> = {
  stopped: "gray",
  starting: "yellow",
  running: "blue",
  healthy: "green",
  stopping: "yellow",
  crashed: "red",
  failed: "red",
};

// Format uptime
function formatUptime(startedAt?: Date): string {
  if (!startedAt) return "";

  const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export const ServiceRow: Component<ServiceRowProps> = (props) => {
  const statusSymbol = () => STATUS_SYMBOLS[props.service.status];
  const statusColor = () => STATUS_COLORS[props.service.status];
  const uptime = () => formatUptime(props.service.startedAt);
  const port = () => (props.service.port ? `:${props.service.port}` : "");

  // Build the display string
  const displayName = () => {
    const name = props.service.name;

    // Truncate name if needed
    const maxNameLen = props.width - 15; // Leave room for port and uptime
    const truncatedName = name.length > maxNameLen ? name.slice(0, maxNameLen - 1) + "…" : name;

    return truncatedName;
  };

  return (
    <box flexDirection="row" width="100%" height={1} paddingLeft={1} paddingRight={1}>
      <text fg={statusColor()}>{statusSymbol()}</text>
      <text> </text>
      <text
        fg={props.selected ? "white" : undefined}
        attributes={props.selected ? TextAttributes.BOLD : TextAttributes.NONE}
        flexGrow={1}
      >
        {displayName()}
      </text>
      <text fg="gray">{port()}</text>
      <text> </text>
      <text fg="gray">{uptime()}</text>
    </box>
  );
};

export default ServiceRow;
