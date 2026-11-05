// The Exam editor's two collapsible panes, in a real browser: the Question
// Bank Pane on the right and the Exam Outline on the left.
//
// What each pane lists is proven at its pure boundary — the outline's order
// and numbering in `src/exam-outline.test.ts`, the drop rules in
// `src/workspace-drag.test.ts`. What is proven here is what only a browser
// has: the toggle and what it remembers, a Question leaving the bank as it
// is added and returning when it is Removed, a drag onto the pane Removing
// it in one undoable step, and the outline bringing a Question into view and
// moving it.

import { expect, test, type Locator, type Page } from '@playwright/test'
import { seedAuthoringState } from './seed-authoring'
import type { Question, QuestionType } from '../src/exam'

function question(id: string, stem: string, type: QuestionType, points?: number): Question {
  const content: Record<string, unknown>[] = [
    { type: 'paragraph', content: [{ type: 'text', text: stem }] },
  ]
  if (type === 'multiple-choice') {
    content.push({ type: 'paragraph' }, {
      type: 'multipleChoice',
      content: ['a', 'b'].map((letter) => ({
        type: 'multipleChoiceChoice',
        attrs: { correct: letter === 'a', id: `${id}-${letter}` },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `Choice ${letter}` }] }],
      })),
    })
  }
  return { id, type, columns: 2, doc: { type: 'doc', content }, ...(points ? { points } : {}) }
}

const QUESTIONS: Question[] = [
  question('mc1', 'Cell membranes', 'multiple-choice', 2),
  question('mc2', 'Enzyme kinetics', 'multiple-choice'),
  question('sa1', 'Explain osmosis', 'open', 5),
  question('spare', 'Spare choice question', 'multiple-choice', 3),
]

const bankPane = (page: Page) => page.getByRole('complementary', { name: 'Question Bank Pane' })
const bank = (page: Page) => page.getByRole('region', { name: 'Question Bank' })
const bankRow = (page: Page, stem: string) =>
  bank(page).getByRole('listitem').filter({ hasText: stem })
const outline = (page: Page) => page.getByRole('navigation', { name: 'Exam Outline' })
// An outline line is named by the number the Question prints with.
const outlineRow = (page: Page, number: number) =>
  outline(page).getByRole('button', { name: new RegExp(`^${number}\\.`) })
const outlineItem = (page: Page, number: number) =>
  outline(page).locator('.exam-outline-item').filter({ has: page.getByRole('button', { name: new RegExp(`^${number}\\.`) }) })
const EXAM_QUESTION = '.exam-workspace .exam-question[data-question-id]'
const rendered = (page: Page, id: string) =>
  page.locator(`.exam-workspace .exam-question[data-question-id="${id}"]`)

async function renderedIds(page: Page): Promise<string[]> {
  return page.locator(EXAM_QUESTION).evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => (node as HTMLElement).dataset.questionId ?? ''))],
  )
}

/** An Exam holding `questionIds`, beside an open Biology bank of QUESTIONS. */
async function openWorkspace(
  page: Page,
  questionIds: string[] = ['mc1', 'mc2', 'sa1'],
  questions: Question[] = QUESTIONS,
) {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
  await page.evaluate(async (seeded: Question[]) => {
    const { createQuestionBankWorkspaceService } = await import(
      /* @vite-ignore */ '/src/question-bank-workspaces.ts'
    ) as typeof import('../src/question-bank-workspaces')
    const service = createQuestionBankWorkspaceService()
    const biology = await service.create()
    await service.commit(biology.id, { kind: 'rename', name: 'Biology' })
    await service.commit(biology.id, { kind: 'create-questions', questions: seeded })
  }, questions)
  await seedAuthoringState(page, {
    questionBank: { questions },
    workingCopy: { title: 'Biology quiz', questionIds },
    dirty: false,
  })
  await expect(page.locator(EXAM_QUESTION)).toHaveCount(questionIds.length)
  if (await page.getByRole('button', { name: 'Show Question Bank' }).isVisible()) return
  await bankPane(page).getByRole('button', { name: 'Open Question Bank' }).first().click()
  await page.getByRole('dialog', { name: 'Open Question Bank' }).getByRole('button', { name: /Biology/ }).click()
  await expect(bank(page)).toBeVisible()
}

/** Presses on `from`, moves to `to` in steps, and releases. */
async function dragBetween(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = (await from.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(20, box.height / 2))
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.move(to.x, to.y)
  await page.mouse.up()
}

async function centreOf(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('the Question Bank Pane', () => {
  test('its one toggle closes and reopens it, and each Exam remembers which', async ({ page }) => {
    await openWorkspace(page)
    // A new Exam starts with the pane open; its X is the top-right control.
    await expect(bank(page)).toBeVisible()
    await bankPane(page).getByRole('button', { name: 'Hide Question Bank' }).click()
    await expect(bank(page)).toBeHidden()
    // Closed, the Exam's bar runs the full width, ending in the bank's button.
    const show = page.getByRole('banner').getByRole('button', { name: 'Show Question Bank' })
    await expect(show).toBeVisible()
    const exportBox = (await page.getByRole('button', { name: 'Export', exact: true }).boundingBox())!
    expect((await show.boundingBox())!.x).toBeGreaterThan(exportBox.x)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Show Question Bank' })).toBeVisible()
    await expect(bank(page)).toBeHidden()

    await page.getByRole('button', { name: 'Show Question Bank' }).click()
    await expect(bank(page)).toBeVisible()
    await page.reload()
    await expect(bank(page)).toBeVisible()
  })

  test('lists only what is not on the Exam: a Question leaves as it is added and returns when Removed', async ({ page }) => {
    await openWorkspace(page)
    // Three of four are on the Exam, so the bank offers the fourth, with its Points.
    await expect(bank(page).getByRole('listitem')).toHaveCount(1)
    await expect(bankRow(page, 'Spare choice question')).toContainText('3 points')
    await expect(bank(page)).toContainText("3 of this bank's questions are in this exam")
    await expect(bank(page).getByText('In exam')).toHaveCount(0)

    await bankRow(page, 'Spare choice question').getByRole('button', { name: /^Add .* to the exam$/ }).click()
    await expect(page.locator(EXAM_QUESTION)).toHaveCount(4)
    await expect(bank(page).getByRole('listitem')).toHaveCount(0)
    // Every Question is on the Exam: the count is the empty state.
    await expect(bank(page)).toContainText("4 of this bank's questions are in this exam")

    // Removed from the page's own menu, it is listed in the bank again.
    await rendered(page, 'mc2').click({ button: 'right' })
    await page.getByRole('menuitem', { name: /^Remove/ }).click()
    await expect(bankRow(page, 'Enzyme kinetics')).toHaveCount(1)
    await expect(bank(page)).toContainText("3 of this bank's questions are in this exam")
  })

  test('dragging Questions from the page onto it Removes them, and Undo brings them back', async ({ page }) => {
    await openWorkspace(page)
    // A multi-selection, carried off together.
    await rendered(page, 'mc1').click()
    await rendered(page, 'sa1').click({ modifiers: ['Shift'] })

    const from = rendered(page, 'mc1')
    const box = (await from.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 10)
    await page.mouse.down()
    const target = await centreOf(bank(page))
    await page.mouse.move(target.x, target.y, { steps: 12 })
    await expect(bankPane(page).getByText('Drop to remove from exam')).toBeVisible()
    await page.mouse.up()

    await expect(page.locator(EXAM_QUESTION)).toHaveCount(0)
    await expect(bank(page).getByRole('listitem')).toHaveCount(4)
    await expect(bankPane(page).getByText('Drop to remove from exam')).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => renderedIds(page)).toEqual(['mc1', 'mc2', 'sa1'])
    await expect(bank(page).getByRole('listitem')).toHaveCount(1)
  })

  test('a closed pane is no drop target', async ({ page }) => {
    await openWorkspace(page)
    await page.getByRole('button', { name: 'Hide Question Bank' }).click()
    await expect(bank(page)).toBeHidden()

    // Released at the window's right edge, where the pane would be.
    const viewport = page.viewportSize()!
    await dragBetween(page, rendered(page, 'mc1'), { x: viewport.width - 20, y: viewport.height / 2 })
    await expect.poll(() => renderedIds(page)).toEqual(['mc1', 'mc2', 'sa1'])
    await expect(bank(page)).toBeHidden()
  })
})

test.describe('the Exam Outline', () => {
  test('starts closed, opens from beside the first page, and is remembered per Exam', async ({ page }) => {
    await openWorkspace(page)
    await expect(outline(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Show Exam Outline' }).click()
    await expect(outline(page)).toBeVisible()
    // Grouped under its Section Headings, one numbered row per Question.
    await expect(outlineRow(page, 1)).toContainText('Multiple choice')
    await expect(outlineRow(page, 1)).toContainText('2 pts')
    await expect(outlineRow(page, 3)).toContainText('Short answer')

    await page.reload()
    await expect(outline(page)).toBeVisible()
    await page.getByRole('button', { name: 'Hide Exam Outline' }).click()
    await expect(outline(page)).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Show Exam Outline' })).toBeVisible()
    await expect(outline(page)).toHaveCount(0)
  })

  test('choosing a row brings its Question into view without selecting it', async ({ page }) => {
    // Enough Questions to run past the first sheet.
    const many = Array.from({ length: 24 }, (_, index) => question(`q${index}`, `Long question ${index + 1}`, 'open'))
    await openWorkspace(page, many.map(({ id }) => id), many)
    await page.getByRole('button', { name: 'Show Exam Outline' }).click()

    const last = rendered(page, 'q23').first()
    await expect(last).not.toBeInViewport()
    await outlineRow(page, 24).click()
    await expect(last).toBeInViewport()
    // The page selection is unchanged.
    await expect(page.locator('.exam-question--selected')).toHaveCount(0)
    // And the row for the Question in view is marked as the page scrolls there.
    await expect(outlineRow(page, 24)).toHaveAttribute('aria-current', 'location')
  })

  test('dragging a row moves its Question, into another Section too, as one undoable step', async ({ page }) => {
    await openWorkspace(page)
    await page.getByRole('button', { name: 'Show Exam Outline' }).click()

    // Below the Short Answer row: out of its own Section and into another.
    // A Question moves only from its grip, which shows on hover.
    const below = (await outlineItem(page, 3).boundingBox())!
    await outlineItem(page, 1).hover()
    const grip = (await outlineItem(page, 1).locator('.exam-outline-grip').boundingBox())!
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(below.x + 40, below.y + below.height - 3, { steps: 12 })
    await page.mouse.up()

    await expect.poll(() => renderedIds(page)).toEqual(['mc2', 'sa1', 'mc1'])
    await expect(outlineRow(page, 3)).toContainText('Multiple choice')

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => renderedIds(page)).toEqual(['mc1', 'mc2', 'sa1'])
  })
})

test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 760, height: 900 } })

  test('each pane is a sheet over the pages, one at a time, closed by a click outside', async ({ page }) => {
    await openWorkspace(page)

    await page.getByRole('button', { name: 'Show Question Bank' }).click()
    await expect(bankPane(page)).toBeVisible()
    await page.getByRole('button', { name: 'Show Exam Outline' }).click({ force: true })
    // Opening the outline closes the bank: one sheet at a time.
    await expect(outline(page)).toBeVisible()
    await expect(bankPane(page)).toBeHidden()

    await page.mouse.click(700, 500)
    await expect(outline(page)).toHaveCount(0)
  })
})
