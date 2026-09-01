export type BugFocus = "auth" | "tasks" | "api" | "accessibility" | "all";

export type PriorityDecision = {
  isBug: boolean;
  focus: BugFocus;
  signals: string[];
};

const bugPattern = /\b(bug|defect|regression|broken|failure|fails?|fix(?:e[ds])?|issue)\b|bug\s*(title|details?|description)\s*:/i;
const areas: Array<{ focus: Exclude<BugFocus, "all">; pattern: RegExp }> = [
  { focus: "auth", pattern: /auth|login|logout|sign[ -]?up|password|session|protected[ -]?route|callback/i },
  { focus: "tasks", pattern: /task|crud|create|update|delete|filter|status|priority|task-board|\/tasks/i },
  { focus: "api", pattern: /\bapi\b|endpoint|request|response|http|contract|\/api\//i },
  { focus: "accessibility", pattern: /accessibility|a11y|wcag|keyboard|screen[ -]?reader|aria|contrast/i }
];

export function prioritizeBugTests(title: string, body: string, changedFiles: string[]): PriorityDecision {
  const description = `${title}\n${body}`;
  const isBug = bugPattern.test(description);
  if (!isBug) return { isBug: false, focus: "all", signals: [] };

  const searchable = `${description}\n${changedFiles.join("\n")}`;
  const matches = areas.filter(({ pattern }) => pattern.test(searchable)).map(({ focus }) => focus);
  return {
    isBug: true,
    focus: matches.length === 1 ? matches[0] : "all",
    signals: matches.length ? matches : ["bug-language"]
  };
}
