import { readFile } from "node:fs/promises";
import { qaResultSchema } from "../src/result-schema.js";

const result = qaResultSchema.parse(JSON.parse(await readFile(process.argv[2] ?? "qa-results/summary.json", "utf8")));
const ai = JSON.parse(await readFile(process.argv[3] ?? "qa-results/ai-analysis.json", "utf8").catch(() => "{\"enabled\":false,\"summary\":\"AI advisory unavailable.\",\"suggestions\":[]}")) as { enabled: boolean; summary: string; suggestions: Array<{ title: string; rationale: string }> };
const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY;
const repo = process.env.TARGET_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? result.run.repository;
if (!token || !repo) throw new Error("GITHUB_TOKEN and a target GitHub repository are required.");
const [owner, name] = repo.split("/");
const api = process.env.GITHUB_API_URL ?? "https://api.github.com";
const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
const publicHeaders = { Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
const request = async (path: string, init: RequestInit = {}) => {
  let response = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET" && response.status === 404) {
    response = await fetch(`${api}${path}`, { ...init, headers: { ...publicHeaders, ...(init.headers ?? {}) } });
  }
  if (!response.ok) throw new Error(`GitHub request failed: ${init.method ?? "GET"} ${path} (${response.status}).`);
  return response.status === 204 ? null : response.json();
};
const currentPullRequest = await request(`/repos/${owner}/${name}/pulls/${result.run.prNumber}`) as { state: string };
if (currentPullRequest.state !== "open") throw new Error(`Pull request ${result.run.prNumber} is no longer open; reporting was skipped.`);
const labelDefinitions = [
  ["qa-bug", "B42318", "Confirmed by deterministic QA"], ["severity:critical", "8B0000", "Critical QA defect"],
  ["severity:high", "D93F0B", "High-severity QA defect"], ["severity:medium", "FBCA04", "Medium-severity QA defect"],
  ["severity:low", "0E8A16", "Low-severity QA defect"], ["qa:functional", "5319E7", "Functional behavior failure"],
  ["qa:api", "1D76DB", "API contract failure"], ["qa:accessibility", "7057FF", "Accessibility failure"]
];
for (const [labelName, color, description] of labelDefinitions) {
  const response = await fetch(`${api}/repos/${owner}/${name}/labels`, { method: "POST", headers, body: JSON.stringify({ name: labelName, color, description }) });
  if (!response.ok && response.status !== 422) throw new Error(`Could not ensure label ${labelName} (${response.status}).`);
}
const issueLinks: string[] = [];
for (const failure of result.failures.filter((item) => item.suite !== "infrastructure")) {
  const marker = `<!-- qa-fingerprint:${failure.fingerprint} -->`;
  const query = encodeURIComponent(`repo:${repo} is:issue in:body "qa-fingerprint:${failure.fingerprint}"`);
  const search = await request(`/search/issues?q=${query}`) as { items: Array<{ number: number; html_url: string }> };
  const body = `${marker}\n## Automated QA defect\n\n**Suite:** ${failure.suite}\n**Severity:** ${failure.severity}\n**Route:** ${failure.route}\n\n### Expected\n${failure.expected}\n\n### Actual\n${failure.actual}\n\n### Reproduction\n${failure.reproduction.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n### Evidence\n${failure.evidence.length ? failure.evidence.map((item) => `- ${item}`).join("\n") : `- [Open the QA workflow run](${result.run.runUrl})`}\n\nOriginating PR: #${result.run.prNumber}`;
  let issue;
  if (search.items[0]) issue = await request(`/repos/${owner}/${name}/issues/${search.items[0].number}`, { method: "PATCH", body: JSON.stringify({ body, state: "open", labels: ["qa-bug", `severity:${failure.severity}`, `qa:${failure.suite}`] }) });
  else issue = await request(`/repos/${owner}/${name}/issues`, { method: "POST", body: JSON.stringify({ title: `[QA] ${failure.title}`, body, labels: ["qa-bug", `severity:${failure.severity}`, `qa:${failure.suite}`] }) });
  issueLinks.push(`- [${failure.title}](${issue.html_url})`);
}
const icon = result.status === "passed" ? "✅" : result.status === "partial" ? "⚠️" : "❌";
const commentMarker = "<!-- ai-pr-qa-report -->";
const failures = result.failures.length ? result.failures.map((item) => `| ${item.severity} | ${item.suite} | ${item.title} | \`${item.fingerprint}\` |`).join("\n") : "| — | — | No deterministic failures | — |";
const suggestions = ai.suggestions?.length ? ai.suggestions.map((item) => `- **${item.title}:** ${item.rationale}`).join("\n") : "- No AI-generated exploratory suggestions are available.";
const body = `${commentMarker}\n## ${icon} Pull request QA: ${result.status.toUpperCase()}\n\n| Passed | Failed | Skipped |\n|---:|---:|---:|\n| ${result.counts.passed} | ${result.counts.failed} | ${result.counts.skipped} |\n\nCoverage: ${result.coverage.join(", ")} · [Workflow evidence](${result.run.runUrl})\n\n### Confirmed failures\n| Severity | Area | Check | Fingerprint |\n|---|---|---|---|\n${failures}\n\n### Defect records\n${issueLinks.length ? issueLinks.join("\n") : "No confirmed defects were created."}\n\n### AI advisory\n${ai.summary}\n\n${suggestions}\n\n> AI content is advisory. Only deterministic checks affect this result or create defects.\n${result.notes.map((note) => `\n> ${note}`).join("")}`;
const comments = await request(`/repos/${owner}/${name}/issues/${result.run.prNumber}/comments?per_page=100`) as Array<{ id: number; body?: string }>;
const existing = comments.find((comment) => comment.body?.includes(commentMarker));
if (existing) await request(`/repos/${owner}/${name}/issues/comments/${existing.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
else await request(`/repos/${owner}/${name}/issues/${result.run.prNumber}/comments`, { method: "POST", body: JSON.stringify({ body }) });
console.log(`Updated the managed QA comment for pull request ${result.run.prNumber}.`);
