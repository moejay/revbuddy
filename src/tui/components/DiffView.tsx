import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { DiffFile } from "../utils.js";

interface DiffViewProps {
  files: DiffFile[];
  width: number;
  height: number;
  isActive: boolean;
  onReference?: (filePath: string, hunkText: string) => void;
}

export function DiffView({ files, width, height, isActive, onReference }: DiffViewProps): React.ReactElement {
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);

  const lines = useMemo(() => {
    const result: Array<{ type: string; text: string; fileIndex: number; isFileHeader: boolean }> = [];
    files.forEach((file, i) => {
      const arrow = expanded.has(i) ? "▾" : "▸";
      const sel = i === cursor ? "›" : " ";
      result.push({
        type: "file",
        text: `${sel} ${arrow} ${file.path}  +${file.additions}/-${file.deletions}`,
        fileIndex: i,
        isFileHeader: true,
      });
      if (expanded.has(i)) {
        for (const line of file.hunks.split("\n")) {
          if (!line) continue;
          let type = "context";
          if (line.startsWith("@@")) type = "hunk-header";
          else if (line.startsWith("+")) type = "add";
          else if (line.startsWith("-")) type = "del";
          result.push({ type, text: `    ${line}`, fileIndex: i, isFileHeader: false });
        }
      }
    });
    return result;
  }, [files, cursor, expanded]);

  const cursorLineIndex = useMemo(() => {
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].isFileHeader && lines[idx].fileIndex === cursor) return idx;
    }
    return 0;
  }, [lines, cursor]);

  useEffect(() => {
    setScrollOffset((prev) => {
      if (cursorLineIndex < prev) return cursorLineIndex;
      if (cursorLineIndex >= prev + height) return cursorLineIndex - height + 1;
      return prev;
    });
  }, [cursorLineIndex, height]);

  useInput((input, key) => {
    if (input === "j" || key.downArrow) setCursor((c) => Math.min(c + 1, files.length - 1));
    if (input === "k" || key.upArrow) setCursor((c) => Math.max(c - 1, 0));
    if (key.return || input === " ") {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(cursor)) next.delete(cursor);
        else next.add(cursor);
        return next;
      });
    }
    if (input === "c" && onReference && files[cursor]) {
      onReference(files[cursor].path, files[cursor].hunks);
    }
  }, { isActive });

  const visibleLines = lines.slice(scrollOffset, scrollOffset + height);

  if (files.length === 0) {
    return <Text dimColor>No diff available</Text>;
  }

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, i) => {
        let color: string | undefined;
        let dim = false;
        let bold = false;
        if (line.type === "file") {
          color = line.fileIndex === cursor ? "cyan" : "white";
          bold = line.fileIndex === cursor;
        } else if (line.type === "hunk-header") color = "blue";
        else if (line.type === "add") color = "green";
        else if (line.type === "del") color = "red";
        else dim = true;
        return (
          <Text key={scrollOffset + i} color={color} dimColor={dim} bold={bold} wrap="truncate-end">
            {line.text}
          </Text>
        );
      })}
    </Box>
  );
}
