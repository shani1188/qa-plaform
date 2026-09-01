import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";

const files = [
  path.resolve(".github/workflows/reusable-pr-qa.yml"),
  path.resolve(".github/workflows/open-pr-qa.yml"),
  path.resolve(".github/workflows/dispatch-pr-qa.yml"),
  path.resolve("../demo-app/.github/workflows/pr-qa.yml"),
];
for (const file of files) {
  const document = parseDocument(await readFile(file, "utf8"), { prettyErrors: true });
  if (document.errors.length) throw new Error(`${file}: ${document.errors.map((error) => error.message).join("; ")}`);
  const workflow = document.toJS() as Record<string, unknown>;
  if (!workflow.on || !workflow.jobs) throw new Error(`${file}: workflow must define on and jobs.`);
}
console.log(`Validated ${files.length} GitHub Actions workflow files.`);
