/**
 * ANSI color codes for terminal output
 */

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
} as const;

export type ColorName = keyof typeof colors;

/**
 * Wrap text with a color
 */
export function colorize(text: string, color: ColorName): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Get color code for a named color from config
 */
export function getServiceColor(colorName?: string): string {
  if (!colorName) return "";

  const normalizedName = colorName.toLowerCase();
  const colorCode = colors[normalizedName as ColorName];

  return colorCode || "";
}

/**
 * Strip ANSI escape codes from text
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Calculate visible width of a string (accounting for ANSI codes)
 */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

/**
 * Truncate text to a maximum visible width, preserving ANSI codes
 */
export function truncate(text: string, maxWidth: number, ellipsis = "..."): string {
  const stripped = stripAnsi(text);

  if (stripped.length <= maxWidth) {
    return text;
  }

  const targetLength = maxWidth - ellipsis.length;
  if (targetLength <= 0) {
    return ellipsis.slice(0, maxWidth);
  }

  // Simple approach: strip, truncate, and lose color codes
  // A more complex approach would preserve ANSI codes
  return stripped.slice(0, targetLength) + ellipsis;
}

/**
 * Pad text to a specific visible width
 */
export function pad(
  text: string,
  width: number,
  align: "left" | "right" | "center" = "left",
): string {
  const visible = visibleLength(text);

  if (visible >= width) {
    return text;
  }

  const padding = width - visible;

  switch (align) {
    case "left":
      return text + " ".repeat(padding);
    case "right":
      return " ".repeat(padding) + text;
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
  }
}

/**
 * Status indicator symbols
 */
export const statusSymbols = {
  stopped: "○",
  starting: "◐",
  running: "●",
  healthy: "●",
  stopping: "◑",
  crashed: "✗",
  failed: "✗",
} as const;

/**
 * Get status indicator with color
 */
export function getStatusIndicator(status: keyof typeof statusSymbols): string {
  const symbol = statusSymbols[status];

  switch (status) {
    case "stopped":
      return colorize(symbol, "gray");
    case "starting":
    case "stopping":
      return colorize(symbol, "yellow");
    case "running":
      return colorize(symbol, "blue");
    case "healthy":
      return colorize(symbol, "green");
    case "crashed":
    case "failed":
      return colorize(symbol, "red");
    default:
      return symbol;
  }
}
