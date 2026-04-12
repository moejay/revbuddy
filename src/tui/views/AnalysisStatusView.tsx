import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Panel } from "../components/Box.js";
import type { APIClient } from "../api-client.js";

interface AnalysisStatusViewProps {
  api: APIClient;
  cols: number;
  rows: number;
  onBack: () => void;
}

interface ActiveWorkload {
  itemId: string;
  prId: string;
  title: string;
  repoId: string;
  startedAt: string;
  analyzersCompleted: number;
  analyzersTotal: number;
  currentAnalyzer?: string;
}

interface CompletedWorkload {
  itemId: string;
  prId: string;
  title: string;
  completedAt: string;
  artifactCount: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface PipelineStatus {
  maxConcurrent: number;
  active: ActiveWorkload[];
  queued: Array<{ itemId: string; prId: string; title: string; repoId: string; position: number }>;
  recentlyCompleted: CompletedWorkload[];
  recentlyFailed: CompletedWorkload[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}

function ProgressBar({ completed, total, width }: { completed: number; total: number; width: number }): React.ReactElement {
  const filled = total > 0 ? Math.round((completed / total) * width) : 0;
  return (
    <Text>
      <Text color="green">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(width - filled)}</Text>
      <Text dimColor> {completed}/{total}</Text>
    </Text>
  );
}

export function AnalysisStatusView({ api, cols, rows, onBack }: AnalysisStatusViewProps): React.ReactElement {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [concurrencyMode, setConcurrencyMode] = useState(false);
  const [concurrencyInput, setConcurrencyInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const data = await api.getAnalysisStatus();
      setStatus(data);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    load();
    // Subscribe to pipeline status updates
    const unsub = api.onEvent("pipeline:status", () => { load(); });
    // Also poll every 5s for freshness
    const timer = setInterval(load, 5000);
    return () => { unsub(); clearInterval(timer); };
  }, []);

  useInput((input, key) => {
    if (concurrencyMode) return;
    if (key.escape || input === "q") onBack();
    if (input === "c") {
      setConcurrencyMode(true);
      setConcurrencyInput(String(status?.maxConcurrent ?? 2));
    }
    if (input === "r") load();
  }, { isActive: !concurrencyMode });

  const handleConcurrencySubmit = async (value: string): Promise<void> => {
    const n = parseInt(value);
    if (!isNaN(n) && n >= 1 && n <= 10) {
      try {
        await api.setConcurrency(n);
        setMessage(`Concurrency set to ${n}`);
        await load();
      } catch (err: any) {
        setMessage(`Error: ${err.message}`);
      }
    }
    setConcurrencyMode(false);
  };

  if (!status) {
    return (
      <Box flexDirection="column" width={cols} height={rows}>
        <Panel title="Analysis Pipeline Status" focused>
          <Text dimColor>Loading...</Text>
        </Panel>
      </Box>
    );
  }

  const slotsText = `${status.active.length}/${status.maxConcurrent} slots`;

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Header */}
      <Box flexShrink={0}>
        <Panel title={`Analysis Pipeline [${slotsText}]`} focused>
          <Text dimColor>c concurrency · r refresh · Esc/q back</Text>
        </Panel>
      </Box>

      {/* Active workloads */}
      <Box flexShrink={0}>
        <Panel title={`Active (${status.active.length})`} borderColor={status.active.length > 0 ? "cyan" : "gray"}>
          {status.active.length === 0 && (
            <Text dimColor>No active analyses</Text>
          )}
          {status.active.map((w) => (
            <Box key={w.itemId} flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text color="cyan">⟳</Text>
                <Text bold>{w.repoId}#{w.prId.split("#")[1]}</Text>
                <Text wrap="truncate-end">{w.title.slice(0, 40)}</Text>
              </Box>
              <Box flexDirection="row" gap={1} paddingLeft={2}>
                <ProgressBar completed={w.analyzersCompleted} total={w.analyzersTotal} width={20} />
                {w.currentAnalyzer && <Text dimColor>({w.currentAnalyzer})</Text>}
                <Text dimColor>started {timeAgo(w.startedAt)}</Text>
              </Box>
            </Box>
          ))}
        </Panel>
      </Box>

      {/* Queued */}
      {status.queued.length > 0 && (
        <Box flexShrink={0}>
          <Panel title={`Queued (${status.queued.length})`} borderColor="yellow">
            {status.queued.map((q) => (
              <Box key={q.itemId} flexDirection="row" gap={1}>
                <Text color="yellow">{q.position}.</Text>
                <Text>{q.repoId}#{q.prId.split("#")[1]}</Text>
                <Text wrap="truncate-end">{q.title.slice(0, 50)}</Text>
              </Box>
            ))}
          </Panel>
        </Box>
      )}

      {/* Recently completed + failed */}
      <Box flexGrow={1} flexDirection="column" overflowY="hidden">
        <Panel title={`Completed (${status.recentlyCompleted.length})`} borderColor="green">
          {status.recentlyCompleted.length === 0 && (
            <Text dimColor>No completed analyses yet</Text>
          )}
          {status.recentlyCompleted.slice(0, 10).map((c) => (
            <Box key={c.itemId} flexDirection="row" gap={1}>
              <Text color="green">✓</Text>
              <Text>{c.prId}</Text>
              <Text wrap="truncate-end">{c.title.slice(0, 35)}</Text>
              <Text dimColor>{c.artifactCount} artifacts</Text>
              <Text dimColor>{formatDuration(c.durationMs)}</Text>
              <Text dimColor>{timeAgo(c.completedAt)}</Text>
            </Box>
          ))}
        </Panel>

        {status.recentlyFailed.length > 0 && (
          <Panel title={`Failed (${status.recentlyFailed.length})`} borderColor="red">
            {status.recentlyFailed.slice(0, 5).map((f) => (
              <Box key={f.itemId} flexDirection="row" gap={1}>
                <Text color="red">✗</Text>
                <Text>{f.prId}</Text>
                <Text wrap="truncate-end">{f.title.slice(0, 35)}</Text>
                <Text color="red">{f.error?.slice(0, 40)}</Text>
                <Text dimColor>{timeAgo(f.completedAt)}</Text>
              </Box>
            ))}
          </Panel>
        )}
      </Box>

      {/* Concurrency input */}
      {concurrencyMode && (
        <Box paddingX={2} flexShrink={0}>
          <Text color="green">Max concurrent (1-10): </Text>
          <TextInput
            value={concurrencyInput}
            onChange={setConcurrencyInput}
            onSubmit={handleConcurrencySubmit}
          />
        </Box>
      )}

      {/* Status message */}
      {message && (
        <Box paddingX={2} flexShrink={0}>
          <Text color={message.startsWith("Error") ? "red" : "green"}>{message}</Text>
        </Box>
      )}
    </Box>
  );
}
