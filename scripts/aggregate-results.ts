import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { qaResultSchema, type QaResult } from "../src/result-schema.js";

type PwTest = { title: string; expectedStatus?: string; results?: Array<{ status?: string; error?: { message?: string }; attachments?: Array<{ name: string; path?: string }> }> };
type PwSuite = { title: string; specs?: Array<{ title: string; tests: PwTest[] }>; suites?: PwSuite[] };
type PwReport = { suites?: PwSuite[] };

const sanitize = (input: string, max = 2000) => input
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
  .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
  .replace(/https?:\/\/[^\s)]+/g, (value) => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return "[URL]"; } })
  .replace(/\s+/g, " ").trim().slice(0, max);
const fingerprint = (title: string, route: string, actual: string) => createHash("sha256").update(`${title}|${route}|${actual.replace(/\d+/g, "#")}`).digest("hex").slice(0, 16);
const suiteType = (project: string) => project.includes("api") ? "api" : project.includes("accessibility") ? "accessibility" : "functional";

function flatten(suites: PwSuite[], parents: string[] = []): Array<{ path: string[]; test: PwTest }> {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests.map((test) => ({ path: [...parents, suite.title, spec.title], test }))),
    ...flatten(suite.suites ?? [], [...parents, suite.title])
  ]);
}

const input = process.argv[2] ?? "qa-results/playwright.json";
const output = process.argv[3] ?? "qa-results/summary.json";
const reports: PwReport[] = [];
try {
  if ((await stat(input)).isDirectory()) {
    const files = await readdir(input, { recursive: true });
    for (const file of files.filter((name) => name.endsWith("playwright.json"))) reports.push(JSON.parse(await readFile(path.join(input, file), "utf8")));
  } else reports.push(JSON.parse(await readFile(input, "utf8")));
} catch { /* Infrastructure failure is represented below. */ }

let passed = 0, failed = 0, skipped = 0;
const failures: QaResult["failures"] = [];
for (const { path: testPath, test } of reports.flatMap((report) => flatten(report.suites ?? []))) {
  const result = test.results?.at(-1);
  const status = result?.status ?? "skipped";
  if (status === "passed") { passed++; continue; }
  if (status === "skipped") { skipped++; continue; }
  failed++;
  const project = testPath.join(" ").toLowerCase();
  const category = suiteType(project);
  const actual = sanitize(result?.error?.message ?? "The test did not complete successfully.");
  const title = sanitize(test.title, 240);
  const route = sanitize((actual.match(/https?:\/\/[^\s]+(\/[^\s]*)/)?.[1] ?? "unspecified"), 200);
  failures.push({
    fingerprint: fingerprint(title, route, actual), suite: category, title, route,
    severity: category === "accessibility" ? "medium" : "high",
    expected: "The deterministic automated check should pass.", actual,
    reproduction: [`Open the pull request preview.`, `Run the ${category} test named “${title}”.`, "Observe the recorded failure."],
    evidence: (result?.attachments ?? []).map((item) => item.path ? `${item.name}: ${path.basename(item.path)}` : item.name).slice(0, 12)
  });
}
if (!reports.length) {
  failed++;
  const actual = "Playwright results were unavailable; inspect the workflow logs and preview deployment.";
  failures.push({ fingerprint: fingerprint("Test infrastructure did not produce results", "preview", actual), suite: "infrastructure", title: "Test infrastructure did not produce results", route: "preview", severity: "high", expected: "The test runner should produce a machine-readable report.", actual, reproduction: ["Open the QA workflow run.", "Inspect preview resolution and Playwright startup logs."], evidence: [] });
}
const trusted = Boolean(process.env.QA_USER_EMAIL && process.env.QA_USER_PASSWORD);
const result: QaResult = {
  schemaVersion: "1.0",
  run: { repository: process.env.GITHUB_REPOSITORY ?? "local/demo", sha: process.env.GITHUB_SHA ?? "local", prNumber: Number(process.env.PR_NUMBER ?? 1), runUrl: process.env.RUN_URL ?? "", createdAt: new Date().toISOString() },
  status: failed ? "failed" : skipped && !trusted ? "partial" : "passed",
  counts: { passed, failed, skipped }, coverage: ["functional", "api", "accessibility"], failures,
  notes: trusted ? [] : ["Authenticated checks were skipped because privileged QA credentials are intentionally unavailable to forked pull requests."]
};
qaResultSchema.parse(result);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2));
console.log(`Wrote ${output}: ${result.status} (${passed} passed, ${failed} failed, ${skipped} skipped).`);
