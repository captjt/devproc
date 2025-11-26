import { createSignal, createMemo, onCleanup, onMount } from "solid-js";
import type { LogLine } from "../../process/types";
import type { ProcessManager } from "../../process/manager";

const DEFAULT_BUFFER_SIZE = 1000;

export interface SearchMatch {
  logIndex: number;
  startIndex: number;
  endIndex: number;
}

export interface UseLogsReturn {
  logs: () => LogLine[];
  getServiceLogs: (service: string, limit?: number) => LogLine[];
  getAllLogs: (limit?: number) => LogLine[];
  clearLogs: (service?: string) => void;
  filter: () => string;
  setFilter: (filter: string) => void;
  filteredLogs: () => LogLine[];
  logVersion: () => number;
  // Search functionality
  searchQuery: () => string;
  setSearchQuery: (query: string) => void;
  searchMatches: () => SearchMatch[];
  currentMatchIndex: () => number;
  setCurrentMatchIndex: (index: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  clearSearch: () => void;
  isSearchActive: () => boolean;
  // Export functionality
  exportLogs: (service?: string, format?: "plain" | "json") => string;
}

/**
 * Hook to manage log buffers with search and export
 */
export function useLogs(manager: ProcessManager, bufferSize = DEFAULT_BUFFER_SIZE): UseLogsReturn {
  const [logs, setLogs] = createSignal<LogLine[]>([]);
  const [filter, setFilter] = createSignal("");
  // Version counter to trigger reactivity for per-service logs
  const [logVersion, setLogVersion] = createSignal(0);

  // Search state
  const [searchQuery, setSearchQuery] = createSignal("");
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(0);

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

  // Compute search matches
  const searchMatches = createMemo((): SearchMatch[] => {
    const query = searchQuery();
    if (!query) return [];

    const matches: SearchMatch[] = [];
    const allLogs = logs();

    // Try as regex first, fall back to literal search
    let regex: RegExp;
    try {
      regex = new RegExp(query, "gi");
    } catch {
      // Invalid regex, use literal search
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    }

    allLogs.forEach((log, logIndex) => {
      let match;
      while ((match = regex.exec(log.content)) !== null) {
        matches.push({
          logIndex,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    });

    return matches;
  });

  const isSearchActive = () => searchQuery().length > 0;

  const nextMatch = () => {
    const matches = searchMatches();
    if (matches.length === 0) return;

    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const prevMatch = () => {
    const matches = searchMatches();
    if (matches.length === 0) return;

    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentMatchIndex(0);
  };

  // Export logs to string
  const exportLogs = (service?: string, format: "plain" | "json" = "plain"): string => {
    const logsToExport = service ? (serviceBuffers.get(service) || []) : logs();

    if (format === "json") {
      return JSON.stringify(
        logsToExport.map((l) => ({
          timestamp: l.timestamp.toISOString(),
          service: l.service,
          stream: l.stream,
          content: l.content,
        })),
        null,
        2,
      );
    }

    // Plain text format
    return logsToExport
      .map((l) => {
        const time = l.timestamp.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        return `[${time}] ${l.service} | ${l.content}`;
      })
      .join("\n");
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
    // Search functionality
    searchQuery,
    setSearchQuery,
    searchMatches,
    currentMatchIndex,
    setCurrentMatchIndex,
    nextMatch,
    prevMatch,
    clearSearch,
    isSearchActive,
    // Export functionality
    exportLogs,
  };
}
