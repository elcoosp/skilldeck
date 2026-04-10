import { test } from '../src/fixtures';
import { RightPanel } from '../src/pages/right-panel';

test('Analytics Dashboard', async ({ appPage }) => {
  const rightPanel = new RightPanel(appPage);
  await rightPanel.openTab('analytics');

  // Wait for analytics data to load
  await appPage.waitForSelector('text=Token Usage', { timeout: 10000 });

  // Hover over heatmap
  const heatmapRect = appPage.locator('svg rect[data-date]').first();
  await heatmapRect.hover();

  // Click "View full year" button
  await appPage.locator('button:has-text("View full year")').click();

  // Wait for modal
  const modal = appPage.locator('[role="dialog"]');
  await modal.waitFor({ state: 'visible' });

  // Close modal
  await modal.locator('button:has-text("Close")').click();
});
