import { expect, test } from '../fixtures'

const APP_READY_TIMEOUT = 60_000

/**
 * Wait until the app webview has finished loading the UI. Socket mode
 * connects to the plugin before the first paint completes, so gate every
 * interaction on DOM readiness.
 */
async function waitForAppReady(page: Parameters<typeof test>[0]['tauriPage']) {
  await page.setDefaultTimeout(APP_READY_TIMEOUT)
  await page.waitForFunction(
    `document.readyState === 'complete' && !!window.__PW_ACTIVE__`,
    APP_READY_TIMEOUT
  )
}

/**
 * Get into a fresh onboarding state. In socket mode the fixture wipes the
 * webview storage before each launch, so no in-page reset is needed. In CDP
 * mode (Windows) the app is already running, so clear the flag over a real
 * Chromium CDP evaluation and reload — reliable because it is true Playwright
 * navigation, unlike the plugin's socket `reload`.
 */
async function resetToOnboarding(
  page: Parameters<typeof test>[0]['tauriPage']
) {
  if (process.env.E2E_MODE === 'cdp') {
    await waitForAppReady(page)
    await page.evaluate(
      `(function () {
        try {
          localStorage.removeItem('skilldeck-onboarding-complete')
        } catch (e) {}
      })()`
    )
    await page.reload()
    await waitForAppReady(page)
    return
  }
  await waitForAppReady(page)
}

/** Walk through the wizard using only the opt-out actions, asserting each step. */
async function completeOnboarding(
  page: Parameters<typeof test>[0]['tauriPage']
) {
  await expect(page.getByText('Welcome to SkillDeck')).toBeVisible({
    timeout: APP_READY_TIMEOUT
  })

  await page.getByText('Deal me in').click()
  await expect(page.getByText('Connect your first AI provider')).toBeVisible()
  await expect(page.getByText("I'll do this later")).toBeEnabled()
  await page.getByText("I'll do this later").click()

  await expect(page.getByText('Join the SkillDeck community')).toBeVisible()
  await expect(page.getByText('Not now')).toBeEnabled()
  await page.getByText('Not now').click()

  await expect(page.getByText("You're ready to deal!")).toBeVisible()
  await page.getByText('Start a conversation').click()

  await expect(page.getByText('Welcome to SkillDeck')).toBeHidden({
    timeout: APP_READY_TIMEOUT
  })
}

test.describe('app launch & onboarding', () => {
  test('fresh state shows the onboarding wizard', async ({ tauriPage }) => {
    await resetToOnboarding(tauriPage)
    await expect(tauriPage.getByText('Welcome to SkillDeck')).toBeVisible({
      timeout: APP_READY_TIMEOUT
    })
  })

  test('onboarding can be completed and reveals the main app', async ({
    tauriPage
  }) => {
    await resetToOnboarding(tauriPage)
    await completeOnboarding(tauriPage)
    await expect(tauriPage.getByText('New Chat')).toBeVisible()
  })

  test('settings navigation works after onboarding', async ({ tauriPage }) => {
    await resetToOnboarding(tauriPage)
    await completeOnboarding(tauriPage)
    await tauriPage.click('button[aria-label="Settings"]')
    await expect(tauriPage.getByText('API Keys')).toBeVisible()
    await expect(tauriPage.getByPlaceholder('sk-ant-…')).toBeVisible()
  })
})
