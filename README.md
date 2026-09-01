# Reusable pull request QA platform

This repository owns deterministic Playwright, API, and axe accessibility checks, preview discovery, evidence aggregation, a versioned result schema, optional OpenAI advisory analysis, and idempotent GitHub reporting.

GitHub connectivity is configured through `GITHUB_TOKEN` (or the `GITHUB_API_KEY` alias) and `GITHUB_REPOSITORY=owner/repository` locally. In GitHub Actions, use `TARGET_GITHUB_REPOSITORY` because the runner reserves `GITHUB_REPOSITORY` for the QA repository. `npm run qa:list-open-prs` verifies access and persists a machine-readable list containing only open pull requests. The scheduled/manual `Test all open pull requests` workflow uses `TARGET_GITHUB_TOKEN` and `TARGET_GITHUB_REPOSITORY` to test those PRs in parallel.

Publish this folder as `qa-platform`. Consumer repositories send a `test-open-pr` repository-dispatch event. The QA repository owns execution and reporting, so untrusted pull-request code never receives target tokens or report permissions.

## Commands

- `npm run typecheck` — static TypeScript validation.
- `npm test` — platform unit tests.
- `npm run test:e2e` — all deterministic suites.
- `npm run test:api`, `test:functional`, `test:a11y` — independent required gates. `test:ui` remains an alias for the functional suite.
- `npm run verify:mcp` — initialize the local Playwright MCP server, check required tools, launch Chrome, navigate to a loopback page, and verify a structured snapshot.
- `npm run qa:aggregate -- <input-file-or-directory> <output>` — produce the validated report contract.
- `npm run qa:list-open-prs` — verify GitHub configuration and save the open-PR catalog.
- `npm run qa:ai -- <summary> <output>` — optional advisory Structured Outputs call.
- `npm run qa:report -- <summary> <advisory>` — update the managed PR comment and defects.

The functional gate verifies business behavior rather than appearance: authentication and logout/session invalidation, protected-route redirects, persistent task CRUD, filters, validation recovery, service-error recovery, and cross-user authorization boundaries. Typo and visual review are supplementary and do not replace these deterministic checks.

## Bug-aware priority execution

For every open PR, `qa:prioritize` reads its title, description, and changed-file names through the GitHub API. Bug/fix/defect/regression language activates a first-pass run for the affected allow-listed area (`auth`, `tasks`, `api`, `accessibility`, or `all`). Tests carry `@positive`, `@negative`, and `@edge` tags, so the affected area's complete risk set runs before the full regression matrix. The PR content never becomes a shell command, and the full suite still runs after the priority pass.

The decision is saved as `pr-test-priority.json`; priority Playwright evidence is stored separately so it does not duplicate aggregate result counts.

## Playwright MCP

`@playwright/mcp` is installed as a development dependency, so Codex MCP startup does not depend on live npm-registry access. The local Codex server entry is named `playwright`, uses Chrome, recognizes `data-testid`, writes generated artifacts under the ignored `qa-results/mcp` directory, and uses 10-second action and 60-second navigation timeouts. After changing MCP configuration, restart Codex and use `/mcp` to confirm the server is connected.

The AI stage requires both `OPENAI_API_KEY` and `OPENAI_MODEL`; otherwise it writes a deterministic “disabled” advisory and succeeds.

Set `QA_OUTPUT_DIR=qa-results/pr-<number>/<suite>` to isolate reports. Each execution writes a machine-readable `test-catalog.json` alongside Playwright JSON, JUnit, HTML, screenshots, videos, and traces.
