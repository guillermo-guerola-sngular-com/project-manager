import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // All specs share one real backend/database (there's no per-test isolation
  // at the server level), so tests that mutate the board must not run
  // concurrently — otherwise one test's writes race another's reads.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Login is server-backed (JWT via FastAPI), so e2e runs against the real
    // Docker image rather than a frontend-only `next dev` server.
    command:
      "docker build -t pm-app .. && docker run --rm --name pm-app-e2e -p 3000:8000 --env-file ../.env pm-app",
    url: "http://127.0.0.1:3000/api/ping",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
