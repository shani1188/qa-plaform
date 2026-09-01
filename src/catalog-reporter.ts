import type { FullConfig, Reporter, Suite } from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export default class CatalogReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {
    const outputDir = process.env.QA_OUTPUT_DIR ?? "qa-results";
    const tests = suite.allTests().map((test) => ({
      id: test.id,
      title: test.title,
      titlePath: test.titlePath(),
      project: test.parent.project()?.name ?? "unknown",
      file: path.relative(config.rootDir, test.location.file).replaceAll("\\", "/"),
      line: test.location.line,
      tags: test.tags
    }));
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "test-catalog.json"), JSON.stringify({ schemaVersion: "1.0", generatedAt: new Date().toISOString(), count: tests.length, tests }, null, 2));
  }
}

