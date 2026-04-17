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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [lineCursor, setLineCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Build flat line list from files + expanded hunks
  const lines = useMemo(() => {
    const result: Array<{ type: string; text: string; fileIndex: number; isFileHeader: boolean }> = [];
    files.forEach((file, i) => {
      const arrow = expanded.has(i) ? "▾" : "▸";
      result.push({
        type: "file",
        text: `  ${arrow} ${file.path}  +${file.additions}/-${file.deletions}`,
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
  }, [files, expanded]);

  // Clamp cursor when lines change (e.g. collapse shrinks list)
  useEffect(() => {
    setLineCursor((c) => Math.min(c, Math.max(0, lines.length - 1)));
  }, [lines.length]);

  // Current line's file index (for reference command)
  const currentFileIndex = lines[lineCursor]?.fileIndex ?? 0;

  // Keep cursor visible in viewport
  useEffect(() => {
    setScrollOffset((prev) => {
      if (lineCursor < prev) return lineCursor;
      if (lineCursor >= prev + height) return lineCursor - height + 1;
      return prev;
    });
  }, [lineCursor, height]);

  useInput((input, key) => {
    if (input === "j" || key.downArrow) {
      setLineCursor((c) => Math.min(c + 1, lines.length - 1));
    }
    if (input === "k" || key.upArrow) {
      setLineCursor((c) => Math.max(c - 1, 0));
    }
    // Page down/up for faster scrolling
    if (input === "d" && key.ctrl) {
      setLineCursor((c) => Math.min(c + Math.floor(height / 2), lines.length - 1));
    }
    if (input === "u" && key.ctrl) {
      setLineCursor((c) => Math.max(c - Math.floor(height / 2), 0));
    }
    // Jump to next/prev file header
    if (input === "J") {
      const next = lines.findIndex((l, i) => i > lineCursor && l.isFileHeader);
      if (next !== -1) setLineCursor(next);
    }
    if (input === "K") {
      for (let i = lineCursor - 1; i >= 0; i--) {
        if (lines[i].isFileHeader) { setLineCursor(i); break; }
      }
    }
    // Toggle expand/collapse only on file header lines
    if (key.return || input === " ") {
      const line = lines[lineCursor];
      if (line?.isFileHeader) {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(line.fileIndex)) next.delete(line.fileIndex);
          else next.add(line.fileIndex);
          return next;
        });
      }
    }
    if (input === "c" && onReference && files[currentFileIndex]) {
      onReference(files[currentFileIndex].path, files[currentFileIndex].hunks);
    }
  }, { isActive });

  const visibleLines = lines.slice(scrollOffset, scrollOffset + height);

  if (files.length === 0) {
    return <Text dimColor>No diff available</Text>;
  }

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, i) => {
        const globalIdx = scrollOffset + i;
        const isCursorLine = globalIdx === lineCursor;
        let color: string | undefined;
        let dim = false;
        let bold = false;
        if (line.type === "file") {
          color = isCursorLine ? "cyan" : "white";
          bold = isCursorLine;
        } else if (line.type === "hunk-header") color = "blue";
        else if (line.type === "add") color = "green";
        else if (line.type === "del") color = "red";
        else dim = true;
        // Show cursor indicator
        const prefix = isCursorLine ? "›" : " ";
        const displayText = line.isFileHeader ? line.text : `${prefix}${line.text.slice(1)}`;
        return (
          <Text key={globalIdx} color={color} dimColor={dim} bold={bold} inverse={isCursorLine && !line.isFileHeader} wrap="truncate-end">
            {displayText}
          </Text>
        );
      })}
    </Box>
  );
}
