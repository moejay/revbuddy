---
name: git-provider
description: Pluggable git hosting backend interface for repo access, cloning, and worktree management
group: infrastructure
tags: [git, provider, pluggable]
depends_on:
  - name: plugin-system
    uses: [plugin-registration, plugin-discovery]
features: features/git-provider/
---

# Git Provider

Abstraction over git hosting backends (GitHub, GitLab, Bitbucket, etc.). Each backend is a plugin. Handles repo access, cloning/forking, worktree creation, and PR data retrieval.

## Responsibilities

- **Repo management** — clone, fork, pull, worktree create/destroy
- **PR data** — fetch PR metadata, diff, files changed, comments
- **Authentication** — per-provider auth (tokens, OAuth, SSH)
- **Webhook/polling** — receive or poll for PR events

## Provider Interface

```
GitProvider extends Plugin {
  listRepos(): Promise<Repo[]>
  getPR(repoId, prNumber): Promise<PullRequest>
  listPRs(repoId, filters): Promise<PullRequest[]>
  cloneRepo(repoId, destination): Promise<LocalRepo>
  createWorktree(localRepo, branch): Promise<Worktree>
  destroyWorktree(worktree): Promise<void>
}
```

## Initial Implementation

- GitHub provider using `gh` CLI and GitHub API
- Local filesystem provider for testing
