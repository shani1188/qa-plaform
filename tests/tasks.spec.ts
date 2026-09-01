import { test, expect, hasAuthEnvironment, signIn } from "./fixtures.js";
import { qaEnv } from "../src/env.js";

test.describe("task management", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await signIn(page);
  });

  test("creates, comments, moves, filters, changes views, and deletes a task", { tag: ["@tasks", "@positive"] }, async ({ page }) => {
    const title = `Automated task ${Date.now()}`;
    await page.getByTestId("task-title").fill(title);
    await page.getByTestId("task-description").fill("Created by the deterministic browser suite");
    await page.getByTestId("task-priority").selectOption("high");
    await page.getByTestId("task-create").click();
    const card = page.getByRole("article").filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Created by the deterministic browser suite");
    await expect(card).toContainText("high priority");
    await card.getByText(/^Comments \(/).click();
    await card.getByTestId(/comment-input-/).fill("Ready for product review");
    await card.getByTestId(/comment-submit-/).click();
    await expect(card).toContainText("Ready for product review");
    await card.dragTo(page.getByTestId("status-column-pending"));
    await expect(card.getByRole("combobox", { name: `Status for ${title}` })).toHaveValue("pending");
    await page.getByTestId("view-list").click();
    await expect(page.getByTestId("task-list")).toBeVisible();
    await card.getByRole("combobox", { name: `Status for ${title}` }).selectOption("completed");
    await page.reload();
    await page.getByTestId("view-list").click();
    await expect(card).toContainText("Completed");
    await page.getByTestId("task-filter").selectOption("completed");
    await expect(card).toContainText("Completed");
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
    await expect(page.getByTestId("task-status").locator("option")).toHaveCount(5);
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
    await expect(page.getByText("Task service is temporarily unavailable.", { exact: true })).toBeVisible();
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
    const update = await secondPage.request.patch(`/api/tasks/${task.id}`, { data: { status: "completed" } });
    expect(update.status()).toBe(404);
    const comment = await secondPage.request.post(`/api/tasks/${task.id}/comments`, { data: { body: "Should not be allowed" } });
    expect(comment.status()).toBe(404);
    const removal = await secondPage.request.delete(`/api/tasks/${task.id}`);
    expect(removal.status()).toBe(404);
    await secondContext.close();

    expect((await page.request.delete(`/api/tasks/${task.id}`)).status()).toBe(204);
  });
});
