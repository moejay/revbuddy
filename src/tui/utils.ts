import { execFile } from "node:child_process";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

const marked = new Marked(markedTerminal({ tab: 2 }));

export function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= width) {
      result.push(line);
    } else {
      let remaining = line;
      while (remaining.length > width) {
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

/**
 * Render markdown to ANSI-styled terminal text, then wrap to width.
 */
export function renderMarkdown(content: string, width: number): string[] {
  const rendered = marked.parse(content) as string;
  // marked-terminal returns ANSI-colored string, split into lines and wrap
  return wrapText(rendered.trimEnd(), width);
}

export function terminalLink(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

export function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  execFile(cmd, args, () => {});
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  hunks: string;
}

export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const parts = diff.split(/^diff --git /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const match = lines[0].match(/a\/(.+?) b\/(.+)/);
    if (!match) continue;
    const path = match[2];
    let additions = 0;
    let deletions = 0;
    const hunkLines: string[] = [];
    let inHunk = false;
    for (const line of lines.slice(1)) {
      if (line.startsWith("@@")) {
        inHunk = true;
        hunkLines.push(line);
      } else if (inHunk) {
        hunkLines.push(line);
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) deletions++;
      }
    }
    files.push({ path, additions, deletions, hunks: hunkLines.join("\n") });
  }
  return files;
}
