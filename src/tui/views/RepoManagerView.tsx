import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Panel } from "../components/Box.js";
import type { APIClient } from "../api-client.js";

interface RepoManagerViewProps {
  api: APIClient;
  cols: number;
  rows: number;
  onBack: () => void;
}

export function RepoManagerView({ api, cols, rows, onBack }: RepoManagerViewProps): React.ReactElement {
  const [repos, setRepos] = useState<Array<{ id: string; fullName: string }>>([]);
  const [cursor, setCursor] = useState(0);
  const [addMode, setAddMode] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const data = await api.getRepos();
      setRepos(data);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  useEffect(() => { load(); }, []);

  useInput((input, key) => {
    if (addMode) return; // TextInput handles input

    if (key.escape || input === "q") onBack();
    if (input === "j" || key.downArrow) setCursor((c) => Math.min(c + 1, repos.length - 1));
    if (input === "k" || key.upArrow) setCursor((c) => Math.max(c - 1, 0));
    if (input === "a") {
      setAddMode(true);
      setNewRepo("");
    }
    if (input === "d" && repos[cursor]) {
      handleRemove(repos[cursor].id);
    }
  }, { isActive: !addMode });

  const handleAdd = async (value: string): Promise<void> => {
    if (!value.trim()) {
      setAddMode(false);
      return;
    }
    try {
      await api.addRepo(value.trim());
      setMessage(`Added ${value.trim()}`);
      await load();
    } catch (err: any) {
      setMessage(`Error adding repo: ${err.message}`);
    }
    setAddMode(false);
    setNewRepo("");
  };

  const handleRemove = async (repoId: string): Promise<void> => {
    try {
      await api.removeRepo(repoId);
      setMessage(`Removed ${repoId}`);
      await load();
      setCursor((c) => Math.min(c, repos.length - 2));
    } catch (err: any) {
      setMessage(`Error removing repo: ${err.message}`);
    }
  };

  const contentRows = rows - 6; // header + footer + borders

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {/* Header - pinned */}
      <Panel title="Manage Repositories" focused>
        <Text dimColor>
          a add · d remove · j/k navigate · Esc/q back
        </Text>
      </Panel>

      {/* Repo list - scrollable area */}
      <Box flexDirection="column" flexGrow={1}>
        <Panel title={`Repos (${repos.length})`} borderColor="gray">
          {repos.length === 0 && (
            <Text dimColor>No repos configured. Press 'a' to add one.</Text>
          )}
          {repos.map((repo, i) => {
            const selected = i === cursor;
            return (
              <Box key={repo.id} flexDirection="row" gap={1}>
                <Text>{selected ? "▸" : " "}</Text>
                <Text bold={selected} color={selected ? "cyan" : "white"}>
                  {repo.fullName}
                </Text>
              </Box>
            );
          })}
        </Panel>
      </Box>

      {/* Add repo input */}
      {addMode && (
        <Box paddingX={2} flexShrink={0}>
          <Text color="green">Add repo (owner/name): </Text>
          <TextInput
            value={newRepo}
            onChange={setNewRepo}
            onSubmit={handleAdd}
            placeholder="e.g. moejay/tim"
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
