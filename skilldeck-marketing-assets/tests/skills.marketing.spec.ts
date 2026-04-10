import { test } from '../src/fixtures';
import { RightPanel } from '../src/pages/right-panel';

test('Skills Marketplace', async ({ appPage }) => {
  const rightPanel = new RightPanel(appPage);
  await rightPanel.openTab('skills');

  // Wait for skills to load (look for unified skill cards)
  await appPage.waitForSelector('[class*="UnifiedSkillCard"]', { timeout: 10000 });

  // Hover over first skill to trigger trust badge
  const firstSkill = appPage.locator('[class*="UnifiedSkillCard"]').first();
  await firstSkill.hover();

  // Click to open detail panel
  await firstSkill.click();
  await appPage.waitForSelector('text=Description', { timeout: 5000 });
});
