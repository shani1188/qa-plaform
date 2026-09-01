import { describe, expect, it } from "vitest";
import { qaResultSchema } from "../src/result-schema.js";

const valid = { schemaVersion: "1.0", run: { repository: "owner/repo", sha: "abc", prNumber: 1, runUrl: "https://example.test/run", createdAt: new Date().toISOString() }, status: "passed", counts: { passed: 1, failed: 0, skipped: 0 }, coverage: ["functional"], failures: [], notes: [] };
describe("privileged report boundary", () => {
  it("accepts the versioned result contract", () => expect(qaResultSchema.safeParse(valid).success).toBe(true));
  it("rejects unknown fields and malformed fingerprints", () => expect(qaResultSchema.safeParse({ ...valid, unexpected: true, failures: [{ fingerprint: "bad" }] }).success).toBe(false));
});
