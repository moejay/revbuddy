import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Panel } from "../components/Box.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { StatusIndicator } from "../components/StatusIndicator.js";
import type { QueueItem } from "../../core/types.js";
import type { APIClient } from "../api-client.js";
import { terminalLink, openInBrowser } from "../utils.js";

function formatTimeAgo(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type SortMode = "priority" | "age";

interface QueueViewProps {
  api: APIClient;
  cols: number;
  rows: number;
  onSelectItem: (item: QueueItem) => void;
  onStartReview: (item: QueueItem) => void;
  onManageRepos: () => void;
  onAnalysisStatus: () => void;
}

function sortItems(items: QueueItem[], mode: SortMode): QueueItem[] {
  return [...items].sort((a, b) => {
    // Closed always at bottom
    if (a.status === "closed" && b.status !== "closed") return 1;
    if (a.status !== "closed" && b.status === "closed") return -1;
    if (mode === "age") {
      return new Date(a.pr.createdAt).getTime() - new Date(b.pr.createdAt).getTime();
    }
    return b.priorityScore - a.priorityScore;
  });
}

function groupByRepo(items: QueueItem[], mode: SortMode): Record<string, QueueItem[]> {
  const groups: Record<string, QueueItem[]> = {};
  for (const item of items) {
    const repo = item.pr.repoId;
    if (!groups[repo]) groups[repo] = [];
    groups[repo].push(item);
  }
  for (const repo of Object.keys(groups)) {
    groups[repo] = sortItems(groups[repo], mode);
  }
  return groups;
}

export function QueueView({ api, cols, rows, onSelectItem, onStartReview, onManageRepos, onAnalysisStatus }: QueueViewProps): React.ReactElement {
  const { exit } = useApp();
  const [allItems, setAllItems] = useState<QueueItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState("");
  const [filterMode, setFilterMode] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupByRepo(allItems, sortMode), [allItems, sortMode]);

  const flatItems = useMemo(() => Object.values(grouped).flat(), [grouped]);
  const filteredItems = useMemo(() =>
    filter
      ? flatItems.filter(
          (i) =>
            i.pr.title.toLowerCase().includes(filter.toLowerCase()) ||
            i.priorityTier.includes(filter.toLowerCase())
        )
      : flatItems,
    [flatItems, filter]
  );

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await api.getQueue();
        setAllItems(data);
      } catch (err: any) {
        setError(err.message);
      }
    };
    load();
    const unsub = api.onEvent("queue:updated", () => { load(); });
    return () => { unsub(); };
  }, []);

  useInput((input, key) => {
    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        setFilter("");
      } else if (key.return) {
        setFilterMode(false);
      } else if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
      } else if (input && !key.ctrl) {
        setFilter((f) => f + input);
      }
      return;
    }

    if (input === "q") exit();
    if (input === "j" || key.downArrow) setCursor((c) => Math.min(c + 1, filteredItems.length - 1));
    if (input === "k" || key.upArrow) setCursor((c) => Math.max(c - 1, 0));
    if (input === "/") setFilterMode(true);
    if (input === "o") setSortMode((m) => m === "priority" ? "age" : "priority");
    if (key.return && filteredItems[cursor]) onSelectItem(filteredItems[cursor]);
    if (input === "r" && filteredItems[cursor]) onStartReview(filteredItems[cursor]);
    if (input === "a" && filteredItems[cursor]) {
      api.startAnalysis(filteredItems[cursor].id).catch(() => {});
    }
    if (input === "b" && filteredItems[cursor]) {
      openInBrowser(filteredItems[cursor].pr.url);
    }
    if (input === "m") onManageRepos();
    if (input === "s") onAnalysisStatus();
  });

  if (error) {
    return (
      <Box flexDirection="column" width={cols} height={rows}>
        <Panel title="Error" borderColor="red">
          <Text color="red">{error}</Text>
          <Text dimColor>Make sure the server is running (npm run dev)</Text>
        </Panel>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Header - pinned */}
      <Box flexShrink={0}>
        <Panel title="PR Queue" focused>
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>
              {filteredItems.length} PRs · j/k nav · Enter detail · r review · a analyze · b browser · o sort · s status · m repos · / filter · q quit
            </Text>
            <Text color="yellow"> sort: {sortMode}</Text>
            {filterMode && (
              <Text>
                Filter: <Text color="cyan">{filter}</Text>
                <Text dimColor>_</Text>
              </Text>
            )}
          </Box>
        </Panel>
      </Box>

      {/* Scrollable queue content */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {Object.entries(grouped).map(([repoId, repoItems]) => {
          const visible = filter
            ? repoItems.filter(
                (i) =>
                  i.pr.title.toLowerCase().includes(filter.toLowerCase()) ||
                  i.priorityTier.includes(filter.toLowerCase())
              )
            : repoItems;
          if (visible.length === 0) return null;
          return (
            <Box key={repoId} flexShrink={0}>
              <Panel title={`${repoId}`} borderColor="gray">
                {visible.map((item) => {
                  const globalIdx = filteredItems.indexOf(item);
                  const selected = globalIdx === cursor;
                  const isClosed = item.status === "closed";
                  const closedAge = isClosed && item.closedAt ? formatTimeAgo(item.closedAt) : "";
                  return (
                    <Box key={item.id} flexDirection="row" gap={1}>
                      <Text>{selected ? "▸" : " "}</Text>
                      <PriorityBadge tier={item.priorityTier} />
                      <StatusIndicator status={item.status} />
                      <Text bold={selected && !isClosed} dimColor={isClosed} color={isClosed ? "gray" : selected ? "cyan" : "white"}>
                        {terminalLink(`#${item.pr.number}`, item.pr.url)}
                      </Text>
                      <Text bold={selected && !isClosed} dimColor={isClosed} color={isClosed ? "gray" : selected ? "cyan" : "white"} strikethrough={isClosed} wrap="truncate-end">
                        {item.pr.title}
                      </Text>
                      <Text dimColor>
                        {item.pr.author} · {formatTimeAgo(item.pr.createdAt)}
                        {isClosed ? ` · closed ${closedAge}` : ` · ${item.artifacts.length} artifacts`}
                      </Text>
                    </Box>
                  );
                })}
              </Panel>
            </Box>
          );
        })}

        {filteredItems.length === 0 && (
          <Panel title="Empty Queue" borderColor="yellow">
            <Text dimColor>No PRs in queue. Press 'm' to manage repos, or wait for the monitor.</Text>
          </Panel>
        )}
      </Box>
    </Box>
  );
}
