import { createSignal, onCleanup, onMount } from "solid-js";
import type { LogLine } from "../../process/types";
import type { ProcessManager } from "../../process/manager";

const DEFAULT_BUFFER_SIZE = 1000;

export interface UseLogsReturn {
  logs: () => LogLine[];
  getServiceLogs: (service: string, limit?: number) => LogLine[];
  getAllLogs: (limit?: number) => LogLine[];
  clearLogs: (service?: string) => void;
  filter: () => string;
  setFilter: (filter: string) => void;
  filteredLogs: () => LogLine[];
  logVersion: () => number;
}

/**
 * Hook to manage log buffers
 */
export function useLogs(manager: ProcessManager, bufferSize = DEFAULT_BUFFER_SIZE): UseLogsReturn {
  const [logs, setLogs] = createSignal<LogLine[]>([]);
  const [filter, setFilter] = createSignal("");
  // Version counter to trigger reactivity for per-service logs
  const [logVersion, setLogVersion] = createSignal(0);

  // Per-service log buffers (non-reactive storage, but we use logVersion for reactivity)
  const serviceBuffers = new Map<string, LogLine[]>();

  onMount(() => {
    const handleLog = (line: LogLine) => {
      // Add to per-service buffer
      let serviceBuffer = serviceBuffers.get(line.service);
      if (!serviceBuffer) {
        serviceBuffer = [];
        serviceBuffers.set(line.service, serviceBuffer);
      }
      serviceBuffer.push(line);

      // Trim buffer if needed
      if (serviceBuffer.length > bufferSize) {
        serviceBuffer.shift();
      }

      // Add to global logs
      setLogs((prev) => {
        const newLogs = [...prev, line];
        if (newLogs.length > bufferSize) {
          return newLogs.slice(-bufferSize);
        }
        return newLogs;
      });

      // Increment version to trigger reactivity
      setLogVersion((v) => v + 1);
    };

    manager.on("log", handleLog);

    onCleanup(() => {
      manager.off("log", handleLog);
    });
  });

  const getServiceLogs = (service: string, limit?: number): LogLine[] => {
    // Access logVersion to create reactive dependency
    logVersion();

    const buffer = serviceBuffers.get(service) || [];
    if (limit && buffer.length > limit) {
      return buffer.slice(-limit);
    }
    return [...buffer]; // Return a copy to ensure reactivity
  };

  const getAllLogs = (limit?: number): LogLine[] => {
    const all = logs();
    if (limit && all.length > limit) {
      return all.slice(-limit);
    }
    return all;
  };

  const clearLogs = (service?: string) => {
    if (service) {
      serviceBuffers.delete(service);
      setLogs((prev) => prev.filter((l) => l.service !== service));
    } else {
      serviceBuffers.clear();
      setLogs([]);
    }
    setLogVersion((v) => v + 1);
  };

  const filteredLogs = () => {
    const f = filter().toLowerCase();
    if (!f) return logs();

    return logs().filter(
      (l) => l.content.toLowerCase().includes(f) || l.service.toLowerCase().includes(f),
    );
  };

  return {
    logs,
    getServiceLogs,
    getAllLogs,
    clearLogs,
    filter,
    setFilter,
    filteredLogs,
    logVersion,
  };
}
