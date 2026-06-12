import type { ReadinessItem } from "../lib/api";

type StatusPillProps = {
  item: ReadinessItem;
};

export function StatusPill({ item }: StatusPillProps) {
  return (
    <span className={item.ready ? "status status-ready" : "status status-blocked"} title={item.reason}>
      {item.ready ? "Ready" : "Blocked"}
    </span>
  );
}

