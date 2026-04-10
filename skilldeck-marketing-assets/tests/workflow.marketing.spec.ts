import { test } from '../src/fixtures';
import { RightPanel } from '../src/pages/right-panel';
import { SAMPLE_WORKFLOW_JSON } from '../src/test-data';

test('Workflow Designer', async ({ appPage }) => {
  const rightPanel = new RightPanel(appPage);
  await rightPanel.openTab('workflow');

  // Click "New Workflow" button
  await appPage.locator('button:has-text("New")').click();

  // Wait for dialog
  const dialog = appPage.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });

  // Fill name
  await dialog.locator('input[id="workflow-name"]').fill('Marketing Demo Workflow');

  // Fill definition JSON
  const jsonString = JSON.stringify(SAMPLE_WORKFLOW_JSON, null, 2);
  await dialog.locator('textarea').fill(jsonString);

  // Save
  await dialog.locator('button:has-text("Save")').click();

  // Wait for save confirmation (toast)
  await appPage.waitForSelector('text=Workflow saved', { timeout: 5000 });

  // Click Run button on the newly created workflow (first in list)
  const runButton = appPage.locator('button[title="Run workflow"]').first();
  await runButton.click();

  // Wait for workflow to start (some indication)
  await appPage.waitForSelector('text=Active Workflow', { timeout: 10000 });
});
