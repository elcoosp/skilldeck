import { test, expect } from '../src/fixtures';
import { TEST_MESSAGES } from '../src/test-data';

test('Active Conversation Workflow', async ({ tauriPage }) => {
  // Wait for the app to be ready
  await tauriPage.waitForSelector('[data-testid="app-shell"]', { timeout: 30000 });

  // Use the same page object models – they work with TauriPage
  const leftPanel = new LeftPanel(tauriPage);
  const centerPanel = new CenterPanel(tauriPage);

  await leftPanel.openWorkspaceIfNeeded();
  await leftPanel.clickNewChat();

  await centerPanel.messageInput.type(TEST_MESSAGES.coding);
  await centerPanel.messageInput.send();

  await centerPanel.messageThread.waitForMessageWithText(/import requests|def fetch_weather/);
  await centerPanel.messageThread.waitForStreamingToFinish();

  // Native screenshot (CoreGraphics on macOS)
  const screenshot = await tauriPage.screenshot();
  await test.info().attach('conversation', { body: screenshot, contentType: 'image/png' });

  // Video recording (handled automatically by the fixture on failure, but we can do it manually)
  await tauriPage.startRecording({ path: test.info().outputPath('recording'), fps: 15 });
  // … additional interactions …
  const result = await tauriPage.stopRecording();
  console.log('Video saved to:', result.video);
});
