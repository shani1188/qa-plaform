import { test, expect, hasAuthEnvironment, signIn } from "./fixtures.js";
import { qaEnv } from "../src/env.js";

test.describe("task management", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await signIn(page);
  });

  test("creates, filters, completes, and deletes a task", { tag: ["@tasks", "@positive"] }, async ({ page }) => {
    const title = `Automated task ${Date.now()}`;
    await page.getByTestId("task-title").fill(title);
    await page.getByTestId("task-description").fill("Created by the deterministic browser suite");
    await page.getByTestId("task-priority").selectOption("high");
    await page.getByTestId("task-create").click();
    const card = page.getByRole("article").filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Created by the deterministic browser suite");
    await expect(card).toContainText("high priority");
    await page.reload();
    await expect(card).toBeVisible();
    await card.getByRole("combobox", { name: `Status for ${title}` }).selectOption("done");
    await page.reload();
    await expect(card).toContainText("done");
    await page.getByTestId("task-filter").selectOption("done");
    await expect(card).toContainText("done");
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(card).toHaveCount(0);
  });

  test("enforces task title boundaries in the browser", { tag: ["@tasks", "@negative", "@edge"] }, async ({ page }) => {
    const title = page.getByTestId("task-title");
    await title.fill("");
    await page.getByTestId("task-create").click();
    await expect(title).toHaveJSProperty("validity.valueMissing", true);
    await expect(title).toHaveAttribute("maxlength", "120");
  });

  test("keeps a task when deletion is cancelled", { tag: ["@tasks", "@edge"] }, async ({ page }) => {
    const title = `Cancelled deletion ${Date.now()}`;
    const created = await page.request.post("/api/tasks", { data: { title } });
    expect(created.status()).toBe(201);
    const task = (await created.json()).data;
    await page.reload();
    const card = page.getByRole("article").filter({ hasText: title });
    page.once("dialog", (dialog) => dialog.dismiss());
    await card.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(card).toBeVisible();
    await page.request.delete(`/api/tasks/${task.id}`);
  });

  test("recovers after a task creation service failure", { tag: ["@tasks", "@negative", "@edge"] }, async ({ page }) => {
    let intercepted = false;
    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() === "POST" && !intercepted) {
        intercepted = true;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Task service is temporarily unavailable." } }) });
        return;
      }
      await route.continue();
    });
    const title = `Recovery task ${Date.now()}`;
    await page.getByTestId("task-title").fill(title);
    await page.getByTestId("task-create").click();
    await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
    await expect(page.getByTestId("task-title")).toHaveValue(title);
    await page.getByTestId("task-create").click();
    const card = page.getByRole("article").filter({ hasText: title });
    await expect(card).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: `Delete ${title}` }).click();
  });

  test("isolates task data between users", { tag: ["@tasks", "@negative", "@edge"] }, async ({ page, browser }) => {
    const secondEmail = qaEnv().secondEmail;
    test.skip(!secondEmail, "A second isolated QA user is unavailable.");
    const title = `Private task ${Date.now()}`;
    const created = await page.request.post("/api/tasks", { data: { title } });
    expect(created.status()).toBe(201);
    const task = (await created.json()).data;

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await signIn(secondPage, secondEmail);
    await expect(secondPage.getByRole("article").filter({ hasText: title })).toHaveCount(0);
    const update = await secondPage.request.patch(`/api/tasks/${task.id}`, { data: { status: "done" } });
    expect(update.status()).toBe(404);
    const removal = await secondPage.request.delete(`/api/tasks/${task.id}`);
    expect(removal.status()).toBe(404);
    await secondContext.close();

    expect((await page.request.delete(`/api/tasks/${task.id}`)).status()).toBe(204);
  });
});
