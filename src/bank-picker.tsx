// Opening a Question Bank beside an Exam (ADR-0051): search every bank by
// name or Topic, or browse Folders, starting in the Folder the Exam sits in.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Database, ChevronRight, Folder, House, Search, X } from 'lucide-react'
import type { QuestionBankSummary } from './question-bank-workspaces'
import { folderPath, inTrash, type FolderRecord } from './resource-places'

const normalized = (value: string) => value.trim().toLocaleLowerCase()
const byName = (left: { name: string }, right: { name: string }) =>
  left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })

export function BankPicker({ banks, folders, startAt, onChoose, onClose }: {
  banks: readonly QuestionBankSummary[]
  folders: ReadonlyMap<string, FolderRecord>
  /** The Folder the Exam sits in. */
  startAt: string | null
  onChoose: (id: string) => void
  onClose: () => void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLElement>(null)
  const chosen = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const [at, setAt] = useState<string | null>(startAt && folders.has(startAt) ? startAt : null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? [])
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('input')?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      if (controls.length === 0) return
      const first = controls[0]!
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (!chosen.current) requestAnimationFrame(() => { if (previous?.isConnected) previous.focus() })
    }
  }, [])

  // Nothing in Trash is offered.
  const live = useMemo(() => banks.filter((bank) => !inTrash(bank, folders)), [banks, folders])
  const needle = normalized(query)
  const found = needle
    ? live.filter((bank) => normalized(bank.name).includes(needle) || bank.topics.some((topic) => normalized(topic).includes(needle))).sort(byName)
    : null
  const childFolders = [...folders.values()]
    .filter((folder) => (folder.parentId ?? null) === at && !inTrash(folder, folders))
    .sort(byName)
  const here = live.filter((bank) => (bank.parentId ?? null) === at).sort(byName)
  const choose = (id: string) => {
    chosen.current = true
    onChoose(id)
  }
  const bankButton = (bank: QuestionBankSummary, location?: string) => (
    <button key={bank.id} type="button" onClick={() => choose(bank.id)}>
      <Database aria-hidden="true" className="entry-icon entry-icon--bank" />
      <strong>{bank.name}</strong>
      <span>{bank.questionCount} {bank.questionCount === 1 ? 'Question' : 'Questions'}{location ? ` · ${location}` : ''}</span>
    </button>
  )

  return createPortal(<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section ref={dialog} className="resource-picker bank-picker" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="resource-picker-header">
        <h2 id={titleId}>Open Question Bank</h2>
        <button type="button" className="question-bank-action" aria-label="Close Question Bank picker" onClick={onClose}><X /></button>
      </header>
      <label className="library-search bank-picker-search">
        <Search aria-hidden="true" />
        <input type="search" aria-label="Search Question Banks" placeholder="Search names and Topics" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {found ? (
        found.length === 0
          ? <p>No Question Bank’s name or Topic matches that.</p>
          : <div className="resource-picker-list">
              {found.map((bank) => bankButton(bank, folderPath(bank.parentId, folders).at(-1)?.name ?? 'Home'))}
            </div>
      ) : <>
        <nav aria-label="Folder path" className="move-dialog-path">
          <button type="button" onClick={() => setAt(null)} aria-current={at === null ? 'location' : undefined}><House aria-hidden="true" /> Home</button>
          {folderPath(at, folders).map((folder) => (
            <span key={folder.id}>
              <ChevronRight aria-hidden="true" />
              <button type="button" onClick={() => setAt(folder.id)} aria-current={folder.id === at ? 'location' : undefined}>{folder.name}</button>
            </span>
          ))}
        </nav>
        {childFolders.length === 0 && here.length === 0
          ? <p>{live.length === 0 ? 'No Question Banks are available on this device.' : 'No Question Banks in this folder.'}</p>
          : <div className="resource-picker-list">
              {childFolders.map((folder) => (
                <button key={folder.id} type="button" className="bank-picker-folder" onClick={() => setAt(folder.id)}>
                  <Folder aria-hidden="true" className="entry-icon entry-icon--folder" />
                  <strong>{folder.name}</strong>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
              {here.map((bank) => bankButton(bank))}
            </div>}
      </>}
    </section>
  </div>, document.body)
}
