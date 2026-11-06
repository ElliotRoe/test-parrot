import { useState } from 'react'
import { Cloud } from 'lucide-react'
import { AppShell } from '../app-shell'
import type { PersistentStorageStatus } from '../durable-storage'
import { openResource, useDriveSync } from './drive-sync-context'
import { PRIVACY_NOTE } from './sync-button'

/**
 * Where a Drive Copy's "Open in Test Parrot" banner leads (ADR-0052). Opening
 * needs Google, and Google needs a click, so the page asks for one. The
 * owner's file opens straight away; a file this account cannot read yet is
 * handed over through the Google Picker (`pickFile`) first.
 */
export function OpenFromDrivePage({ persistentStorage, pickFile }: {
  persistentStorage: PersistentStorageStatus
  /** Shows the Picker with this file preselected; true once it was picked. */
  pickFile?: (fileId: string) => Promise<boolean>
}) {
  const drive = useDriveSync()
  const fileId = new URLSearchParams(window.location.search).get('drive') ?? ''
  const [problem, setProblem] = useState('')
  const open = async () => {
    if (!drive) return
    setProblem('')
    try {
      let target = await drive.openDriveFile(fileId)
      if (!target && pickFile && await pickFile(fileId)) target = await drive.openDriveFile(fileId)
      if (target) openResource(target)
      else setProblem('This file isn’t shared with the Google account you chose, or it is no longer in Drive. Ask its owner to share it with you, then try again.')
    } catch {
      // The controller already says what went wrong.
    }
  }
  return (
    <AppShell crumbs={[{ label: 'Home', href: '/' }, { label: 'Open from Google Drive' }]} persistentStorage={persistentStorage}>
      <div className="site-prose open-drive">
        <h1>Open from Google Drive</h1>
        {!drive?.configured || !fileId ? (
          <p className="site-lede">This link opens a Test Parrot file kept in Google Drive, but Google Drive isn’t available here.</p>
        ) : (
          <>
            <p className="site-lede">Open this Test Parrot file from Google Drive. It stays in sync with Drive each time you sync.</p>
            <p>{PRIVACY_NOTE}</p>
            <div className="account-actions">
              <button type="button" className="primary-button account-action" disabled={drive.busy !== null} onClick={() => void open()}>
                <Cloud aria-hidden="true" />
                {drive.busy === 'opening' ? 'Opening…' : 'Open in Test Parrot'}
              </button>
            </div>
            {(problem || drive.error) && <p className="account-warning" role="alert">{problem || drive.error}</p>}
          </>
        )}
      </div>
    </AppShell>
  )
}
