// The Drive Connection and Sync with Drive as the app uses them (ADR-0052):
// one controller per page, shared through context by the Sync button, the
// `/open` page and the New menu.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DriveSyncContext, LIBRARY_CHANGED_EVENT, libraryChanged, type DriveBusy, type DriveSync } from './drive-sync-context'
import type { ExamWorkspaceService } from '../exam-workspaces'
import type { LibraryService } from '../library'
import type { QuestionBankWorkspaceService } from '../question-bank-workspaces'
import { createBrowserLibrary } from './browser-library'
import type { DriveClient, DriveFile } from './drive-client'
import { createGoogleDrive } from './google-drive'
import { disconnectGoogle, driveConfigured, DriveAuthError, preloadGoogle, requestDriveToken } from './google-auth'
import { findDriveBackup, needsSync, syncWithDrive, type LocalRef, type LocalSide, type SyncReport } from './sync-engine'
import { afterRestore, browserSyncStateStore, disconnectedState, fileKey, onSyncStateChanged, type SyncState, type SyncStateStore } from './sync-state'

export type DriveSyncServices = {
  library: LibraryService
  workspaces: ExamWorkspaceService
  bankWorkspaces: QuestionBankWorkspaceService
}

function errorText(error: unknown): string {
  if (error instanceof DriveAuthError) return error.message
  return error instanceof Error && error.message ? `Sync with Drive stopped: ${error.message}` : 'Sync with Drive stopped. Try again.'
}

export function DriveSyncProvider({
  services,
  children,
  store = browserSyncStateStore,
  makeDrive,
  makeLocal,
}: {
  services: DriveSyncServices
  children: ReactNode
  store?: SyncStateStore
  makeDrive?: (token: () => Promise<string>) => DriveClient
  makeLocal?: (services: DriveSyncServices) => LocalSide
}) {
  const configured = driveConfigured()
  const [state, setState] = useState<SyncState>(() => store.read())
  const [busy, setBusy] = useState<DriveBusy>(null)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [error, setError] = useState('')
  const [dot, setDot] = useState(false)
  const [backupOffer, setBackupOffer] = useState<DriveFile | null>(null)
  const local = useMemo(() => (makeLocal ?? createBrowserLibrary)(services), [makeLocal, services])
  const stateRef = useRef(state)
  stateRef.current = state
  const drive = useMemo(() => (makeDrive ?? createGoogleDrive)(
    () => requestDriveToken(stateRef.current.account ? { loginHint: stateRef.current.account.email } : {}),
  ), [makeDrive])

  useEffect(() => {
    if (!configured) return
    preloadGoogle()
    return onSyncStateChanged(() => setState(store.read()))
  }, [configured, store])

  // The dot: worked out again whenever what it depends on may have moved.
  useEffect(() => {
    if (!configured || !state.account) {
      setDot(false)
      return
    }
    let current = true
    const check = () => {
      void local.snapshot().then(({ resources }) => {
        if (current) setDot(needsSync(store.read(), resources, new Date()))
      }).catch(() => undefined)
    }
    check()
    const timer = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    window.addEventListener(LIBRARY_CHANGED_EVENT, check)
    return () => {
      current = false
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener(LIBRARY_CHANGED_EVENT, check)
    }
  }, [configured, local, state, store])

  const save = useCallback((next: SyncState) => {
    store.write(next)
    setState(next)
  }, [store])

  const runSync = useCallback(async () => {
    setBusy('syncing')
    setError('')
    try {
      const result = await syncWithDrive({ drive, local, store })
      setReport(result)
      setState(store.read())
      if (result.downloaded.length > 0 || result.trashed.length > 0) libraryChanged()
    } catch (caught) {
      setError(errorText(caught))
      setState(store.read())
    } finally {
      setBusy(null)
    }
  }, [drive, local, store])

  const connect = useCallback(async () => {
    setBusy('connecting')
    setError('')
    try {
      await requestDriveToken({ consent: true })
      const account = await drive.account()
      const next = { ...store.read(), account }
      save(next)
      const backup = next.lastSyncAt ? null : await findDriveBackup(drive)
      if (backup) {
        setBackupOffer(backup)
        setBusy(null)
        return
      }
    } catch (caught) {
      setError(errorText(caught))
      setBusy(null)
      return
    }
    await runSync()
  }, [drive, runSync, save, store])

  const restoreFromDrive = useCallback(async () => {
    setBusy('restoring')
    setError('')
    try {
      const backup = backupOffer ?? await findDriveBackup(drive)
      if (!backup) throw new Error('There is no Account Backup in your Test Parrot folder yet. Sync from your other browser first.')
      const bytes = await drive.download(backup.id)
      const { readAccountBackup, stageRestore } = await import('../account-backup')
      await readAccountBackup(new Blob([bytes as BlobPart]))
      await stageRestore({ bytes: bytes.slice().buffer })
      save(afterRestore(store.read()))
      window.location.reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be restored. Nothing in this browser was changed.')
      setBusy(null)
    }
  }, [backupOffer, drive, save, store])

  const openDriveFile = useCallback(async (fileId: string): Promise<LocalRef | null> => {
    setBusy('opening')
    setError('')
    try {
      let current = store.read()
      if (!current.account) {
        await requestDriveToken({ consent: true })
        current = { ...current, account: await drive.account() }
        save(current)
      }
      const known = Object.entries(current.files).find(([, entry]) => entry.fileId === fileId)
      const file = await drive.get(fileId)
      if (known && (!file || !file.trashed)) {
        const [key] = known
        const [kind, ...id] = key.split(':')
        return { kind: kind as LocalRef['kind'], id: id.join(':') }
      }
      if (!file || file.trashed) return null
      const kind = file.appProperties.tpKind
      if (kind !== 'bank' && kind !== 'exam') throw new Error('That file is not a Test Parrot Drive Copy.')
      const applied = await local.apply({
        kind,
        parentId: null,
        bytes: await drive.download(fileId),
        isDriveCopy: (bankId) => Boolean(store.read().files[fileKey('bank', bankId)]),
      })
      const next = store.read()
      next.files[fileKey(kind, applied.id)] = {
        kind,
        fileId,
        localModifiedAt: applied.modifiedAt,
        md5: file.md5Checksum ?? '',
        ownedByMe: file.ownedByMe,
        ...(applied.memo ? { memo: applied.memo } : {}),
      }
      next.ignored = (next.ignored ?? []).filter((id) => id !== fileId)
      save(next)
      libraryChanged()
      return { kind, id: applied.id }
    } catch (caught) {
      setError(errorText(caught))
      throw caught
    } finally {
      setBusy(null)
    }
  }, [drive, local, save, store])

  const value = useMemo<DriveSync>(() => ({
    configured,
    state,
    connected: Boolean(state.account),
    dot,
    busy,
    report,
    error,
    backupOffer,
    connect,
    sync: async () => {
      setBackupOffer(null)
      if (!stateRef.current.account) await connect()
      else await runSync()
    },
    disconnect: () => {
      disconnectGoogle()
      setReport(null)
      setBackupOffer(null)
      save(disconnectedState())
    },
    restoreFromDrive,
    dismissBackupOffer: () => setBackupOffer(null),
    openDriveFile,
    clearReport: () => setReport(null),
  }), [backupOffer, busy, configured, connect, dot, error, openDriveFile, report, restoreFromDrive, runSync, save, state])

  return <DriveSyncContext.Provider value={value}>{children}</DriveSyncContext.Provider>
}
