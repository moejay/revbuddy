import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Panel } from "../components/Box.js";
import type { QueueItem } from "../../core/types.js";

// Rich chat entry that can represent user messages, AI text, tool use, thinking
interface ChatEntry {
  type: "user" | "ai-text" | "tool-use" | "tool-result" | "thinking";
  content: string;
}
import type { APIClient } from "../api-client.js";

interface ReviewViewProps {
  item: QueueItem;
  sessionId: string;
  worktreePath: string;
  api: APIClient;
  cols: number;
  rows: number;
  onEnd: () => void;
}

// Three focus modes: artifacts, chat (scrollable history), input (typing)
type FocusMode = "artifacts" | "chat" | "input";

function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= width) {
      result.push(line);
    } else {
      let remaining = line;
      while (remaining.length > width) {
        // Try to break at a space
        let breakAt = remaining.lastIndexOf(" ", width);
        if (breakAt <= 0) breakAt = width;
        result.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trimStart();
      }
      if (remaining) result.push(remaining);
    }
  }
  return result;
}

export function ReviewView({ item, sessionId, worktreePath, api, cols, rows, onEnd }: ReviewViewProps): React.ReactElement {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [focus, setFocus] = useState<FocusMode>("input");
  const [artifactScroll, setArtifactScroll] = useState(0);
  const [chatScroll, setChatScroll] = useState<number | null>(null); // null = auto-follow
  const [inputHeight, setInputHeight] = useState(1);

  const tabs = item.artifacts.map((a) => a.title);
  const artifact = item.artifacts[activeTab];
  const halfWidth = Math.floor(cols / 2);
  // Layout: header=4, tab bar=1, so pane area = rows - 5
  const paneHeight = Math.max(rows - 5, 8);
  // Right pane: chat area + input area (input is 2 + inputHeight lines)
  const inputAreaHeight = Math.min(inputHeight, 5) + 1; // +1 for prompt line
  const chatHeight = Math.max(paneHeight - inputAreaHeight - 3, 4); // -3 for panel borders+title

  // Artifact scrolling
  const artifactLines = artifact?.content.split("\n") ?? [];
  const maxArtifactScroll = Math.max(0, artifactLines.length - (paneHeight - 2));

  // Chat lines: wrap entries to fit the chat pane width
  const chatPaneWidth = (cols - halfWidth) - 6;
  const allChatLines: Array<{ color: string; text: string }> = [];
  const entryColors: Record<ChatEntry["type"], string> = {
    "user": "green",
    "ai-text": "cyan",
    "tool-use": "yellow",
    "tool-result": "gray",
    "thinking": "magenta",
  };
  const entryPrefixes: Record<ChatEntry["type"], string> = {
    "user": "You: ",
    "ai-text": "",
    "tool-use": "⚙ ",
    "tool-result": "  ↳ ",
    "thinking": "💭 ",
  };
  entries.forEach((entry) => {
    const color = entryColors[entry.type];
    const prefix = entryPrefixes[entry.type];
    const text = prefix + entry.content;
    const wrapped = wrapText(text, chatPaneWidth);
    for (const line of wrapped) {
      allChatLines.push({ color, text: line });
    }
    if (entry.type === "user" || entry.type === "ai-text") {
      allChatLines.push({ color: "gray", text: "" }); // spacer after messages
    }
  });
  if (loading && (entries.length === 0 || entries[entries.length - 1]?.type === "user")) {
    allChatLines.push({ color: "yellow", text: "⟳ Waiting for response..." });
  }

  const maxChatScroll = Math.max(0, allChatLines.length - chatHeight);
  // If chatScroll is null, auto-follow (show bottom)
  const effectiveChatScroll = chatScroll ?? maxChatScroll;
  const visibleChatLines = allChatLines.slice(effectiveChatScroll, effectiveChatScroll + chatHeight);

  // Update input height based on content
  useEffect(() => {
    const lines = chatInput.split("\n").length;
    setInputHeight(lines);
  }, [chatInput]);

  // Listen for streaming messages via WS
  useEffect(() => {
    const unsub = api.onEvent("session:message", (data: any) => {
      if (data.sessionId !== sessionId) return;

      if (data.type === "text") {
        // Append text to the last ai-text entry, or create one
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "ai-text") {
            return [...prev.slice(0, -1), { ...last, content: last.content + data.text }];
          }
          return [...prev, { type: "ai-text", content: data.text }];
        });
      } else if (data.type === "thinking") {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "thinking") {
            return [...prev.slice(0, -1), { ...last, content: last.content + data.text }];
          }
          return [...prev, { type: "thinking", content: data.text }];
        });
      } else if (data.type === "tool_use") {
        setEntries((prev) => [...prev, { type: "tool-use", content: `Using ${data.name}...` }]);
      } else if (data.type === "tool_result") {
        setEntries((prev) => [...prev, { type: "tool-result", content: data.content }]);
      } else if (data.type === "done") {
        setLoading(false);
      }
    });
    return () => { unsub(); };
  }, [sessionId]);

  // Auto-follow: reset to null (follow mode) when new messages arrive and we're in follow mode
  useEffect(() => {
    if (chatScroll === null) {
      // Already in follow mode, nothing to do
    }
  }, [entries, loading]);

  // ── Focus cycling: Tab cycles input → artifacts → chat → input ──
  const cycleFocus = (): void => {
    setFocus((f) => {
      if (f === "input") return "artifacts";
      if (f === "artifacts") return "chat";
      return "input";
    });
  };

  // Global keys (always active)
  useInput((_input, key) => {
    if (key.tab) {
      cycleFocus();
    }
    if (key.escape) {
      if (focus === "artifacts" || focus === "chat") {
        setFocus("input");
      } else {
        onEnd();
      }
    }
  });

  // Navigation for artifacts pane
  useInput((input, key) => {
    if (input === "j" || key.downArrow) setArtifactScroll((s) => Math.min(s + 1, maxArtifactScroll));
    if (input === "k" || key.upArrow) setArtifactScroll((s) => Math.max(0, s - 1));
    if (input === "G") setArtifactScroll(maxArtifactScroll);
    if (input === "g") setArtifactScroll(0);
    if (input === "l") { setActiveTab((t) => (t + 1) % tabs.length); setArtifactScroll(0); }
    if (input === "h") { setActiveTab((t) => (t - 1 + tabs.length) % tabs.length); setArtifactScroll(0); }
    const num = parseInt(input);
    if (!isNaN(num) && num >= 1 && num <= tabs.length) { setActiveTab(num - 1); setArtifactScroll(0); }
  }, { isActive: focus === "artifacts" });

  // Navigation for chat history pane
  useInput((input, key) => {
    if (input === "j" || key.downArrow) {
      setChatScroll((prev) => {
        const cur = prev ?? maxChatScroll;
        const next = Math.min(cur + 1, maxChatScroll);
        return next >= maxChatScroll ? null : next; // snap back to follow at bottom
      });
    }
    if (input === "k" || key.upArrow) {
      setChatScroll((prev) => Math.max(0, (prev ?? maxChatScroll) - 1));
    }
    if (input === "G") setChatScroll(null); // follow mode
    if (input === "g") setChatScroll(0);
  }, { isActive: focus === "chat" });

  const handleSubmit = async (value: string): Promise<void> => {
    if (!value.trim() || loading) return;
    setEntries((prev) => [...prev, { type: "user", content: value }]);
    setChatInput("");
    setChatScroll(null); // snap to follow mode on send
    setLoading(true);
    try {
      const response = await api.sendChat(sessionId, value);
      // REST response is a fallback — WS events should have already populated entries
      // Only add if nothing was streamed
      setEntries((prev) => {
        let lastUserIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].type === "user") { lastUserIdx = i; break; }
        }
        const hasAiText = prev.some((e, i) => i > lastUserIdx && e.type === "ai-text");
        if (!hasAiText && response) {
          return [...prev, { type: "ai-text", content: response }];
        }
        return prev;
      });
    } catch (err: any) {
      setEntries((prev) => [...prev, { type: "ai-text", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Focus indicator text
  const focusHints: Record<FocusMode, string> = {
    artifacts: "h/l tabs · j/k scroll · g/G top/bottom",
    chat: "j/k scroll history · G follow · g top",
    input: "type message · Enter send",
  };

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Header */}
      <Box flexShrink={0}>
        <Panel title={`Review: PR #${item.pr.number} - ${item.pr.title}`} focused>
          {worktreePath && (
            <Text dimColor>worktree: <Text color="gray">{worktreePath}</Text></Text>
          )}
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>
              Tab cycle focus · Esc {focus !== "input" ? "→ input" : "end review"}
            </Text>
            <Text color="cyan">[{focus}] {focusHints[focus]}</Text>
          </Box>
        </Panel>
      </Box>

      {/* Tab bar */}
      <Box flexDirection="row" gap={1} paddingX={1} flexShrink={0}>
        {tabs.map((tab, i) => (
          <Text key={i} bold={i === activeTab} color={i === activeTab ? "cyan" : "gray"}>
            {i === activeTab ? `▸${tab}` : tab}
          </Text>
        ))}
        {focus === "artifacts" && artifactLines.length > (paneHeight - 2) && (
          <Text dimColor> [{artifactScroll + 1}-{Math.min(artifactScroll + paneHeight - 2, artifactLines.length)}/{artifactLines.length}]</Text>
        )}
      </Box>

      {/* Split pane */}
      <Box flexDirection="row" flexGrow={1} width={cols}>
        {/* Left: Artifacts */}
        <Box flexDirection="column" width={halfWidth}>
          <Panel
            title={artifact?.title ?? "Artifacts"}
            focused={focus === "artifacts"}
            borderColor={focus === "artifacts" ? "cyan" : "gray"}
          >
            {artifact ? (
              <Text>
                {artifactLines.slice(artifactScroll, artifactScroll + paneHeight - 2).join("\n")}
              </Text>
            ) : (
              <Text dimColor>No artifacts</Text>
            )}
          </Panel>
        </Box>

        {/* Right: Chat + Input */}
        <Box flexDirection="column" width={cols - halfWidth}>
          {/* Chat history (scrollable) */}
          <Panel
            title={`Chat${chatScroll !== null ? ` [scroll ${effectiveChatScroll + 1}/${allChatLines.length}]` : ""}`}
            focused={focus === "chat"}
            borderColor={focus === "chat" ? "cyan" : "gray"}
          >
            <Box flexDirection="column" height={chatHeight}>
              {entries.length === 0 && !loading && (
                <Text dimColor>Ask about the PR, code, or artifacts...</Text>
              )}
              {visibleChatLines.map((line, i) => (
                <Text key={i} color={line.color} wrap="wrap">
                  {line.text}
                </Text>
              ))}
            </Box>
          </Panel>

          {/* Input area */}
          <Box
            flexDirection="column"
            paddingX={1}
            flexShrink={0}
            borderStyle={focus === "input" ? "round" : undefined}
            borderColor={focus === "input" ? "cyan" : undefined}
          >
            <Box flexDirection="row">
              <Text color={focus === "input" ? "green" : "gray"}>{'> '}</Text>
              {focus === "input" ? (
                <TextInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSubmit={handleSubmit}
                  placeholder="Type a message... (Enter to send)"
                />
              ) : (
                <Text dimColor>{chatInput || "(Tab to focus input)"}</Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
