import "dotenv/config";
import { z } from "zod";

const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "GITHUB_REPOSITORY must use owner/repository format.");

export type OpenPullRequest = {
  number: number;
  title: string;
  body?: string;
  headSha: string;
  htmlUrl: string;
  draft: boolean;
};

export function githubConfig() {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY;
  const repository = repositorySchema.parse(process.env.GITHUB_REPOSITORY);
  if (!token) throw new Error("Set GITHUB_TOKEN (preferred) or GITHUB_API_KEY.");
  return {
    token,
    repository,
    apiUrl: (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "")
  };
}

export async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = githubConfig();
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-github-request-id");
    throw new Error(`GitHub API request failed (${response.status})${requestId ? `, request ${requestId}` : ""}.`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export async function getRepository() {
  const { repository } = githubConfig();
  return githubRequest<{ full_name: string; private: boolean; archived: boolean; permissions?: { pull?: boolean; push?: boolean } }>(`/repos/${repository}`);
}

export async function listOpenPullRequests(): Promise<OpenPullRequest[]> {
  const { repository } = githubConfig();
  const all: OpenPullRequest[] = [];
  for (let page = 1; page <= 10; page++) {
    const pulls = await githubRequest<Array<{ number: number; title: string; state: string; draft?: boolean; html_url: string; head: { sha: string } }>>(
      `/repos/${repository}/pulls?state=open&sort=updated&direction=desc&per_page=100&page=${page}`
    );
    all.push(...pulls.filter((pr) => pr.state === "open").map((pr) => ({ number: pr.number, title: pr.title, headSha: pr.head.sha, htmlUrl: pr.html_url, draft: Boolean(pr.draft) })));
    if (pulls.length < 100) break;
  }
  return all;
}

export async function getOpenPullRequest(number: number): Promise<OpenPullRequest> {
  if (!Number.isInteger(number) || number < 1) throw new Error("PR_NUMBER must be a positive integer.");
  const { repository } = githubConfig();
  const pr = await githubRequest<{ number: number; title: string; body?: string | null; state: string; draft?: boolean; html_url: string; head: { sha: string } }>(`/repos/${repository}/pulls/${number}`);
  if (pr.state !== "open") throw new Error(`Pull request ${number} is ${pr.state}; only open pull requests may be tested.`);
  return { number: pr.number, title: pr.title, body: pr.body ?? "", headSha: pr.head.sha, htmlUrl: pr.html_url, draft: Boolean(pr.draft) };
}

export async function getPullRequestFiles(number: number): Promise<string[]> {
  if (!Number.isInteger(number) || number < 1) throw new Error("PR_NUMBER must be a positive integer.");
  const { repository } = githubConfig();
  const files: string[] = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await githubRequest<Array<{ filename: string }>>(`/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`);
    files.push(...batch.map(({ filename }) => filename));
    if (batch.length < 100) break;
  }
  return files;
}
