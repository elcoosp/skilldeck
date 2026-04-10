import { test } from '../src/fixtures';
import { RightPanel } from '../src/pages/right-panel';

test('MCP Server Management', async ({ appPage }) => {
  const rightPanel = new RightPanel(appPage);
  await rightPanel.openTab('mcp');

  // Click "Browse catalog" button
  const browseCatalog = appPage.locator('button:has-text("Browse catalog")');
  await browseCatalog.click();

  // Wait for catalog to load
  await appPage.waitForSelector('text=Popular MCP Servers', { timeout: 10000 });

  // Hover over a server card
  const firstCard = appPage.locator('[class*="CatalogCard"]').first();
  await firstCard.hover();

  // Go back
  await appPage.locator('button[aria-label="Back"]').click();
});
