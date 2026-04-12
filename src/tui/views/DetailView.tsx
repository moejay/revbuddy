import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Panel } from "../components/Box.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { StatusIndicator } from "../components/StatusIndicator.js";
import type { QueueItem } from "../../core/types.js";

interface DetailViewProps {
  item: QueueItem;
  cols: number;
  rows: number;
  onBack: () => void;
  onStartReview: () => void;
}

export function DetailView({ item, cols, rows, onBack, onStartReview }: DetailViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const tabs = item.artifacts.length > 0
    ? item.artifacts.map((a) => a.title)
    : ["(no artifacts)"];

  const artifact = item.artifacts[activeTab];
  const lines = artifact?.content.split("\n") ?? [];
  // Header takes ~7 rows (header panel + tab bar), rest is for content
  const contentHeight = Math.max(rows - 9, 5);
  const maxScroll = Math.max(0, lines.length - contentHeight);

  useInput((input, key) => {
    if (key.escape || input === "q") onBack();
    if (key.tab || input === "l") {
      setActiveTab((t) => (t + 1) % tabs.length);
      setScrollOffset(0);
    }
    if (input === "h") {
      setActiveTab((t) => (t - 1 + tabs.length) % tabs.length);
      setScrollOffset(0);
    }
    if (input === "j" || key.downArrow) setScrollOffset((s) => Math.min(s + 1, maxScroll));
    if (input === "k" || key.upArrow) setScrollOffset((s) => Math.max(0, s - 1));
    if (input === "G") setScrollOffset(maxScroll);
    if (input === "g") setScrollOffset(0);
    if (input === "r") onStartReview();
    const num = parseInt(input);
    if (!isNaN(num) && num >= 1 && num <= tabs.length) {
      setActiveTab(num - 1);
      setScrollOffset(0);
    }
  });

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Header - pinned */}
      <Box flexShrink={0}>
        <Panel title={`PR #${item.pr.number}: ${item.pr.title}`} focused>
          <Box flexDirection="row" gap={2}>
            <PriorityBadge tier={item.priorityTier} />
            <StatusIndicator status={item.status} />
            <Text>by <Text bold>{item.pr.author}</Text></Text>
            <Text dimColor>{item.pr.branch} → {item.pr.baseBranch}</Text>
            <Text dimColor>+{item.pr.additions}/-{item.pr.deletions} ({item.pr.changedFiles} files)</Text>
          </Box>
          <Text dimColor>Esc back · h/l tabs · j/k scroll · g/G top/bottom · r review · 1-{tabs.length} tab</Text>
        </Panel>
      </Box>

      {/* Tab bar - pinned */}
      <Box flexDirection="row" gap={1} paddingX={1} flexShrink={0}>
        {tabs.map((tab, i) => (
          <Text key={i} bold={i === activeTab} color={i === activeTab ? "cyan" : "gray"}>
            {i === activeTab ? `▸ ${tab}` : `  ${tab}`}
          </Text>
        ))}
        {lines.length > contentHeight && (
          <Text dimColor> [{scrollOffset + 1}-{Math.min(scrollOffset + contentHeight, lines.length)}/{lines.length}]</Text>
        )}
      </Box>

      {/* Artifact content - fills remaining space, only this scrolls */}
      <Box flexGrow={1} flexShrink={1} overflowY="hidden">
        <Panel title={artifact?.title ?? "No artifacts"} borderColor="gray">
          {artifact ? (
            <Text>
              {lines.slice(scrollOffset, scrollOffset + contentHeight).join("\n")}
            </Text>
          ) : (
            <Text dimColor>No artifacts available. Run analysis first.</Text>
          )}
        </Panel>
      </Box>
    </Box>
  );
}
