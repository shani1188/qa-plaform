import { appendFile } from "node:fs/promises";
import { getOpenPullRequest, githubConfig, githubRequest } from "../src/github.js";

const prNumber = Number(process.env.PR_NUMBER ?? 0);
const repo = githubConfig().repository;
const pullRequest = await getOpenPullRequest(prNumber);
const sha = pullRequest.headSha;
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) console.log("The pull request head changed; testing the current open head revision.");
const deadline = Date.now() + Number(process.env.PREVIEW_TIMEOUT_MS ?? 600_000);
let preview = "";
while (Date.now() < deadline && !preview) {
  const deployments = await githubRequest<Array<{ id: number; environment?: string }>>(`/repos/${repo}/deployments?sha=${sha}&per_page=30`);
  for (const deployment of deployments.filter((item) => /preview/i.test(item.environment ?? ""))) {
    const list = await githubRequest<Array<{ state: string; environment_url?: string; target_url?: string }>>(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=10`);
    const ready = list.find((item) => item.state === "success" && (item.environment_url || item.target_url));
    if (ready) { preview = ready.environment_url || ready.target_url || ""; break; }
  }
  if (!preview) await new Promise((resolve) => setTimeout(resolve, 10_000));
}
if (!preview) throw new Error("A successful preview deployment URL was not found before timeout.");
for (let attempt = 1; attempt <= 30; attempt++) {
  const health = await fetch(new URL("/api/health", preview), { redirect: "follow" }).catch(() => null);
  if (health?.ok) break;
  if (attempt === 30) throw new Error("Preview deployment did not become healthy.");
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `url=${preview}\nsha=${sha}\npr=${prNumber}\n`);
console.log(`Preview is ready: ${new URL(preview).origin}`);
