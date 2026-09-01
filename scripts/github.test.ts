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
  delete process.env.TARGET_GITHUB_REPOSITORY;
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

  it("prefers the non-reserved target repository in GitHub Actions", () => {
    process.env.GITHUB_REPOSITORY = "owner/qa-platform";
    process.env.TARGET_GITHUB_REPOSITORY = "owner/demo-app";
    expect(githubConfig().repository).toBe("owner/demo-app");
  });

  it("lists only open pull requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { number: 7, title: "Open", state: "open", draft: false, html_url: "https://example.test/pr/7", head: { sha: "abc" } },
      { number: 8, title: "Closed", state: "closed", draft: false, html_url: "https://example.test/pr/8", head: { sha: "def" } }
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(listOpenPullRequests()).resolves.toEqual([{ number: 7, title: "Open", headSha: "abc", htmlUrl: "https://example.test/pr/7", draft: false }]);
  });

  it("retries public GET requests without authorization after a scoped-token 404", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: 7, title: "Open", state: "open", html_url: "https://example.test/pr/7", head: { sha: "abc" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenPullRequest(7)).resolves.toMatchObject({ number: 7 });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer test-token");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).has("Authorization")).toBe(false);
  });

  it("rejects a pull request that is no longer open", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ number: 9, title: "Closed", state: "closed", html_url: "https://example.test/pr/9", head: { sha: "abc" } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(getOpenPullRequest(9)).rejects.toThrow(/only open pull requests/);
  });
});
