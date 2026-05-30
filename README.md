# Double Klondike

Klondike card game with 2 decks

https://sean5446.github.io/2klondike/

<img src=".github/screenshot.png" alt="screenshot" width="600" />

## Running Locally

**Prerequisites:** Node.js 22+

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal (e.g. `http://localhost:5173`).

## Browser Smoke Tests (Playwright)

The project includes browser-level smoke tests for core UI gameplay flows.

Run once locally:

```bash
npx playwright install chromium
```

Run tests:

```bash
npm run test:e2e
```

Runs the full Playwright suite in headless mode and exits with pass/fail output in the terminal (best for CI and quick verification).

Open Playwright UI mode:

```bash
npm run test:e2e:ui
```

Opens Playwright's interactive UI (`--ui`) so you can run/filter tests manually, inspect steps, view traces, and debug failures visually.

## Reviewing Test Results

After a run, you can review results in a few ways:

1. Terminal summary (fastest)

```bash
npm run test:e2e
```

Playwright prints passed/failed tests and failure stack traces directly in the terminal.

2. HTML report (best overview)

```bash
npx playwright show-report
```

This opens the Playwright HTML report from `playwright-report/` with per-test status, errors, and run details.

3. Interactive debugging UI (best for iteration)

```bash
npm run test:e2e:ui
```

Use this to re-run specific tests, inspect step-by-step actions, and open traces/screenshots for failures.

Tip: failed runs also write artifacts under `test-results/` (error context, traces, screenshots when available).

CI/CD note: the GitHub Actions deploy workflow now runs these Playwright tests before the build/deploy steps.

## Running for LAN
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Versioning

The version displayed in the UI is pulled directly from `package.json`. To increment it, run one of:

```bash
npm version patch   # e.g. 1.0.8 → 1.0.9  (bug fixes)
npm version minor   # e.g. 1.0.8 → 1.1.0  (new features)
npm version major   # e.g. 1.0.8 → 2.0.0  (breaking changes)
```
