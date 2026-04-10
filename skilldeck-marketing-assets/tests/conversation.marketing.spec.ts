import { test } from '../src/fixtures';
import { LeftPanel } from '../src/pages/left-panel';
import { CenterPanel } from '../src/pages/center-panel';
import { TEST_MESSAGES } from '../src/test-data';

test('Active Conversation Workflow', async ({ appPage }) => {
  const leftPanel = new LeftPanel(appPage);
  const centerPanel = new CenterPanel(appPage);

  await leftPanel.openWorkspaceIfNeeded();
  await leftPanel.clickNewChat();

  await centerPanel.messageInput.type(TEST_MESSAGES.coding);
  await centerPanel.messageInput.send();

  await centerPanel.messageThread.waitForMessageWithText(/import requests|def fetch_weather/);
  await centerPanel.messageThread.waitForStreamingToFinish();

  await centerPanel.messageThread.scrollToTop();
});
