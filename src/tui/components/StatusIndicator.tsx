import React from "react";
import { Text } from "ink";
import type { QueueStatus } from "../../core/types.js";

const STATUS_ICONS: Record<QueueStatus, { icon: string; color: string }> = {
  detected: { icon: "○", color: "gray" },
  queued: { icon: "◎", color: "yellow" },
  analyzing: { icon: "⟳", color: "cyan" },
  analyzed: { icon: "◉", color: "blue" },
  "post-analyzing": { icon: "⟳", color: "magenta" },
  ready: { icon: "●", color: "green" },
  "in-review": { icon: "◆", color: "#FFA500" },
  reviewed: { icon: "✓", color: "green" },
};

export function StatusIndicator({ status }: { status: QueueStatus }): React.ReactElement {
  const { icon, color } = STATUS_ICONS[status] ?? { icon: "?", color: "white" };
  return (
    <Text color={color}>{icon}</Text>
  );
}
