import { expect, test } from '@playwright/test'

test('Home creates a blank Exam that composes only from an open Question Bank', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible()
  await expect(page.getByText('Nothing here yet')).toBeVisible()
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New Exam' }).click()
  await expect(page).toHaveURL(/\/editor$/)

  await expect(page.getByRole('textbox', { name: 'Exam name' })).toHaveValue('Untitled Exam')
  await expect(page.getByRole('main')).toContainText('Drag or add a Question from an open Question Bank')
  await expect(page.getByRole('button', { name: 'Insert your first question' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open Question Bank' }).first()).toBeVisible()
})
