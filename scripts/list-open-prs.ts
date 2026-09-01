import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRepository, githubConfig, listOpenPullRequests } from "../src/github.js";

const repository = await getRepository();
if (repository.archived) throw new Error("The configured repository is archived.");
const pulls = await listOpenPullRequests();
const outputDir = process.env.QA_OUTPUT_DIR ?? "qa-results";
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "open-pull-requests.json"), JSON.stringify({ repository: githubConfig().repository, generatedAt: new Date().toISOString(), pulls }, null, 2));
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(pulls.map(({ number }) => ({ number })))}\ncount=${pulls.length}\n`);
}
console.log(`GitHub access verified for ${repository.full_name}; found ${pulls.length} open pull request(s).`);

