import { test as base, chromium, Page } from '@playwright/test';

// Declare the custom fixture type
type AppFixtures = {
  appPage: Page;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ }, use) => {
    const cdpEndpoint = process.env.CDP_ENDPOINT || 'http://localhost:9222';
    let page: Page;
    try {
      const browser = await chromium.connectOverCDP(cdpEndpoint);
      const context = browser.contexts()[0];
      page = context.pages()[0] || await context.newPage();
      await page.bringToFront();
      await use(page);
    } catch (error) {
      console.error(
        `Failed to connect to app via CDP at ${cdpEndpoint}. ` +
        `Ensure the Tauri app is running with --remote-debugging-port=9222.`
      );
      throw error;
    }
  },
});

export { expect } from '@playwright/test';
