import { createSignal, onCleanup, onMount } from "solid-js";
import type { ServiceState } from "../../process/types";
import type { ProcessManager } from "../../process/manager";

export interface UseServicesReturn {
  services: () => ServiceState[];
  selectedIndex: () => number;
  selectedService: () => ServiceState | null;
  selectedName: () => string | null;
  selectNext: () => void;
  selectPrev: () => void;
  selectByName: (name: string) => void;
}

/**
 * Hook to manage service state and selection
 */
export function useServices(manager: ProcessManager): UseServicesReturn {
  // Get initial services in consistent order
  const initialServices = manager.getAllStates();
  const [services, setServices] = createSignal<ServiceState[]>(initialServices);

  // Track selection by name for stability (index can change if order changes)
  const [selectedName, setSelectedName] = createSignal<string | null>(
    initialServices.length > 0 ? initialServices[0]!.name : null,
  );

  onMount(() => {
    // Listen for state changes
    const handleStateChange = (name: string, state: ServiceState) => {
      setServices((prev) => prev.map((s) => (s.name === name ? state : s)));
    };

    manager.on("state-change", handleStateChange);

    onCleanup(() => {
      manager.off("state-change", handleStateChange);
    });
  });

  // Compute selected index from name
  const selectedIndex = () => {
    const name = selectedName();
    if (!name) return 0;
    const idx = services().findIndex((s) => s.name === name);
    return idx >= 0 ? idx : 0;
  };

  const selectNext = () => {
    const svcs = services();
    const currentIdx = selectedIndex();
    const nextIdx = Math.min(currentIdx + 1, svcs.length - 1);
    if (svcs[nextIdx]) {
      setSelectedName(svcs[nextIdx]!.name);
    }
  };

  const selectPrev = () => {
    const svcs = services();
    const currentIdx = selectedIndex();
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (svcs[prevIdx]) {
      setSelectedName(svcs[prevIdx]!.name);
    }
  };

  const selectByName = (name: string) => {
    const exists = services().some((s) => s.name === name);
    if (exists) {
      setSelectedName(name);
    }
  };

  const selectedService = () => {
    const name = selectedName();
    if (!name) return null;
    return services().find((s) => s.name === name) ?? null;
  };

  return {
    services,
    selectedIndex,
    selectedService,
    selectedName,
    selectNext,
    selectPrev,
    selectByName,
  };
}
