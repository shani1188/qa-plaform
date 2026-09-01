import { describe, expect, it } from "vitest";
import { prioritizeBugTests } from "../src/prioritization.js";

describe("bug-aware test prioritization", () => {
  it("does not prioritize an ordinary feature PR", () => {
    expect(prioritizeBugTests("Add team dashboard", "Adds reporting", ["app/dashboard/page.tsx"])).toEqual({ isBug: false, focus: "all", signals: [] });
  });

  it("prioritizes authentication cases from bug details", () => {
    expect(prioritizeBugTests("Correct account behavior", "Bug details: login session expires too soon", ["app/auth/actions.ts"])).toMatchObject({ isBug: true, focus: "auth" });
  });

  it("prioritizes task cases based on changed files", () => {
    expect(prioritizeBugTests("Fix regression", "Unexpected behavior", ["components/task-board.tsx"])).toMatchObject({ isBug: true, focus: "tasks" });
  });

  it("uses all functional coverage when several areas are affected", () => {
    expect(prioritizeBugTests("Fix login API bug", "Authentication endpoint failure", ["app/api/auth/route.ts"])).toMatchObject({ isBug: true, focus: "all" });
  });
});
