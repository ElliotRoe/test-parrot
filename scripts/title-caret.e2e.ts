// Typing into the middle of a title on the sheet, in a real browser.
//
// The sheet is drawn from a layout plan that catches up with an edit a moment
// after it is typed. A field that read its value from that plan was handed its
// old text after each keystroke and then its new text once the plan caught up,
// which threw the caret to the end: the next letter landed at the end of the
// title instead of next to the last one. Each keystroke here waits for the
// plan to catch up before the next, which is what a teacher pausing between
// letters does.

import { expect, test, type Locator, type Page } from '@playwright/test'
import { seedAuthoringState } from './seed-authoring'

const choice = (id: string, correct: boolean) => ({
  type: 'multipleChoiceChoice',
  attrs: { correct, id },
  content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }],
})

const QUESTION = {
  id: 'q1',
  type: 'multiple-choice',
  columns: 1,
  doc: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Which particle is neutral?' }] },
      { type: 'multipleChoice', content: [choice('q1-a', false), choice('q1-b', true)] },
    ],
  },
}

async function openExam(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => true })
  })
  await seedAuthoringState(page, {
    questionBank: { questions: [QUESTION] },
    workingCopy: { title: 'Unit Test', questionIds: ['q1'] },
    dirty: false,
  })
  await expect(page.locator('.exam-question[data-question-id]')).toHaveCount(1)
}

// Longer than the sheet's repagination debounce, so the plan catches up
// between letters.
const PAUSE_MS = 400

/** Puts the caret straight after `before`, types `typed` a letter at a time,
 *  and checks the letters arrived together where the caret was. */
async function typeMidField(field: Locator, before: string, typed: string) {
  const original = await field.inputValue()
  expect(original.startsWith(before)).toBe(true)
  await field.click()
  await field.evaluate((element, at) => {
    ;(element as HTMLTextAreaElement).setSelectionRange(at, at)
  }, before.length)
  await field.pressSequentially(typed, { delay: PAUSE_MS })
  await field.page().waitForTimeout(PAUSE_MS)

  const expected = before + typed + original.slice(before.length)
  await expect(field).toHaveValue(expected)
  expect(await field.evaluate((element) => (element as HTMLTextAreaElement).selectionStart))
    .toBe(before.length + typed.length)
}

test('typing mid-title keeps the caret after each letter', async ({ page }) => {
  await openExam(page)
  const title = page.getByRole('textbox', { name: 'Title printed on the exam' })
  await expect(title).toHaveValue('Unit Test')
  await typeMidField(title, 'Unit', 'ed')
})

test('typing mid-heading keeps the caret after each letter', async ({ page }) => {
  await openExam(page)
  const heading = page.getByRole('textbox', { name: 'Section heading' }).first()
  await expect(heading).toHaveValue('Multiple Choice')
  await typeMidField(heading, 'Multiple', 'xy')
})

test('typing mid-directions keeps the caret after each letter', async ({ page }) => {
  await openExam(page)
  const directions = page.getByRole('textbox', { name: 'Section directions' }).first()
  await expect(directions).toHaveValue(/^Identify the choice/)
  await typeMidField(directions, 'Identify', 'xy')
})
