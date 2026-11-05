// Whether the Question Bank Pane and the Exam Outline are open is remembered
// per Exam, beside its bank tabs and pane width — and a record written before
// either could close reads as a new Exam does.

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, test } from 'bun:test'
import { createQuestionBankWorkspaceService } from './question-bank-workspaces'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

test('a new Exam starts with the bank open and the outline closed', async () => {
  const banks = createQuestionBankWorkspaceService()
  expect((await banks.workspace({ examId: 'exam-1' })).pane).toEqual({
    bankPercent: 33, bankOpen: true, outlineOpen: false,
  })
})

test('each Exam remembers its own panes, and moving the divider keeps them', async () => {
  const banks = createQuestionBankWorkspaceService()
  await banks.updatePanes({ examId: 'exam-1' }, { bankOpen: false })
  await banks.updatePanes({ examId: 'exam-1' }, { outlineOpen: true })
  await banks.updatePane({ examId: 'exam-1' }, 45)

  const reopened = createQuestionBankWorkspaceService()
  expect((await reopened.workspace({ examId: 'exam-1' })).pane).toEqual({
    bankPercent: 45, bankOpen: false, outlineOpen: true,
  })
  expect((await reopened.workspace({ examId: 'exam-2' })).pane.bankOpen).toBe(true)
})

test('a workspace saved before the panes could close reads with the bank open', async () => {
  const banks = createQuestionBankWorkspaceService()
  await banks.saveWorkspace({ examId: 'exam-1' }, {
    openBankIds: [], activeBankId: null, filters: {},
    pane: { bankPercent: 40 } as never,
  })
  expect((await banks.workspace({ examId: 'exam-1' })).pane).toEqual({
    bankPercent: 40, bankOpen: true, outlineOpen: false,
  })
})
