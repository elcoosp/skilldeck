import { Page, Locator } from '@playwright/test';

export class MessageThread {
  constructor(private page: Page) { }

  async waitForMessageWithText(text: string | RegExp): Promise<Locator> {
    const msg = this.page.locator('[data-msg-id]').filter({ hasText: text }).first();
    await msg.waitFor({ state: 'visible' });
    return msg;
  }

  async waitForStreamingToFinish(): Promise<void> {
    await this.page.waitForFunction(() => {
      return !document.querySelector('[data-testid="streaming-indicator"]');
    }, { timeout: 30000 });
  }

  async scrollToTop(): Promise<void> {
    await this.page.locator('#message-thread-scroll-container').evaluate(el => el.scrollTop = 0);
  }
}
