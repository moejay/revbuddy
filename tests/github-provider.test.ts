import { describe, it, expect, beforeAll } from "vitest";
import { GitHubProvider } from "../src/plugins/git-provider/github.js";

// Integration tests - require gh CLI auth
describe("GitHubProvider", () => {
  let provider: GitHubProvider;

  beforeAll(async () => {
    provider = new GitHubProvider();
    await provider.init({ cloneBasePath: "/tmp/revbuddy-test/repos" });
  });

  it("lists repos", async () => {
    const repos = await provider.listRepos();
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0]).toHaveProperty("id");
    expect(repos[0]).toHaveProperty("fullName");
  });

  it("lists PRs for moejay/tim", async () => {
    const prs = await provider.listPRs("moejay/tim");
    // May or may not have PRs
    expect(Array.isArray(prs)).toBe(true);
  });

  it("lists PRs for onorderinc/opener-grow", async () => {
    const prs = await provider.listPRs("onorderinc/opener-grow");
    expect(Array.isArray(prs)).toBe(true);
  });

  it("fetches a specific PR if any exist", async () => {
    const prs = await provider.listPRs("moejay/tim");
    if (prs.length > 0) {
      const pr = await provider.getPR("moejay/tim", prs[0].number);
      expect(pr.number).toBe(prs[0].number);
      expect(pr.title).toBeTruthy();
      expect(pr.author).toBeTruthy();
    }
  });

  it("fetches diff for a PR if any exist", async () => {
    const prs = await provider.listPRs("moejay/tim");
    if (prs.length > 0) {
      const diff = await provider.getDiff("moejay/tim", prs[0].number);
      expect(typeof diff).toBe("string");
    }
  });

  it("clones a repo", async () => {
    const localRepo = await provider.cloneRepo("moejay/tim");
    expect(localRepo.path).toBeTruthy();
    expect(localRepo.branch).toBeTruthy();
  }, 60000);
});
