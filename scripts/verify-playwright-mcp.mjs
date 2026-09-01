import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules", "@playwright", "mcp", "cli.js");
const output = path.join(root, "qa-results", "mcp-smoke");
const http = createServer((_, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<!doctype html><html><head><title>MCP verification</title></head><body><main><h1>Playwright MCP verification</h1><button data-testid=\"verified\">Verified</button></main></body></html>");
});
await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
const address = http.address();
if (!address || typeof address === "string") throw new Error("Could not start the local verification page.");

const child = spawn(process.execPath, [cli, "--browser", "chrome", "--headless", "--isolated", "--output-dir", output, "--test-id-attribute", "data-testid"], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"]
});
let nextId = 1;
let stderr = "";
const pending = new Map();
child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4000); });
createInterface({ input: child.stdout }).on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  }
});

function send(message) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out waiting for ${method}. ${stderr}`)); }, 60_000);
    pending.set(id, { resolve, reject, timer });
    send({ id, method, params });
  });
}

try {
  const initialized = await request("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "hermes-mcp-verifier", version: "1.0.0" }
  });
  if (!initialized?.serverInfo?.name) throw new Error("MCP initialization returned no server information.");
  send({ method: "notifications/initialized", params: {} });
  const listed = await request("tools/list", {});
  const names = new Set((listed?.tools ?? []).map(({ name }) => name));
  for (const required of ["browser_navigate", "browser_snapshot", "browser_close"]) {
    if (!names.has(required)) throw new Error(`Required MCP tool ${required} is unavailable.`);
  }
  const navigated = await request("tools/call", { name: "browser_navigate", arguments: { url: `http://127.0.0.1:${address.port}` } });
  if (navigated?.isError) throw new Error("Playwright MCP could not launch Chrome and navigate.");
  const snapshot = await request("tools/call", { name: "browser_snapshot", arguments: {} });
  const content = JSON.stringify(snapshot?.content ?? []);
  if (!content.includes("Playwright MCP verification")) throw new Error("Browser snapshot did not contain the verification page.");
  await request("tools/call", { name: "browser_close", arguments: {} });
  console.log(`Playwright MCP verified: ${initialized.serverInfo.name}; ${names.size} tools; Chrome navigation and snapshot passed.`);
} finally {
  child.stdin.end();
  child.kill();
  await new Promise((resolve) => http.close(resolve));
}
