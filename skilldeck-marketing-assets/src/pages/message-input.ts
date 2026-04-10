import { Page, Locator } from '@playwright/test';

export class MessageInput {
  constructor(private page: Page) { }

  get textarea(): Locator {
    return this.page.locator('textarea[placeholder*="Type a message"]');
  }

  get sendButton(): Locator {
    return this.page.locator('button[aria-label="Send"]');
  }

  async type(text: string): Promise<void> {
    await this.textarea.fill(text);
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }
}
