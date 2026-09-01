import { test, expect, hasAuthEnvironment, signIn } from "./fixtures.js";

test.describe("API contracts", () => {
  test("health endpoint has a stable contract", { tag: ["@api", "@positive"] }, async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", service: "pulseboard" });
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  test("all task endpoints reject anonymous access", { tag: ["@api", "@auth", "@tasks", "@negative"] }, async ({ request }) => {
    const list = await request.get("/api/tasks");
    expect(list.status()).toBe(401);
    await expect(list.json()).resolves.toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    const id = "00000000-0000-4000-8000-000000000001";
    expect((await request.post("/api/tasks", { data: { title: "Forbidden" } })).status()).toBe(401);
    expect((await request.patch(`/api/tasks/${id}`, { data: { status: "completed" } })).status()).toBe(401);
    expect((await request.post(`/api/tasks/${id}/comments`, { data: { body: "Forbidden" } })).status()).toBe(401);
    expect((await request.delete(`/api/tasks/${id}`)).status()).toBe(401);
  });

  test("authenticated task API validates input and CRUD lifecycle", { tag: ["@api", "@tasks", "@positive"] }, async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await signIn(page);
    const invalid = await page.request.post("/api/tasks", { data: { title: "" } });
    expect(invalid.status()).toBe(422);
    const created = await page.request.post("/api/tasks", { data: { title: `API task ${Date.now()}`, description: "contract test", priority: "low", status: "open" } });
    expect(created.status()).toBe(201);
    const task = (await created.json()).data;
    const list = await page.request.get("/api/tasks?status=open");
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: task.id, title: task.title, status: "open" })]));
    const updated = await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "completed" } });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).data.status).toBe("completed");
    const comment = await page.request.post(`/api/tasks/${task.id}/comments`, { data: { body: "API review completed" } });
    expect(comment.status()).toBe(201);
    const commentId = (await comment.json()).data.id;
    const comments = await page.request.get(`/api/tasks/${task.id}/comments`);
    expect(comments.status()).toBe(200);
    expect((await comments.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: commentId, body: "API review completed" })]));
    expect((await page.request.delete(`/api/tasks/${task.id}/comments/${commentId}`)).status()).toBe(204);
    expect((await page.request.delete(`/api/tasks/${task.id}`)).status()).toBe(204);
    expect((await page.request.patch("/api/tasks/not-a-uuid", { data: { status: "completed" } })).status()).toBe(400);
  });

  test("enforces task boundaries, enums, empty patches, and missing resources", { tag: ["@api", "@tasks", "@negative", "@edge"] }, async ({ page }) => {
    test.skip(!hasAuthEnvironment(), "Trusted QA credentials are unavailable (expected for forked PRs).");
    await signIn(page);
    const validBoundary = await page.request.post("/api/tasks", { data: { title: "x".repeat(120), description: "y".repeat(1000), priority: "high", status: "pending" } });
    expect(validBoundary.status()).toBe(201);
    const boundaryTask = (await validBoundary.json()).data;
    expect((await page.request.post("/api/tasks", { data: { title: "x".repeat(121) } })).status()).toBe(422);
    expect((await page.request.post("/api/tasks", { data: { title: "Valid", description: "y".repeat(1001) } })).status()).toBe(422);
    expect((await page.request.post("/api/tasks", { data: { title: "Valid", priority: "urgent" } })).status()).toBe(422);
    expect((await page.request.post("/api/tasks", { data: { title: "Valid", status: "todo" } })).status()).toBe(422);
    expect((await page.request.post(`/api/tasks/${boundaryTask.id}/comments`, { data: { body: "" } })).status()).toBe(422);
    expect((await page.request.post(`/api/tasks/${boundaryTask.id}/comments`, { data: { body: "x".repeat(2001) } })).status()).toBe(422);
    expect((await page.request.patch(`/api/tasks/${boundaryTask.id}`, { data: {} })).status()).toBe(422);
    const missingId = "00000000-0000-4000-8000-000000000099";
    expect((await page.request.patch(`/api/tasks/${missingId}`, { data: { status: "completed" } })).status()).toBe(404);
    expect((await page.request.post(`/api/tasks/${missingId}/comments`, { data: { body: "Missing" } })).status()).toBe(404);
    expect((await page.request.delete(`/api/tasks/${missingId}`)).status()).toBe(404);
    expect((await page.request.delete(`/api/tasks/${boundaryTask.id}`)).status()).toBe(204);
  });
});
