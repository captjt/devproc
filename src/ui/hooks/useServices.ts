import { createSignal, onCleanup, onMount } from "solid-js"
import type { ServiceState } from "../../process/types"
import type { ProcessManager } from "../../process/manager"
import type { ServiceGroup, NormalizedService } from "../../config/types"

// A display item can be either a group header or a service
export type DisplayItem =
  | { type: "group"; group: ServiceGroup; services: ServiceState[] }
  | { type: "service"; service: ServiceState; group: string | null }

export interface UseServicesReturn {
  services: () => ServiceState[]
  displayItems: () => DisplayItem[]
  selectedIndex: () => number
  selectedService: () => ServiceState | null
  selectedGroup: () => string | null
  selectedName: () => string | null
  selectNext: () => void
  selectPrev: () => void
  selectByName: (name: string) => void
  toggleGroupCollapsed: (groupName: string) => void
  isGroupCollapsed: (groupName: string) => boolean
  collapsedGroups: () => Set<string>
}

/**
 * Hook to manage service state and selection with group support
 */
export function useServices(manager: ProcessManager): UseServicesReturn {
  // Get initial services in consistent order
  const initialServices = manager.getAllStates()
  const [services, setServices] = createSignal<ServiceState[]>(initialServices)

  // Track collapsed groups
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set())

  // Track selection by name for stability (index can change if order changes)
  const [selectedName, setSelectedName] = createSignal<string | null>(
    initialServices.length > 0 ? initialServices[0]!.name : null,
  )

  onMount(() => {
    // Listen for state changes
    const handleStateChange = (name: string, state: ServiceState) => {
      setServices((prev) => prev.map((s) => (s.name === name ? state : s)))
    }

    // Listen for config reloads to update services list
    const handleConfigReload = () => {
      setServices(manager.getAllStates())
    }

    // Listen for resource updates to refresh service states
    const handleResourcesUpdated = () => {
      setServices(manager.getAllStates())
    }

    manager.on("state-change", handleStateChange)
    manager.on("config-reloaded", handleConfigReload)
    manager.on("resources-updated", handleResourcesUpdated)

    onCleanup(() => {
      manager.off("state-change", handleStateChange)
      manager.off("config-reloaded", handleConfigReload)
      manager.off("resources-updated", handleResourcesUpdated)
    })
  })

  // Build display items (groups + services, respecting collapsed state)
  const displayItems = (): DisplayItem[] => {
    const items: DisplayItem[] = []
    const svcs = services()
    const groups = manager.getGroups()
    const collapsed = collapsedGroups()

    // Track which services are in groups
    const groupedServices = new Set<string>()

    // Add groups and their services
    for (const [groupName, group] of groups) {
      const groupServices = svcs.filter((s) => {
        const serviceConfig = manager.getServiceConfig(s.name)
        return serviceConfig?.group === groupName
      })

      if (groupServices.length > 0) {
        // Add group header
        items.push({ type: "group", group, services: groupServices })

        // Add services if not collapsed
        if (!collapsed.has(groupName)) {
          for (const service of groupServices) {
            items.push({ type: "service", service, group: groupName })
            groupedServices.add(service.name)
          }
        } else {
          // Even when collapsed, track these as grouped
          for (const service of groupServices) {
            groupedServices.add(service.name)
          }
        }
      }
    }

    // Add ungrouped services
    for (const service of svcs) {
      if (!groupedServices.has(service.name)) {
        items.push({ type: "service", service, group: null })
      }
    }

    return items
  }

  // Compute selected index from name (in flat services list)
  const selectedIndex = () => {
    const name = selectedName()
    if (!name) return 0
    const idx = services().findIndex((s) => s.name === name)
    return idx >= 0 ? idx : 0
  }

  // Get the group of the selected service
  const selectedGroup = () => {
    const name = selectedName()
    if (!name) return null
    return manager.getServiceGroup(name) ?? null
  }

  const selectNext = () => {
    const items = displayItems()
    const currentName = selectedName()

    // Find current position in display items
    let currentIdx = -1
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.type === "service" && item.service.name === currentName) {
        currentIdx = i
        break
      }
    }

    // Find next service item
    for (let i = currentIdx + 1; i < items.length; i++) {
      const item = items[i]!
      if (item.type === "service") {
        setSelectedName(item.service.name)
        return
      }
    }
  }

  const selectPrev = () => {
    const items = displayItems()
    const currentName = selectedName()

    // Find current position in display items
    let currentIdx = items.length
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.type === "service" && item.service.name === currentName) {
        currentIdx = i
        break
      }
    }

    // Find previous service item
    for (let i = currentIdx - 1; i >= 0; i--) {
      const item = items[i]!
      if (item.type === "service") {
        setSelectedName(item.service.name)
        return
      }
    }
  }

  const selectByName = (name: string) => {
    const exists = services().some((s) => s.name === name)
    if (exists) {
      setSelectedName(name)
    }
  }

  const selectedService = () => {
    const name = selectedName()
    if (!name) return null
    return services().find((s) => s.name === name) ?? null
  }

  const toggleGroupCollapsed = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const isGroupCollapsed = (groupName: string) => {
    return collapsedGroups().has(groupName)
  }

  return {
    services,
    displayItems,
    selectedIndex,
    selectedService,
    selectedGroup,
    selectedName,
    selectNext,
    selectPrev,
    selectByName,
    toggleGroupCollapsed,
    isGroupCollapsed,
    collapsedGroups,
  }
}
