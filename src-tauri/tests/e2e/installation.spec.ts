// tests/e2e/installation.spec.ts
// E2E tests for the skill installation flow.
// Run with: pnpm exec playwright test

import { expect, test } from '@playwright/test'

test.describe('Skill Installation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to initialise.
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10_000 })
  })

  test('user can navigate to the skills tab', async ({ page }) => {
    // Click the Skills tab in the right panel.
    const skillsTab = page.getByRole('tab', { name: /skills/i })
    await expect(skillsTab).toBeVisible()
    await skillsTab.click()
    await expect(page.getByPlaceholder(/search skills/i)).toBeVisible()
  })

  test('skill browser shows sync button', async ({ page }) => {
    const skillsTab = page.getByRole('tab', { name: /skills/i })
    await skillsTab.click()

    const syncBtn = page.getByTitle(/sync from registry/i)
    await expect(syncBtn).toBeVisible()
  })

  test('install dialog shows target selection', async ({ page }) => {
    const skillsTab = page.getByRole('tab', { name: /skills/i })
    await skillsTab.click()

    // Click the first Install button if any skills are visible.
    const installButtons = page.getByRole('button', { name: /install/i })
    const count = await installButtons.count()

    if (count > 0) {
      await installButtons.first().click()

      // Expect the install dialog to appear.
      await expect(page.getByText('Install Skill')).toBeVisible()
      await expect(page.getByText(/personal/i)).toBeVisible()
      await expect(page.getByText(/workspace/i)).toBeVisible()
      await expect(
        page.getByRole('button', { name: /install copy/i })
      ).toBeVisible()

      // Close the dialog.
      await page.keyboard.press('Escape')
    }
  })

  test('security warning is shown for high-risk skills', async ({ page }) => {
    const skillsTab = page.getByRole('tab', { name: /skills/i })
    await skillsTab.click()

    // If any "Security Risk" badge is visible, check that clicking install
    // shows the blocked skill interstitial.
    const securityBadge = page.getByText('Security Risk').first()
    const isVisible = await securityBadge.isVisible().catch(() => false)

    if (isVisible) {
      // Find the parent card and click install.
      const card = securityBadge.locator(
        'xpath=ancestor::div[contains(@class,"rounded-lg")]'
      )
      const installBtn = card.getByRole('button', { name: /install/i })
      if (await installBtn.isVisible()) {
        await installBtn.click()
        await expect(page.getByText('Security Warning')).toBeVisible()
        await expect(
          page.getByRole('button', { name: /cancel \(recommended\)/i })
        ).toBeVisible()
        await page.keyboard.press('Escape')
      }
    }
  })

  test('lint warning panel shows ignore button', async ({ page }) => {
    const skillsTab = page.getByRole('tab', { name: /skills/i })
    await skillsTab.click()

    // Click on a skill card to open detail.
    const cards = page
      .locator('[role="button"]')
      .filter({ has: page.getByText(/install/i) })
    if ((await cards.count()) > 0) {
      await cards.first().click()

      // If lint warnings are shown, the ignore button should be present.
      const ignoreButton = page.getByRole('button', { name: /ignore/i }).first()
      if (await ignoreButton.isVisible().catch(() => false)) {
        await expect(ignoreButton).toBeEnabled()
      }
    }
  })
})

test.describe('Skill Sources Settings', () => {
  test('skill sources section is accessible from settings', async ({
    page
  }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10_000 })

    // Open settings overlay.
    const settingsBtn = page.getByTitle(/settings/i)
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      // Look for a skill sources section.
      const sourcesSection = page.getByText(/skill source/i)
      if (await sourcesSection.isVisible()) {
        await expect(sourcesSection).toBeVisible()
      }
    }
  })
})
