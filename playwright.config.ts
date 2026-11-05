import { defineConfig } from '@playwright/test'

// Several worktrees share this machine; a run can ask for its own port.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4174)
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './scripts',
  testMatch: '*.e2e.ts',
  // This VM has only 2 cores. Running several Chromium instances in parallel
  // alongside the Vite dev server exhausts memory and crashes pages
  // ("Page crashed"), which surfaced as intermittent e2e failures that wasted
  // whole coordinator repair cycles. Serialize to one worker for stability and
  // retry transient failures so a single flake no longer fails the run.
  workers: 1,
  retries: 2,
  use: {
    baseURL: origin,
    // A fresh browser is a first visit, and a first visit to `/` is the
    // front door rather than Home. The suites start from Home, so every
    // context arrives already welcomed.
    storageState: {
      cookies: [],
      origins: [{
        origin,
        localStorage: [{ name: 'test-parrot:welcomed', value: 'true' }],
      }],
    },
  },
  webServer: {
    command: `bunx vite --host 127.0.0.1 --port ${port}`,
    url: origin,
    reuseExistingServer: true,
  },
})
