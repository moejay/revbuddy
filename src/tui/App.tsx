import React, { useState, useEffect } from "react";
import { Box, Text, useStdout } from "ink";
import { QueueView } from "./views/QueueView.js";
import { DetailView } from "./views/DetailView.js";
import { ReviewView } from "./views/ReviewView.js";
import { RepoManagerView } from "./views/RepoManagerView.js";
import { AnalysisStatusView } from "./views/AnalysisStatusView.js";
import { APIClient } from "./api-client.js";
import type { QueueItem } from "../core/types.js";

type View = "queue" | "detail" | "review" | "repos" | "analysis";

interface AppProps {
  serverUrl: string;
}

export function App({ serverUrl }: AppProps): React.ReactElement {
  const { stdout } = useStdout();
  const [api] = useState(() => new APIClient(serverUrl));
  const [view, setView] = useState<View>("queue");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [worktreePath, setWorktreePath] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [cols, setCols] = useState(stdout?.columns ?? 80);
  const [rows, setRows] = useState(stdout?.rows ?? 24);

  // Track terminal resize
  useEffect(() => {
    const onResize = (): void => {
      if (stdout) {
        setCols(stdout.columns);
        setRows(stdout.rows);
      }
    };
    stdout?.on("resize", onResize);
    return () => { stdout?.off("resize", onResize); };
  }, [stdout]);

  useEffect(() => {
    api.connectWS();
    return () => api.disconnect();
  }, []);

  const handleSelectItem = (item: QueueItem): void => {
    setSelectedItem(item);
    setView("detail");
  };

  const handleStartReview = async (item: QueueItem): Promise<void> => {
    try {
      const { sessionId: sid, worktreePath: wt } = await api.startReview(item.id);
      setSelectedItem(item);
      setSessionId(sid);
      setWorktreePath(wt);
      setView("review");
    } catch (err: any) {
      console.error("Failed to start review:", err.message);
    }
  };

  const handleReviewWithRef = async (message: string): Promise<void> => {
    if (!selectedItem) return;
    setPendingMessage(message);
    try {
      await handleStartReview(selectedItem);
    } catch {
      setPendingMessage(null);
    }
  };

  const handleLeaveReview = (): void => {
    setPendingMessage(null);
    setView("queue");
  };

  const handleEndReview = async (): Promise<void> => {
    if (selectedItem) {
      try {
        await api.endReview(selectedItem.id);
      } catch {}
    }
    setSessionId(null);
    setWorktreePath(null);
    setPendingMessage(null);
    setView("queue");
  };

  const handleBack = (): void => {
    setPendingMessage(null);
    setView("queue");
    setSelectedItem(null);
  };

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Global header - always visible */}
      <Box justifyContent="space-between" paddingX={1} flexShrink={0}>
        <Text bold color="cyan">
          ╔══ RevBuddy ══╗
        </Text>
        <Text dimColor>
          {serverUrl} · {cols}x{rows}
        </Text>
      </Box>

      {/* View area fills remaining space */}
      <Box flexDirection="column" flexGrow={1} width={cols}>
        {view === "queue" && (
          <QueueView
            api={api}
            cols={cols}
            rows={rows - 2}
            onSelectItem={handleSelectItem}
            onStartReview={handleStartReview}
            onManageRepos={() => setView("repos")}
            onAnalysisStatus={() => setView("analysis")}
          />
        )}

        {view === "analysis" && (
          <AnalysisStatusView
            api={api}
            cols={cols}
            rows={rows - 2}
            onBack={handleBack}
          />
        )}

        {view === "repos" && (
          <RepoManagerView
            api={api}
            cols={cols}
            rows={rows - 2}
            onBack={handleBack}
          />
        )}

        {view === "detail" && selectedItem && (
          <DetailView
            item={selectedItem}
            api={api}
            cols={cols}
            rows={rows - 2}
            onBack={handleBack}
            onStartReview={() => handleStartReview(selectedItem)}
            onReviewWithRef={handleReviewWithRef}
          />
        )}

        {view === "review" && selectedItem && sessionId && (
          <ReviewView
            item={selectedItem}
            sessionId={sessionId}
            worktreePath={worktreePath ?? ""}
            api={api}
            cols={cols}
            rows={rows - 2}
            onLeave={handleLeaveReview}
            onEndReview={handleEndReview}
            initialMessage={pendingMessage ?? undefined}
          />
        )}
      </Box>
    </Box>
  );
}
