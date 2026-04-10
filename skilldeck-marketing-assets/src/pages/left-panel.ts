import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class LeftPanel extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get newChatButton(): Locator {
    return this.leftPanel.locator('button:has-text("New Chat")');
  }

  async clickNewChat(): Promise<void> {
    await this.newChatButton.click();
    await this.page.waitForSelector('[data-conversation-id]');
  }

  async openWorkspaceIfNeeded(): Promise<void> {
    const openWorkspaceBtn = this.leftPanel.locator('button:has-text("Open workspace")');
    if (await openWorkspaceBtn.isVisible()) {
      await openWorkspaceBtn.click();
      const testWorkspace = process.env.TEST_WORKSPACE_PATH;
      if (!testWorkspace) throw new Error('TEST_WORKSPACE_PATH not set');
      await this.page.locator('input[type="file"]').setInputFiles(testWorkspace);
      await this.page.waitForSelector('text=Workspace opened');
    }
  }
}
