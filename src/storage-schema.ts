// The browser database is shared by normalized authoring records and immutable
// Media Assets. Keep its schema names in one small module so the two adapters
// can evolve together without depending on one another's implementation.
// Independent Exams begin a fresh browser-storage generation; the preceding
// single-workspace generation is deliberately not interpreted as an Exam.
export const STORAGE_NAME = 'test-parrot-exams-v1'
export const MEDIA_ASSET_STORE = 'media-assets'
export const EXPORT_RECORD_STORE = 'export-records'
export const STORAGE_VERSION = 9
/** The oldest storage an Account Backup may come from: anything from here up
 *  is migrated by `upgradeRegistry` when the app next opens it. */
export const OLDEST_RESTORABLE_STORAGE_VERSION = 8
export const EXAM_STORE = 'exams'
export const EXAM_WORKSPACE_STORE = 'exam-workspace'
export const QUESTION_BANK_REGISTRY_STORE = 'question-banks'
export const CANONICAL_QUESTION_STORE = 'canonical-questions'
export const QUESTION_BANK_WORKSPACE_STORE = 'question-bank-workspace'
export const EDITOR_WORKSPACE_STORE = 'editor-workspace'
/** Folders (ADR-0051). Where each Resource sits lives on its own registry
 *  record, beside its Star and Trash state. */
export const FOLDER_STORE = 'folders'

/**
 * Brings the registry database to `STORAGE_VERSION`. Every module that opens
 * the registry calls this from `onupgradeneeded`, so whichever opens it first
 * leaves it whole.
 *
 * Version 9 (ADR-0051) adds Folders. Everything already stored lands at the
 * top level, unstarred and out of Trash, and an Exam's last modified time
 * starts as the last time it was opened: the nearest thing to it there is.
 */
export function upgradeRegistry(database: IDBDatabase, transaction: IDBTransaction | null, oldVersion: number) {
  const stores: [string, string][] = [
    [EXAM_STORE, 'id'],
    [EXAM_WORKSPACE_STORE, 'key'],
    [QUESTION_BANK_REGISTRY_STORE, 'id'],
    [CANONICAL_QUESTION_STORE, 'id'],
    [QUESTION_BANK_WORKSPACE_STORE, 'key'],
    [EDITOR_WORKSPACE_STORE, 'key'],
    [MEDIA_ASSET_STORE, 'hash'],
    [FOLDER_STORE, 'id'],
  ]
  for (const [name, keyPath] of stores) {
    if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath })
  }
  if (oldVersion > 0 && oldVersion < 9 && transaction) {
    migrateEachRecord(transaction.objectStore(EXAM_STORE), (exam) => ({
      ...exam,
      parentId: exam.parentId ?? null,
      lastModifiedAt: exam.lastModifiedAt ?? exam.lastOpenedAt ?? exam.createdAt,
    }))
    migrateEachRecord(transaction.objectStore(QUESTION_BANK_REGISTRY_STORE), (bank) => ({
      ...bank,
      parentId: bank.parentId ?? null,
    }))
  }
}

function migrateEachRecord(store: IDBObjectStore, change: (record: Record<string, unknown>) => Record<string, unknown>) {
  const cursor = store.openCursor()
  cursor.onsuccess = () => {
    const current = cursor.result
    if (!current) return
    current.update(change(current.value as Record<string, unknown>))
    current.continue()
  }
}
