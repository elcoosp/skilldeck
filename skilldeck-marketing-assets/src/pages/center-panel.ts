import { Page } from '@playwright/test';
import { BasePage } from './base-page';
import { MessageInput } from './message-input';
import { MessageThread } from './message-thread';

export class CenterPanel extends BasePage {
  readonly messageInput: MessageInput;
  readonly messageThread: MessageThread;

  constructor(page: Page) {
    super(page);
    this.messageInput = new MessageInput(page);
    this.messageThread = new MessageThread(page);
  }
}
