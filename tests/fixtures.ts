import { test as base, expect, type Page } from "@playwright/test";
import { hasAuthEnvironment, qaEnv } from "../src/env.js";

export async function signIn(page: Page, email = qaEnv().email) {
  const password = qaEnv().password;
  if (!email || !password) throw new Error("QA credentials are unavailable.");
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/tasks$/);
}

export const test = base.extend({});
export { expect, hasAuthEnvironment };
