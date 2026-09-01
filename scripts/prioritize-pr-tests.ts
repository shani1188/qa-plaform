import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOpenPullRequest, getPullRequestFiles, githubConfig } from "../src/github.js";
import { prioritizeBugTests } from "../src/prioritization.js";

const prNumber = Number(process.env.PR_NUMBER ?? 0);
const pullRequest = await getOpenPullRequest(prNumber);
const changedFiles = await getPullRequestFiles(prNumber);
const decision = prioritizeBugTests(pullRequest.title, pullRequest.body ?? "", changedFiles);
const outputDir = process.env.QA_OUTPUT_DIR ?? "qa-results/priority";
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "pr-test-priority.json"), JSON.stringify({
  repository: githubConfig().repository,
  prNumber,
  title: pullRequest.title.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240),
  isBug: decision.isBug,
  focus: decision.focus,
  signals: decision.signals,
  changedFiles: changedFiles.slice(0, 500)
}, null, 2));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `is_bug=${decision.isBug}\nfocus=${decision.focus}\n`);
console.log(decision.isBug
  ? `Bug-related PR detected. Running ${decision.focus} positive, negative, and edge cases first.`
  : "No bug language detected; proceeding with the complete regression suite.");
