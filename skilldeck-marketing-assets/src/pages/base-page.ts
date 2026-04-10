import { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) { }

  async waitForAppReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });
  }

  get leftPanel(): Locator {
    return this.page.locator('[data-panel]:first-child');
  }

  get centerPanel(): Locator {
    return this.page.locator('[data-panel]:nth-child(2)');
  }

  get rightPanel(): Locator {
    return this.page.locator('[data-panel]:nth-child(3)');
  }
}
