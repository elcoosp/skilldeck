import { test, expect } from '../src/fixtures';
import { BasePage } from '../src/pages/base-page';

test('Empty State - Landing', async ({ appPage }) => {
  const base = new BasePage(appPage);
  await base.waitForAppReady();

  // Verify the empty state illustration is visible
  await expect(appPage.locator('img[alt*="No conversations"]')).toBeVisible();
});
