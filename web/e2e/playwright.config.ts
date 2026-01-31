import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.TEST_PORT || 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,  // Run tests serially to avoid rate limiting
  forbidOnly: !!process.env.CI,
  retries: 2,  // Always retry to handle rate limiting
  workers: 1,  // Single worker to avoid overwhelming the server
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  timeout: 90000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 45000,
    actionTimeout: 20000,
  },
  projects: [
    {
      name: 'Mobile XS',
      use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Mobile SM',
      use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Mobile MD',
      use: { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Tablet',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'Desktop',
      use: { viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
