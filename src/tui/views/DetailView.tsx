import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Panel } from "../components/Box.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { StatusIndicator } from "../components/StatusIndicator.js";
import { DiffView } from "../components/DiffView.js";
import { renderMarkdown, openInBrowser, parseDiff } from "../utils.js";
import type { DiffFile } from "../utils.js";
import type { QueueItem } from "../../core/types.js";
import type { APIClient } from "../api-client.js";

interface DetailViewProps {
  item: QueueItem;
  api: APIClient;
  cols: number;
  rows: number;
  onBack: () => void;
  onStartReview: () => void;
  onReviewWithRef: (message: string) => void;
}

export function DetailView({ item, api, cols, rows, onBack, onStartReview, onReviewWithRef }: DetailViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  const artifactTabs = item.artifacts.map((a) => a.title);
  const tabs = artifactTabs.length > 0 ? [...artifactTabs, "Diff"] : ["Diff"];
  const isDiffTab = activeTab === tabs.length - 1;
  const artifact = isDiffTab ? null : item.artifacts[activeTab];

  const contentHeight = Math.max(rows - 9, 5);
  const paneWidth = cols - 4;
  const lines = artifact ? renderMarkdown(artifact.content, paneWidth) : [];
  const maxScroll = Math.max(0, lines.length - contentHeight);

  useEffect(() => {
    setDiffLoading(true);
    api.getDiff(item.id)
      .then((diff) => setDiffFiles(parseDiff(diff)))
      .catch(() => {})
      .finally(() => setDiffLoading(false));
  }, [item.id]);

  useInput((input, key) => {
    if (key.escape || input === "q") onBack();
    if (input === "b") openInBrowser(item.pr.url);
    if (key.tab || input === "l") {
      setActiveTab((t) => (t + 1) % tabs.length);
      setScrollOffset(0);
    }
    if (input === "h") {
      setActiveTab((t) => (t - 1 + tabs.length) % tabs.length);
      setScrollOffset(0);
    }
    if (!isDiffTab) {
      if (input === "j" || key.downArrow) setScrollOffset((s) => Math.min(s + 1, maxScroll));
      if (input === "k" || key.upArrow) setScrollOffset((s) => Math.max(0, s - 1));
      if (input === "G") setScrollOffset(maxScroll);
      if (input === "g") setScrollOffset(0);
    }
    if (input === "r") onStartReview();
    if (input === "a" && !reanalyzing) {
      setReanalyzing(true);
      api.startAnalysis(item.id).catch(() => {}).finally(() => setReanalyzing(false));
    }
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
          <Text dimColor>Esc back · h/l tabs · {isDiffTab ? "j/k files · Enter expand · c ref-in-chat" : "j/k scroll · g/G top/bottom"} · r review · a re-analyze · b browser · 1-{tabs.length} tab</Text>
          {reanalyzing && <Text color="yellow">Re-analyzing...</Text>}
        </Panel>
      </Box>

      {/* Tab bar - pinned */}
      <Box flexDirection="row" gap={1} paddingX={1} flexShrink={0}>
        {tabs.map((tab, i) => (
          <Text key={i} bold={i === activeTab} color={i === activeTab ? "cyan" : "gray"}>
            {i === activeTab ? `▸ ${tab}` : `  ${tab}`}
          </Text>
        ))}
        {!isDiffTab && lines.length > contentHeight && (
          <Text dimColor> [{scrollOffset + 1}-{Math.min(scrollOffset + contentHeight, lines.length)}/{lines.length}]</Text>
        )}
      </Box>

      {/* Content - fills remaining space */}
      <Box flexGrow={1} flexShrink={1} overflowY="hidden">
        {isDiffTab ? (
          <Panel title="Diff" borderColor="gray">
            {diffLoading ? (
              <Text color="yellow">Loading diff...</Text>
            ) : (
              <DiffView
                files={diffFiles}
                width={paneWidth}
                height={contentHeight}
                isActive={isDiffTab}
                onReference={(filePath, hunkText) => {
                  const msg = "Let's discuss the changes in `" + filePath + "`:\n```diff\n" + hunkText + "\n```";
                  onReviewWithRef(msg);
                }}
              />
            )}
          </Panel>
        ) : (
          <Panel title={artifact?.title ?? "No artifacts"} borderColor="gray">
            {artifact ? (
              <Text>
                {lines.slice(scrollOffset, scrollOffset + contentHeight).join("\n")}
              </Text>
            ) : (
              <Text dimColor>No artifacts available. Run analysis first.</Text>
            )}
          </Panel>
        )}
      </Box>
    </Box>
  );
}
