// tests/e2e/context-injection.spec.ts
import { expect, test } from '@playwright/test'

test.describe('Context Injection — File picker (#)', () => {
  test('User can attach a file via # trigger and send', async ({ page }) => {
    await page.goto('/chat')

    // 1. Focus the input
    const input = page.locator('textarea[placeholder*="Message"]')
    await input.click()

    // 2. Type trigger character
    await input.pressSequentially('#')

    // 3. File picker portal should appear
    const picker = page.locator('[role="option"]').first()
    await expect(picker).toBeVisible({ timeout: 5000 })

    // 4. Select a non-directory entry (the first plain file)
    const fileOption = page
      .locator('[role="option"]')
      .filter({ hasNotText: '..' })
      .filter({ hasNotText: '.' })
      .first()
    await fileOption.click()

    // 5. Chip should appear in the attached items list
    const chip = page.locator('[data-testid="context-chip"]').first()
    await expect(chip).toBeVisible({ timeout: 3000 })

    // 6. Trigger character should be removed from input
    await expect(input).not.toHaveValue(/#/)

    // 7. Send the message
    const sendBtn = page.locator('button[aria-label="Send"]')
    await sendBtn.click()

    // 8. Chips should be cleared after send
    await expect(chip).not.toBeVisible()
  })
})

test.describe('Context Injection — Skill picker (@)', () => {
  test('User can attach a skill via @ trigger', async ({ page }) => {
    await page.goto('/chat')

    const input = page.locator('textarea[placeholder*="Message"]')
    await input.click()

    await input.pressSequentially('@')

    // Palette should open
    const palette = page.locator('[role="option"]').first()
    await expect(palette).toBeVisible({ timeout: 5000 })

    // Select first skill
    await palette.click()

    // Chip appears
    const chip = page.locator('[data-testid="context-chip"]').first()
    await expect(chip).toBeVisible({ timeout: 3000 })

    // @ removed from input
    await expect(input).not.toHaveValue(/@/)
  })
})

test.describe('Context Injection — toolbar buttons', () => {
  test('Hash toolbar button opens file picker', async ({ page }) => {
    await page.goto('/chat')

    const hashBtn = page.locator('button', { hasText: 'File' }).first()
    await hashBtn.click()

    const picker = page.locator('[role="option"]').first()
    await expect(picker).toBeVisible({ timeout: 5000 })
  })

  test('At toolbar button opens skill palette', async ({ page }) => {
    await page.goto('/chat')

    const atBtn = page.locator('button', { hasText: 'Skill' }).first()
    await atBtn.click()

    const palette = page.locator('input[placeholder*="Search skills"]')
    await expect(palette).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Context Injection — chip removal', () => {
  test('Clicking X on a chip removes it', async ({ page }) => {
    await page.goto('/chat')

    const input = page.locator('textarea[placeholder*="Message"]')
    await input.click()
    await input.pressSequentially('#')

    const fileOption = page
      .locator('[role="option"]')
      .filter({ hasNotText: '..' })
      .filter({ hasNotText: '.' })
      .first()
    await fileOption.click()

    const chip = page.locator('[data-testid="context-chip"]').first()
    await expect(chip).toBeVisible()

    // Click the X button inside the chip
    await chip.locator('button[aria-label^="Remove"]').click()
    await expect(chip).not.toBeVisible()
  })
})
