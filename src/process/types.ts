import type { Subprocess } from "bun";
import type { ResourceStats } from "./resources";

/**
 * Service lifecycle status
 */
export type ServiceStatus =
  | "stopped"
  | "starting"
  | "running"
  | "healthy"
  | "stopping"
  | "crashed"
  | "failed";

/**
 * Runtime state of a service
 */
export interface ServiceState {
  name: string;
  status: ServiceStatus;
  pid?: number;
  startedAt?: Date;
  stoppedAt?: Date;
  exitCode?: number;
  port?: number;
  error?: string;
  restartCount: number;
  /** Current resource usage (CPU, memory) */
  resources?: ResourceStats;
}

/**
 * Log line from a service
 */
export interface LogLine {
  timestamp: Date;
  service: string;
  content: string;
  stream: "stdout" | "stderr";
}

/**
 * Events emitted by the process manager
 */
export interface ProcessManagerEvents {
  "state-change": (name: string, state: ServiceState) => void;
  log: (line: LogLine) => void;
  error: (name: string, error: Error) => void;
  "all-stopped": () => void;
}

/**
 * Internal tracking for a running process
 */
export interface ManagedProcess {
  name: string;
  process: Subprocess;
  state: ServiceState;
  healthcheckTimer?: Timer;
  restartTimer?: Timer;
}

/**
 * Options for starting a service
 */
export interface StartOptions {
  /** Skip waiting for dependencies */
  skipDeps?: boolean;
  /** Force restart if already running */
  force?: boolean;
}

/**
 * Options for stopping a service
 */
export interface StopOptions {
  /** Skip stopping dependent services */
  skipDependents?: boolean;
  /** Timeout before sending SIGKILL (ms) */
  timeout?: number;
  /** Signal to send */
  signal?: NodeJS.Signals;
}

/**
 * Create initial state for a service
 */
export function createInitialState(name: string): ServiceState {
  return {
    name,
    status: "stopped",
    restartCount: 0,
  };
}

/**
 * Check if a service is in a "running" state
 */
export function isRunning(state: ServiceState): boolean {
  return state.status === "running" || state.status === "healthy" || state.status === "starting";
}

/**
 * Check if a service can be started
 */
export function canStart(state: ServiceState): boolean {
  return state.status === "stopped" || state.status === "crashed" || state.status === "failed";
}

/**
 * Check if a service can be stopped
 */
export function canStop(state: ServiceState): boolean {
  return state.status === "running" || state.status === "healthy" || state.status === "starting";
}
