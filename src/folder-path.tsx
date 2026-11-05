// Where an open Exam or Question Bank sits (ADR-0051): its Folder path, each
// step a way back to that Folder, and a Move control beside it.

import { useEffect, useState } from 'react'
import { ChevronRight, FolderInput } from 'lucide-react'
import type { EntryRef, LibraryService } from './library'
import { MoveDialog } from './library-dialogs'
import { folderPath, type FolderRecord } from './resource-places'
import { navigate } from './use-route'

const href = (folderId: string | null) => (folderId ? `/folders/${encodeURIComponent(folderId)}` : '/')

export function FolderPath({ library, resource, name, documentLoad = false }: {
  library: LibraryService
  resource: EntryRef
  /** What the Move dialog calls the thing moving. */
  name: string
  /** The editor is left by loading a document, so its leave-page guard
   *  stands between the teacher and an unsaved Working Copy; other pages
   *  move without one. */
  documentLoad?: boolean
}) {
  const [place, setPlace] = useState<{ parentId: string | null; folders: Map<string, FolderRecord> } | null>(null)
  const [moving, setMoving] = useState(false)
  const load = async () => {
    const [parentId, folders] = await Promise.all([library.placeOf(resource), library.folders()])
    setPlace({ parentId, folders })
  }
  useEffect(() => {
    let current = true
    void Promise.all([library.placeOf(resource), library.folders()]).then(([parentId, folders]) => {
      if (current) setPlace({ parentId, folders })
    })
    return () => { current = false }
  }, [library, resource.kind, resource.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!place) return null
  const steps = [{ id: null as string | null, name: 'Home' }, ...folderPath(place.parentId, place.folders)]
  const go = (folderId: string | null) => {
    if (documentLoad) window.location.assign(href(folderId))
    else navigate(href(folderId))
  }
  return (
    <nav className="folder-path" aria-label="Location">
      <ol>
        {steps.map((step, index) => (
          <li key={step.id ?? 'home'}>
            {index > 0 && <ChevronRight aria-hidden="true" />}
            <a
              href={href(step.id)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                event.preventDefault()
                go(step.id)
              }}
            >
              {step.name}
            </a>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="folder-path-move"
        aria-label="Move"
        title="Move to another folder"
        aria-haspopup="dialog"
        onClick={() => setMoving(true)}
      >
        <FolderInput aria-hidden="true" />
      </button>
      {moving && (
        <MoveDialog
          title={`Move “${name}”`}
          moving={[resource]}
          from={[place.parentId]}
          startAt={place.parentId}
          folders={place.folders}
          onCancel={() => setMoving(false)}
          onMove={async (folderId) => {
            await library.move([resource], folderId)
            await load()
            setMoving(false)
          }}
        />
      )}
    </nav>
  )
}
