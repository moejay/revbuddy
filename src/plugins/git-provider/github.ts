import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  GitProvider,
  Repo,
  PullRequest,
  PRFilter,
  PRChecks,
  LocalRepo,
  Worktree,
} from "../../core/types.js";

const exec = promisify(execFile);

async function gh(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await exec("gh", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GH_PAGER: "" },
  });
  return stdout.trim();
}

export class GitHubProvider implements GitProvider {
  id = "github";
  type = "provider" as const;
  name = "GitHub";
  version = "1.0.0";
  private cloneBasePath = "/tmp/revbuddy/repos";

  async init(config: Record<string, unknown>): Promise<void> {
    if (config.cloneBasePath) {
      this.cloneBasePath = config.cloneBasePath as string;
    }
    await mkdir(this.cloneBasePath, { recursive: true });
  }

  async destroy(): Promise<void> {}

  async listRepos(): Promise<Repo[]> {
    const json = await gh([
      "repo", "list", "--json",
      "name,nameWithOwner,url,defaultBranchRef,isPrivate,description",
      "--limit", "100",
    ]);
    const repos = JSON.parse(json);
    return repos.map((r: any) => ({
      id: r.nameWithOwner,
      name: r.name,
      fullName: r.nameWithOwner,
      url: r.url,
      defaultBranch: r.defaultBranchRef?.name ?? "main",
      private: r.isPrivate,
      description: r.description ?? "",
    }));
  }

  async getPR(repoId: string, prNumber: number): Promise<PullRequest> {
    const json = await gh([
      "pr", "view", String(prNumber),
      "--repo", repoId,
      "--json", "number,title,author,headRefName,baseRefName,body,labels,state,url,createdAt,updatedAt,headRefOid,additions,deletions,changedFiles,isDraft",
    ]);
    const pr = JSON.parse(json);
    return this.mapPR(pr, repoId);
  }

  async listPRs(repoId: string, filters?: PRFilter): Promise<PullRequest[]> {
    const args = [
      "pr", "list",
      "--repo", repoId,
      "--json", "number,title,author,headRefName,baseRefName,body,labels,state,url,createdAt,updatedAt,headRefOid,additions,deletions,changedFiles,isDraft",
      "--limit", "50",
    ];
    if (filters?.state) {
      args.push("--state", filters.state === "open" ? "open" : filters.state === "merged" ? "merged" : "closed");
    }
    if (filters?.labels?.length) {
      for (const label of filters.labels) {
        args.push("--label", label);
      }
    }
    const json = await gh(args);
    if (!json) return [];
    const prs = JSON.parse(json);
    let results = prs.map((pr: any) => this.mapPR(pr, repoId));
    if (filters?.authors?.length) {
      results = results.filter((pr: PullRequest) => filters.authors!.includes(pr.author));
    }
    // Exclude drafts by default
    if (!filters?.includeDrafts) {
      results = results.filter((pr: PullRequest) => !pr.draft);
    }
    return results;
  }

  async getChecks(repoId: string, prNumber: number): Promise<PRChecks> {
    try {
      const json = await gh([
        "pr", "checks", String(prNumber),
        "--repo", repoId,
        "--json", "bucket",
      ]);
      const checks: Array<{ bucket: string }> = JSON.parse(json || "[]");
      const result: PRChecks = { total: checks.length, pass: 0, fail: 0, pending: 0, skipping: 0 };
      for (const c of checks) {
        if (c.bucket === "pass") result.pass++;
        else if (c.bucket === "fail" || c.bucket === "cancel") result.fail++;
        else if (c.bucket === "pending") result.pending++;
        else if (c.bucket === "skipping") result.skipping++;
      }
      return result;
    } catch {
      return { total: 0, pass: 0, fail: 0, pending: 0, skipping: 0 };
    }
  }

  async getDiff(repoId: string, prNumber: number): Promise<string> {
    return await gh(["pr", "diff", String(prNumber), "--repo", repoId]);
  }

  async cloneRepo(repoId: string, destination?: string): Promise<LocalRepo> {
    const dest = destination ?? join(this.cloneBasePath, repoId.replace("/", "__"));
    try {
      // Try to update existing clone
      await exec("git", ["rev-parse", "--git-dir"], { cwd: dest });
      await exec("git", ["fetch", "--all"], { cwd: dest });
      const { stdout } = await exec("git", ["symbolic-ref", "--short", "HEAD"], { cwd: dest });
      return { repoId, path: dest, branch: stdout.trim() };
    } catch {
      // Remove stale directory if it exists but isn't a valid git repo
      await rm(dest, { recursive: true, force: true });
      await mkdir(join(dest, ".."), { recursive: true });
      await gh(["repo", "clone", repoId, dest]);
      const { stdout } = await exec("git", ["symbolic-ref", "--short", "HEAD"], { cwd: dest });
      return { repoId, path: dest, branch: stdout.trim() };
    }
  }

  async createWorktree(localRepo: LocalRepo, branch: string): Promise<Worktree> {
    const sanitized = branch.replace(/[^a-zA-Z0-9_-]/g, "_");
    const wtPath = join(this.cloneBasePath, "worktrees", `${localRepo.repoId.replace("/", "__")}__${sanitized}`);
    await mkdir(join(wtPath, ".."), { recursive: true });

    // Check if worktree already exists and is valid
    try {
      await exec("git", ["rev-parse", "--git-dir"], { cwd: wtPath });
      // Worktree exists and is valid — reuse it
      await exec("git", ["checkout", branch], { cwd: wtPath }).catch(() => {});
      return { repoId: localRepo.repoId, path: wtPath, branch };
    } catch {
      // Worktree doesn't exist or is invalid — clean up and create
    }

    // Remove stale worktree directory if present
    await rm(wtPath, { recursive: true, force: true });
    try {
      await exec("git", ["worktree", "prune"], { cwd: localRepo.path });
    } catch {}

    try {
      await exec("git", ["worktree", "add", wtPath, branch], { cwd: localRepo.path });
    } catch {
      // Branch might not exist locally, fetch first
      try {
        await exec("git", ["fetch", "origin", `${branch}:${branch}`], { cwd: localRepo.path });
      } catch {
        // Branch already exists locally but wasn't checked out — that's fine
      }
      await exec("git", ["worktree", "add", wtPath, branch], { cwd: localRepo.path });
    }
    return { repoId: localRepo.repoId, path: wtPath, branch };
  }

  async destroyWorktree(worktree: Worktree): Promise<void> {
    // Find the main repo path to run git worktree remove
    const mainRepoPath = join(this.cloneBasePath, worktree.repoId.replace("/", "__"));
    try {
      await exec("git", ["worktree", "remove", worktree.path, "--force"], { cwd: mainRepoPath });
    } catch {
      // Fallback: just remove the directory
      await rm(worktree.path, { recursive: true, force: true });
    }
  }

  private mapPR(raw: any, repoId: string): PullRequest {
    return {
      id: `${repoId}#${raw.number}`,
      number: raw.number,
      title: raw.title,
      author: raw.author?.login ?? raw.author?.name ?? "unknown",
      branch: raw.headRefName,
      baseBranch: raw.baseRefName,
      description: raw.body ?? "",
      labels: (raw.labels ?? []).map((l: any) => l.name ?? l),
      state: raw.state?.toLowerCase() === "merged" ? "merged" as any : raw.state?.toLowerCase() === "closed" ? "closed" : "open",
      repoId,
      url: raw.url,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      headSha: raw.headRefOid ?? "",
      additions: raw.additions ?? 0,
      deletions: raw.deletions ?? 0,
      changedFiles: raw.changedFiles ?? 0,
      draft: raw.isDraft ?? false,
    };
  }
}
