import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenPullRequest, githubConfig, listOpenPullRequests } from "../src/github.js";

beforeEach(() => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY = "owner/repository";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_API_KEY;
  delete process.env.GITHUB_REPOSITORY;
});

describe("GitHub environment configuration", () => {
  it("accepts the API key alias", () => {
    delete process.env.GITHUB_TOKEN;
    process.env.GITHUB_API_KEY = "alias-token";
    expect(githubConfig()).toMatchObject({ token: "alias-token", repository: "owner/repository" });
  });

  it("rejects malformed repository names", () => {
    process.env.GITHUB_REPOSITORY = "repository-only";
    expect(() => githubConfig()).toThrow(/owner\/repository/);
  });

  it("lists only open pull requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { number: 7, title: "Open", state: "open", draft: false, html_url: "https://example.test/pr/7", head: { sha: "abc" } },
      { number: 8, title: "Closed", state: "closed", draft: false, html_url: "https://example.test/pr/8", head: { sha: "def" } }
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(listOpenPullRequests()).resolves.toEqual([{ number: 7, title: "Open", headSha: "abc", htmlUrl: "https://example.test/pr/7", draft: false }]);
  });

  it("rejects a pull request that is no longer open", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ number: 9, title: "Closed", state: "closed", html_url: "https://example.test/pr/9", head: { sha: "abc" } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(getOpenPullRequest(9)).rejects.toThrow(/only open pull requests/);
  });
});
