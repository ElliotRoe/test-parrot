// Folders, Stars and Trash (ADR-0051): existing storage migrates to the top
// level, Trash keeps things for 30 days and then deletes them for good, and
// Restore puts things back where they came from.

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createQuestion } from './exam'
import { createExamWorkspaceService } from './exam-workspaces'
import { createLibraryService, refOf } from './library'
import { createQuestionBankWorkspaceService } from './question-bank-workspaces'
import { daysLeftInTrash, expiredTrash, folderMap, inTrash, restoredParent, type FolderRecord } from './resource-places'
import {
  CANONICAL_QUESTION_STORE,
  EXAM_STORE,
  FOLDER_STORE,
  QUESTION_BANK_REGISTRY_STORE,
  STORAGE_NAME,
  STORAGE_VERSION,
} from './storage-schema'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const DAY = 24 * 60 * 60 * 1000

function services(clock: { now: Date }) {
  const now = () => clock.now
  const workspaces = createExamWorkspaceService({ now })
  const bankWorkspaces = createQuestionBankWorkspaceService({ now })
  const library = createLibraryService({ workspaces, bankWorkspaces, now })
  return { workspaces, bankWorkspaces, library }
}

/** The registry as a version 8 build left it, before Folders. */
async function seedVersion8() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STORAGE_NAME, 8)
    request.onupgradeneeded = () => {
      for (const [name, keyPath] of [
        [EXAM_STORE, 'id'], ['exam-workspace', 'key'], [QUESTION_BANK_REGISTRY_STORE, 'id'],
        [CANONICAL_QUESTION_STORE, 'id'], ['question-bank-workspace', 'key'],
        ['editor-workspace', 'key'], ['media-assets', 'hash'],
      ] as const) request.result.createObjectStore(name, { keyPath })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const transaction = database.transaction([EXAM_STORE, QUESTION_BANK_REGISTRY_STORE, CANONICAL_QUESTION_STORE], 'readwrite')
  transaction.objectStore(EXAM_STORE).put({ id: 'old-exam', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-02-01T00:00:00.000Z' })
  transaction.objectStore(QUESTION_BANK_REGISTRY_STORE).put({
    id: 'old-bank', name: 'Cells', createdAt: '2026-01-01T00:00:00.000Z', lastUpdatedAt: '2026-01-05T00:00:00.000Z', questionIds: ['q1'],
  })
  transaction.objectStore(CANONICAL_QUESTION_STORE).put({ ...createQuestion('open'), id: 'q1', bankId: 'old-bank', topics: ['Mitosis'] })
  await new Promise((resolve) => { transaction.oncomplete = resolve })
  database.close()
}

async function readAll(store: string): Promise<Record<string, unknown>[]> {
  const database = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open(STORAGE_NAME)
    request.onsuccess = () => resolve(request.result)
  })
  try {
    return await new Promise((resolve) => {
      const request = database.transaction(store, 'readonly').objectStore(store).getAll()
      request.onsuccess = () => resolve(request.result as Record<string, unknown>[])
    })
  } finally {
    database.close()
  }
}

describe('migrating storage from before Folders', () => {
  test('keeps every Exam and Question Bank, at the top level', async () => {
    await seedVersion8()
    const { library } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    const { entries } = await library.snapshot()

    expect(entries.map((entry) => [entry.kind, entry.id, entry.parentId, entry.starred, entry.trashedAt]).sort())
      .toEqual([['bank', 'old-bank', null, false, undefined], ['exam', 'old-exam', null, false, undefined]])
    const bank = entries.find((entry) => entry.kind === 'bank')
    expect(bank?.kind === 'bank' && bank.bank.topics).toEqual(['Mitosis'])
    expect(bank?.kind === 'bank' && bank.bank.questionCount).toBe(1)
  })

  test('records the top level and a last modified time on the stored records themselves', async () => {
    await seedVersion8()
    const { library } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    await library.snapshot()

    const [exam] = await readAll(EXAM_STORE)
    expect(exam).toMatchObject({ id: 'old-exam', parentId: null, lastModifiedAt: '2026-02-01T00:00:00.000Z' })
    const [bank] = await readAll(QUESTION_BANK_REGISTRY_STORE)
    expect(bank).toMatchObject({ id: 'old-bank', name: 'Cells', parentId: null, questionIds: ['q1'] })
    expect(await readAll(FOLDER_STORE)).toEqual([])
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(STORAGE_NAME)
      request.onsuccess = () => resolve(request.result)
    })
    expect(database.version).toBe(STORAGE_VERSION)
    database.close()
  })
})

describe('Folders', () => {
  test('nest, and a Folder cannot be moved inside itself', async () => {
    const { library } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    const outer = await library.createFolder('Biology', null)
    const inner = await library.createFolder('Unit 1', outer.id)
    await library.move([{ kind: 'folder', id: outer.id }], inner.id)

    const { folders } = await library.snapshot()
    expect(folders.get(outer.id)?.parentId).toBeNull()
    expect(folders.get(inner.id)?.parentId).toBe(outer.id)
  })

  test('a move marks an Exam modified and puts it in the Folder', async () => {
    const clock = { now: new Date('2026-03-01T00:00:00.000Z') }
    const { library, workspaces } = services(clock)
    const folder = await library.createFolder('Biology', null)
    const exam = await workspaces.create()
    clock.now = new Date('2026-03-02T00:00:00.000Z')
    await library.move([{ kind: 'exam', id: exam.id }], folder.id)

    const entry = (await library.snapshot()).entries.find((candidate) => candidate.id === exam.id)
    expect(entry?.parentId).toBe(folder.id)
    expect(entry?.lastModifiedAt).toBe('2026-03-02T00:00:00.000Z')
  })
})

describe('Trash', () => {
  test('a Folder in Trash takes what it holds with it, and an Exam in it cannot be opened', async () => {
    const { library, workspaces } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    const folder = await library.createFolder('Biology', null)
    const exam = await workspaces.create(undefined, folder.id)
    await library.trash([{ kind: 'folder', id: folder.id }])

    const { entries, folders } = await library.snapshot()
    const examEntry = entries.find((entry) => entry.id === exam.id)!
    expect(examEntry.trashedAt).toBeUndefined()
    expect(inTrash(examEntry, folders)).toBe(true)
    expect(await workspaces.open(exam.id)).toBe(false)

    await library.restore([{ kind: 'folder', id: folder.id }])
    expect(await workspaces.open(exam.id)).toBe(true)
  })

  test('Restore goes back to the original Folder, or the top level when that is gone', async () => {
    const { library, bankWorkspaces } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    const folder = await library.createFolder('Biology', null)
    const kept = await bankWorkspaces.create(folder.id)
    const orphan = await bankWorkspaces.create(folder.id)
    await library.trash([{ kind: 'bank', id: kept.id }, { kind: 'bank', id: orphan.id }])
    await library.restore([{ kind: 'bank', id: kept.id }])
    await library.deleteForever([{ kind: 'folder', id: folder.id }])
    await library.restore([{ kind: 'bank', id: orphan.id }])

    const { entries } = await library.snapshot()
    expect(entries.find((entry) => entry.id === kept.id)).toBeUndefined()
    const restored = entries.find((entry) => entry.id === orphan.id)
    expect(restored?.parentId).toBeNull()
    expect(restored?.trashedAt).toBeUndefined()
  })

  test('things are deleted for good 30 days after going to Trash, and not before', async () => {
    const clock = { now: new Date('2026-03-01T00:00:00.000Z') }
    const { library, workspaces, bankWorkspaces } = services(clock)
    const folder = await library.createFolder('Biology', null)
    const exam = await workspaces.create(undefined, folder.id)
    await workspaces.rename(exam.id, 'Cells quiz')
    const bank = await bankWorkspaces.create()
    await bankWorkspaces.commit(bank.id, { kind: 'rename', name: 'Cells' })
    await library.trash([{ kind: 'folder', id: folder.id }])
    clock.now = new Date(clock.now.getTime() + 5 * DAY)
    await library.trash([{ kind: 'bank', id: bank.id }])

    clock.now = new Date('2026-03-30T23:00:00.000Z')
    expect(await library.expireTrash()).toBe(0)
    expect((await library.snapshot()).entries).toHaveLength(3)

    clock.now = new Date('2026-03-31T00:00:00.000Z')
    expect(await library.expireTrash()).toBe(1)
    const { entries } = await library.snapshot()
    expect(entries.map((entry) => entry.id)).toEqual([bank.id])
    expect(await workspaces.exists(exam.id)).toBe(false)

    clock.now = new Date('2026-04-05T00:00:00.000Z')
    expect(await library.expireTrash()).toBe(1)
    expect((await library.snapshot()).entries).toEqual([])
  })

  test('a Question Bank in Trash leaves its Questions in Exams until it is deleted for good', async () => {
    const { library, workspaces, bankWorkspaces } = services({ now: new Date('2026-03-01T00:00:00.000Z') })
    const bank = await bankWorkspaces.create()
    const question = createQuestion('open')
    await bankWorkspaces.commit(bank.id, { kind: 'create-question', question })
    const exam = await workspaces.create(question)
    await workspaces.rename(exam.id, 'Cells quiz')

    const warning = await library.deletionWarning([refOf({ kind: 'bank', id: bank.id })])
    expect(warning).toMatchObject({ banks: 1, exams: 0, folders: 0, affectedExams: [{ id: exam.id, title: 'Cells quiz' }] })

    await library.trash([{ kind: 'bank', id: bank.id }])
    expect((await workspaces.backendFor(exam.id).read())?.workingCopy.questionIds).toEqual([question.id])

    await library.emptyTrash()
    expect((await workspaces.backendFor(exam.id).read())?.workingCopy.questionIds).toEqual([])
  })
})

describe('Trash rules', () => {
  const folder = (id: string, parentId: string | null, trashedAt?: string): FolderRecord => ({
    id, name: id, parentId, createdAt: '', lastModifiedAt: '', ...(trashedAt ? { trashedAt } : {}),
  })

  test('expiry counts 30 whole days from going to Trash', () => {
    const items = [{ id: 'a', trashedAt: '2026-03-01T00:00:00.000Z' }, { id: 'b' }]
    expect(expiredTrash(items, new Date('2026-03-30T23:59:59.000Z'))).toEqual([])
    expect(expiredTrash(items, new Date('2026-03-31T00:00:00.000Z')).map(({ id }) => id)).toEqual(['a'])
    expect(daysLeftInTrash('2026-03-01T00:00:00.000Z', new Date('2026-03-02T00:00:00.000Z'))).toBe(29)
  })

  test('Restore skips a Folder that is itself in Trash', () => {
    const folders = folderMap([folder('gone', null, '2026-03-01T00:00:00.000Z'), folder('here', null)])
    expect(restoredParent({ parentId: 'gone' }, folders)).toBeNull()
    expect(restoredParent({ parentId: 'here' }, folders)).toBe('here')
    expect(restoredParent({ parentId: 'missing' }, folders)).toBeNull()
  })
})
