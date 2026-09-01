import { test, expect, hasAuthEnvironment, signIn } from "./fixtures.js";
import { qaEnv } from "../src/env.js";

test.describe("authentication", () => {
  test("protects the task board", { tag: ["@auth", "@negative", "@edge"] }, async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks$/);
  });

  test("rejects invalid credentials without leaking account details", { tag: ["@auth", "@negative"] }, async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("email").fill("missing@example.test");
    await page.getByTestId("password").fill("not-the-password");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toHaveText("Email or password is incorrect.");
  });

  test("signs in and signs out", { tag: ["@auth", "@positive"] }, async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await signIn(page);
    await expect(page.getByTestId("signed-in-user")).toContainText(qaEnv().email!);
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks$/);
  });

  test("preserves the requested protected route after successful login", { tag: ["@auth", "@positive", "@edge"] }, async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks$/);
    await page.getByTestId("email").fill(qaEnv().email!);
    await page.getByTestId("password").fill(qaEnv().password!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test("forgot-password response does not disclose account existence", { tag: ["@auth", "@negative", "@edge"] }, async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByTestId("email").fill("unknown@example.test");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
  });
});
