import { expect, test, type Page } from '@playwright/test'

// Home works like Google Drive (ADR-0051): Folders hold Exams, Question Banks
// and other Folders; New makes things where you are; things move by dialog or
// by drag; deleting goes to Trash for 30 days.

async function newFromMenu(page: Page, item: 'New folder' | 'New Exam' | 'New Question Bank') {
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function newFolder(page: Page, name: string) {
  await newFromMenu(page, 'New folder')
  const dialog = page.getByRole('dialog', { name: 'New folder' })
  await dialog.getByRole('textbox').fill(name)
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(dialog).toHaveCount(0)
}

/** A Folder, Exam or bank on the page, by its exact name. */
const item = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
/** Its ⋮ menu. */
const moreActions = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: item(page, name) }).getByRole('button', { name: 'More actions' })

/** Setup only: a Question Bank in the named Folder (or at the top level)
 *  holding one Short Answer Question with these Topics, and optionally an
 *  Exam at the top level that uses that Question. */
async function seedBank(page: Page, options: { name: string; folder?: string; topics?: string[]; examName?: string }) {
  await page.evaluate(async ({ name, folder, topics, examName }) => {
    const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts') as typeof import('../src/exam-workspaces')
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
    const { createLibraryService } = await import(/* @vite-ignore */ '/src/library.ts') as typeof import('../src/library')
    const { createQuestion } = await import(/* @vite-ignore */ '/src/exam.ts') as typeof import('../src/exam')
    const workspaces = createExamWorkspaceService()
    const bankWorkspaces = createQuestionBankWorkspaceService()
    const library = createLibraryService({ workspaces, bankWorkspaces })
    const folders = await library.folders()
    const parentId = folder ? [...folders.values()].find((candidate) => candidate.name === folder)!.id : null
    const bank = await bankWorkspaces.create(parentId)
    await bankWorkspaces.commit(bank.id, { kind: 'rename', name })
    const question = { ...createQuestion('open'), topics }
    await bankWorkspaces.commit(bank.id, { kind: 'create-question', question })
    if (examName) {
      const exam = await workspaces.create(question)
      await workspaces.rename(exam.id, examName)
    }
  }, { topics: [], ...options })
}

async function newBankNamed(page: Page, name: string) {
  await newFromMenu(page, 'New Question Bank')
  const field = page.getByRole('textbox', { name: 'Question Bank name' })
  await field.fill(name)
  await field.press('Enter')
  await expect(page.getByRole('heading', { name, exact: true }).or(field)).toBeVisible()
  await expect(field).toHaveValue(name)
}

test('New makes a Folder, then an Exam and a Question Bank inside the Folder on screen', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Biology')
  await item(page, 'Biology').click()
  await expect(page).toHaveURL(/\/folders\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Biology', level: 1 })).toBeVisible()
  await expect(page.getByText('This folder is empty')).toBeVisible()
  const folderUrl = page.url()

  await newFromMenu(page, 'New Exam')
  await expect(page).toHaveURL(/\/editor$/)
  await page.getByRole('textbox', { name: 'Exam name' }).fill('Cells quiz')
  // The editor says where the Exam sits, and each step leads back there.
  const location = page.getByRole('navigation', { name: 'Location' })
  await expect(location).toHaveText(/Home.*Biology/)
  await location.getByRole('link', { name: 'Biology' }).click()
  await expect(page).toHaveURL(folderUrl)
  await expect(item(page, 'Cells quiz')).toBeVisible()

  await newBankNamed(page, 'Mitosis')
  await expect(page.getByRole('navigation', { name: 'Location' })).toHaveText(/Home.*Biology/)
  await page.goto(folderUrl)
  await expect(item(page, 'Mitosis')).toBeVisible()
  await expect(item(page, 'Cells quiz')).toBeVisible()

  // Neither is at the top level.
  await page.goto('/')
  await expect(item(page, 'Biology')).toBeVisible()
  await expect(item(page, 'Cells quiz')).toHaveCount(0)
  await expect(item(page, 'Mitosis')).toHaveCount(0)
})

test('nested Folders have their own addresses, breadcrumbs, and Back and Forward', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Science')
  await item(page, 'Science').click()
  await newFolder(page, 'Unit 1')
  await item(page, 'Unit 1').click()
  await expect(page.getByRole('heading', { name: 'Unit 1', level: 1 })).toBeVisible()
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumbs.getByRole('listitem')).toHaveText(['Home', 'Science', 'Unit 1'])
  const deep = page.url()

  await crumbs.getByRole('link', { name: 'Science' }).click()
  await expect(page.getByRole('heading', { name: 'Science', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Unit 1', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Science', level: 1 })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Unit 1', level: 1 })).toBeVisible()

  // The address alone finds the Folder again.
  await page.goto(deep)
  await expect(crumbs.getByRole('listitem')).toHaveText(['Home', 'Science', 'Unit 1'])
})

test('Move to… puts an Exam in another Folder', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'History')
  await newFromMenu(page, 'New Exam')
  await page.getByRole('textbox', { name: 'Exam name' }).fill('Romans test')
  await page.getByRole('button', { name: 'Test Parrot home' }).click()

  await moreActions(page, 'Romans test').click()
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Move “Romans test”' })
  await dialog.getByRole('button', { name: 'History' }).click()
  await dialog.getByRole('button', { name: 'Move to History' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(item(page, 'Romans test')).toHaveCount(0)
  await item(page, 'History').click()
  await expect(item(page, 'Romans test')).toBeVisible()
})

test('dragging moves things onto a Folder, and onto a breadcrumb back out', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Chemistry')
  await newFolder(page, 'Physics')
  await item(page, 'Physics').dragTo(item(page, 'Chemistry'))
  await expect(item(page, 'Physics')).toHaveCount(0)

  await item(page, 'Chemistry').click()
  await expect(item(page, 'Physics')).toBeVisible()
  await item(page, 'Physics').dragTo(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }))
  await expect(item(page, 'Physics')).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click()
  await expect(item(page, 'Physics')).toBeVisible()
})

test('Shift-click selects several, and they move together', async ({ page }) => {
  await page.goto('/')
  for (const name of ['A box', 'B box', 'C box', 'Target']) await newFolder(page, name)
  await item(page, 'A box').click({ modifiers: ['Control'] })
  await item(page, 'C box').click({ modifiers: ['Shift'] })
  await expect(page.getByRole('toolbar', { name: 'Selection' })).toContainText('3 selected')
  await item(page, 'B box').dragTo(item(page, 'Target'))
  await expect(item(page, 'A box')).toHaveCount(0)
  await expect(item(page, 'B box')).toHaveCount(0)
  await expect(item(page, 'C box')).toHaveCount(0)
  await item(page, 'Target').click()
  await expect(page.getByRole('list', { name: 'Folders' }).getByRole('button', { name: / box$/ })).toHaveCount(3)
})

test('deleting a Folder warns what goes with it, keeps it in Trash, and Restore brings it back', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Old term')
  // An Exam outside the Folder uses a Question from a bank inside it.
  await seedBank(page, { name: 'Ecology', folder: 'Old term', examName: 'Final exam' })
  await page.reload()

  await item(page, 'Old term').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const warning = page.getByRole('dialog', { name: 'Delete “Old term”?' })
  await expect(warning).toContainText('1 Question Bank and 1 Folder')
  await expect(warning.getByRole('listitem')).toHaveText(['Final exam'])
  await warning.getByRole('button', { name: 'Move to Trash' }).click()
  await expect(item(page, 'Old term')).toHaveCount(0)

  // The Exam keeps the Question while the bank is in Trash.
  await item(page, 'Final exam').click()
  await expect(page.locator('.exam-question')).toHaveCount(1)

  await page.goto('/trash')
  await expect(item(page, 'Old term')).toBeVisible()
  await expect(page.getByText('30 days left')).toBeVisible()
  await item(page, 'Old term').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restore' }).click()
  await expect(page.getByText('Trash is empty')).toBeVisible()
  await page.goto('/')
  await item(page, 'Old term').click()
  await expect(item(page, 'Ecology')).toBeVisible()
})

test('an Exam in Trash cannot be opened, and a bookmark to a Folder in Trash offers Restore', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Drafts')
  await item(page, 'Drafts').click()
  const folderUrl = page.url()
  await newFromMenu(page, 'New Exam')
  await page.getByRole('textbox', { name: 'Exam name' }).fill('Pop quiz')
  await page.getByRole('button', { name: 'Test Parrot home' }).click()
  await expect(item(page, 'Drafts')).toBeVisible()
  await item(page, 'Drafts').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Trash' }).click()

  await page.goto(folderUrl)
  await expect(page.getByRole('heading', { name: '“Drafts” is in Trash' })).toBeVisible()
  await page.goto('/trash')
  await item(page, 'Drafts').click()
  await expect(page.getByRole('status')).toContainText('can’t be opened')
  await expect(page).toHaveURL(/\/trash$/)

  await page.goto(folderUrl)
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('heading', { name: 'Drafts', level: 1 })).toBeVisible()
  await expect(item(page, 'Pop quiz')).toBeVisible()
})

test('Delete forever empties Trash for good, and a bookmark to what it held finds nothing', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Scratch')
  await item(page, 'Scratch').click()
  const folderUrl = page.url()
  await page.goto('/')
  await item(page, 'Scratch').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Trash' }).click()
  await page.goto('/trash')
  await page.getByRole('button', { name: 'Empty Trash' }).click()
  await page.getByRole('dialog', { name: 'Empty Trash?' }).getByRole('button', { name: 'Empty Trash' }).click()
  await expect(page.getByText('Trash is empty')).toBeVisible()

  await page.goto(folderUrl)
  await expect(page.getByRole('heading', { name: 'This folder doesn’t exist' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to Home' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('things 30 days in Trash are deleted for good the next time the app opens', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Ancient')
  await newFolder(page, 'Recent bin')
  // Back-date one of them into Trash, 31 days ago, and the other 2 days ago.
  await page.evaluate(async () => {
    const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts') as typeof import('../src/exam-workspaces')
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
    const { createLibraryService } = await import(/* @vite-ignore */ '/src/library.ts') as typeof import('../src/library')
    const day = 24 * 60 * 60 * 1000
    const services = { workspaces: createExamWorkspaceService(), bankWorkspaces: createQuestionBankWorkspaceService() }
    const { entries } = await createLibraryService(services).snapshot()
    const at = (daysAgo: number) => createLibraryService({ ...services, now: () => new Date(Date.now() - daysAgo * day) })
    await at(31).trash([{ kind: 'folder', id: entries.find((entry) => entry.name === 'Ancient')!.id }])
    await at(2).trash([{ kind: 'folder', id: entries.find((entry) => entry.name === 'Recent bin')!.id }])
  })
  await page.reload()
  await page.goto('/trash')
  await expect(item(page, 'Recent bin')).toBeVisible()
  await expect(page.getByText('28 days left')).toBeVisible()
  await expect(item(page, 'Ancient')).toHaveCount(0)
})

test('search finds names and Topics in every Folder, says where each lives, and skips Trash', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Year 9')
  await seedBank(page, { name: 'Forces', folder: 'Year 9', topics: ['Gravity'] })
  await page.goto('/')
  await newFolder(page, 'Gravity old')
  await item(page, 'Gravity old').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Trash' }).click()

  const search = page.getByRole('searchbox', { name: 'Search Test Parrot' })
  await search.fill('gravity')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=gravity$/)
  await expect(item(page, 'Forces')).toBeVisible()
  await expect(item(page, 'Gravity old')).toHaveCount(0)
  await expect(page.getByRole('listitem').filter({ has: item(page, 'Forces') })).toContainText('Year 9')

  await search.fill('forc')
  await expect(page).toHaveURL(/\/search\?q=forc$/)
  await expect(item(page, 'Forces')).toBeVisible()
})

test('grid and list views, remembered by the browser, with a Type filter in the address', async ({ page }) => {
  await page.goto('/')
  await newFolder(page, 'Maths')
  await newBankNamed(page, 'Fractions')
  await page.goto('/')
  await expect(page.getByRole('list', { name: 'Folders' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Exams and Question Banks' })).toBeVisible()

  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.getByRole('list', { name: 'Contents' }).getByRole('listitem')).toHaveCount(2)
  // Folders always come first.
  await expect(page.getByRole('list', { name: 'Contents' }).getByRole('listitem').first()).toContainText('Maths')
  await page.reload()
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('list', { name: 'Contents' })).toBeVisible()

  await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Question Banks' }).click()
  await expect(page).toHaveURL(/\?type=question-banks$/)
  await expect(page.getByRole('list', { name: 'Contents' }).getByRole('listitem')).toHaveText([/Fractions/])
  await page.reload()
  await expect(page.getByRole('list', { name: 'Contents' }).getByRole('listitem')).toHaveText([/Fractions/])

  await page.getByRole('button', { name: 'Grid view' }).click()
  await expect(page.getByRole('list', { name: 'Folders' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Exams and Question Banks' }).getByRole('listitem')).toHaveCount(1)
})

test('below 900px the nav is a drawer and New is a floating button', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Trash' }).click()
  await expect(page).toHaveURL(/\/trash$/)
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden()

  await page.goto('/')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New folder' }).click()
  await page.getByRole('dialog', { name: 'New folder' }).getByRole('textbox').fill('Phone folder')
  await page.getByRole('button', { name: 'Create' }).click()
  // List is the narrow default.
  await expect(page.getByRole('list', { name: 'Contents' }).getByRole('listitem')).toHaveText([/Phone folder/])
})
