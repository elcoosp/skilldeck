import { test } from '../src/fixtures';
import { RightPanel } from '../src/pages/right-panel';

test('Workspace Context - Files', async ({ appPage }) => {
  const rightPanel = new RightPanel(appPage);
  await rightPanel.openTab('files');

  // Wait for file tree to load
  await appPage.waitForSelector('[class*="FileTree"]', { timeout: 10000 });

  // Expand first folder if any
  const folderToggle = appPage.locator('button[class*="FileTreeItem"] svg').first();
  if (await folderToggle.isVisible()) {
    await folderToggle.click();
  }

  // Click on a file to open in editor (may trigger system open)
  const fileItem = appPage.locator('[class*="FileTreeItem"]:has-text(".")').first();
  await fileItem.click();
});
