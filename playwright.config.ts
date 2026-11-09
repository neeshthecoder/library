import { defineConfig, devices } from '@playwright/test'
import { LEADERBOARD_TEST_URL } from './tests/e2e/leaderboard-url'

const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@cross/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@cross/ },
  ],
  webServer: {
    command: `npm run build && rm -rf dist/library && cp -r library dist/library && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Build with a (faked) leaderboard store so the acorns and CSP are exercised.
    env: { VITE_LEADERBOARD_URL: LEADERBOARD_TEST_URL },
  },
})
