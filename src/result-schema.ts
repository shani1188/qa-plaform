import { z } from "zod";

export const failureSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  suite: z.enum(["functional", "api", "accessibility", "infrastructure"]),
  title: z.string().min(1).max(240),
  route: z.string().max(200),
  severity: z.enum(["critical", "high", "medium", "low"]),
  expected: z.string().max(1000),
  actual: z.string().max(2000),
  reproduction: z.array(z.string().max(300)).max(8),
  evidence: z.array(z.string().max(300)).max(12)
}).strict();

export const qaResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  run: z.object({ repository: z.string().max(200), sha: z.string().max(64), prNumber: z.number().int().positive(), runUrl: z.string().url().or(z.literal("")), createdAt: z.string().datetime() }),
  status: z.enum(["passed", "failed", "partial"]),
  counts: z.object({ passed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() }),
  coverage: z.array(z.enum(["functional", "api", "accessibility"])),
  failures: z.array(failureSchema).max(100),
  notes: z.array(z.string().max(500)).max(20)
}).strict();

export type QaResult = z.infer<typeof qaResultSchema>;
