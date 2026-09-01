import { AxeBuilder } from "@axe-core/playwright";
import { test, expect, hasAuthEnvironment, signIn } from "./fixtures.js";

for (const route of ["/", "/login", "/signup", "/forgot-password"]) {
  test(`${route} has no automatically detectable accessibility violations`, { tag: ["@accessibility", "@positive", "@edge"] }, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("authenticated task board has no automatically detectable accessibility violations", { tag: ["@accessibility", "@positive", "@edge"] }, async ({ page }) => {
  test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
  await signIn(page);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
