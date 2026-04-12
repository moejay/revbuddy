import React from "react";
import { Text } from "ink";
import type { PriorityTier } from "../../core/types.js";

const TIER_COLORS: Record<PriorityTier, string> = {
  critical: "red",
  high: "#FFA500",
  medium: "blue",
  low: "gray",
};

const TIER_LABELS: Record<PriorityTier, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED ",
  low: "LOW ",
};

export function PriorityBadge({ tier }: { tier: PriorityTier }): React.ReactElement {
  return (
    <Text color={TIER_COLORS[tier]} bold>
      [{TIER_LABELS[tier]}]
    </Text>
  );
}
