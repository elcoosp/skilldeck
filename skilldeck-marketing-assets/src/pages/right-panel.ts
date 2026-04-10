import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class RightPanel extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openTab(tabName: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics' | 'artifacts' | 'files'): Promise<void> {
    const tab = this.rightPanel.locator(`button[aria-label="${tabName}"]`);
    await tab.click();
  }
}
