import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const outputRoot = process.env.QA_OUTPUT_DIR ?? "qa-results";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Trusted CI tests share two run-scoped Supabase users. Serial execution
  // prevents concurrent sign-ins from invalidating another test's session.
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  outputDir: path.join(outputRoot, "test-results"),
  reporter: [
    ["list"],
    ["./src/catalog-reporter.ts"],
    ["html", { outputFolder: path.join(outputRoot, "playwright-report"), open: "never" }],
    ["junit", { outputFile: path.join(outputRoot, "junit.xml") }],
    ["json", { outputFile: path.join(outputRoot, "playwright.json") }]
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000
  },
  projects: [
    { name: "api", testMatch: /api\.spec\.ts/ },
    {
      name: "functional",
      testMatch: [/auth\.spec\.ts/, /tasks\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] }
    },
    { name: "accessibility", testMatch: /a11y\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }
  ]
});
