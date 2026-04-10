import { test } from '../src/fixtures';

test('Global Search & Command Palette', async ({ appPage }) => {
  // Wait for app ready
  await appPage.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });

  // Open command palette with Cmd+K
  await appPage.keyboard.press('Meta+K');

  // Wait for palette
  const palette = appPage.locator('[cmdk-root]');
  await palette.waitFor({ state: 'visible' });

  // Type "new"
  await appPage.keyboard.type('new');

  // Press Escape to close
  await appPage.keyboard.press('Escape');

  // Open global search with Cmd+Shift+F
  await appPage.keyboard.press('Meta+Shift+F');

  // Wait for search modal
  const searchModal = appPage.locator('[role="dialog"]');
  await searchModal.waitFor({ state: 'visible' });

  // Type search term
  await searchModal.locator('input').fill('weather');

  // Wait for results
  await appPage.waitForTimeout(500);

  // Close with Escape
  await appPage.keyboard.press('Escape');
});
