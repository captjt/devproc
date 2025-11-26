import { type Component, For } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { ServiceState } from "../../process/types";
import { ServiceRow } from "./ServiceRow";

interface ServiceListProps {
  services: ServiceState[];
  selectedIndex: number;
  width: number;
  height: number;
}

export const ServiceList: Component<ServiceListProps> = (props) => {
  return (
    <box flexDirection="column" width={props.width} height={props.height}>
      <box height={1} paddingLeft={1} paddingRight={1}>
        <text fg="cyan" attributes={TextAttributes.BOLD}>
          Services
        </text>
      </box>
      <box flexDirection="column" flexGrow={1}>
        <For each={props.services}>
          {(service, index) => (
            <ServiceRow
              service={service}
              selected={index() === props.selectedIndex}
              width={props.width - 2}
            />
          )}
        </For>
      </box>
    </box>
  );
};

export default ServiceList;
