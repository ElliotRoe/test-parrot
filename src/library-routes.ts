// Where the Library's pages live (ADR-0051), and the small rules its pages
// and the app shell share: which Folder a page is in, what a drag carries, and
// what a search finds.

import type { DragEvent } from 'react'
import type { EntryRef, LibraryEntry } from './library'
import { inTrash, type FolderRecord } from './resource-places'

export type LibraryView =
  | { kind: 'folder'; folderId: string | null }
  | { kind: 'recent' }
  | { kind: 'starred' }
  | { kind: 'trash' }
  | { kind: 'search'; query: string }

export function libraryViewOf(route: string, search: string): LibraryView | null {
  if (route === '/') return { kind: 'folder', folderId: null }
  if (route === '/recent') return { kind: 'recent' }
  if (route === '/starred') return { kind: 'starred' }
  if (route === '/trash') return { kind: 'trash' }
  if (route === '/search') return { kind: 'search', query: new URLSearchParams(search).get('q') ?? '' }
  const folder = /^\/folders\/([^/]+)$/.exec(route)
  if (folder) return { kind: 'folder', folderId: decodeURIComponent(folder[1]!) }
  return null
}

export const folderHref = (folderId: string | null) => (folderId ? `/folders/${encodeURIComponent(folderId)}` : '/')

/** The Folder a page puts new things in: the one it shows, or the top level. */
export function folderOfRoute(route: string): string | null {
  const view = libraryViewOf(route, '')
  return view?.kind === 'folder' ? view.folderId : null
}

export const DRAG_TYPE = 'application/x-test-parrot-library'

/** The things a drag carries, when it carries Library entries at all. */
export function draggedRefs(event: DragEvent): EntryRef[] {
  try {
    const value = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as EntryRef[]
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
export const carriesEntries = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE)

const normalized = (value: string) => value.trim().toLocaleLowerCase()

/** Names, and Topics for Question Banks, across every Folder but Trash. */
export function searchEntries(entries: readonly LibraryEntry[], folders: ReadonlyMap<string, FolderRecord>, query: string) {
  const needle = normalized(query)
  if (!needle) return []
  return entries.filter((entry) => !inTrash(entry, folders) && (
    normalized(entry.name).includes(needle)
    || (entry.kind === 'bank' && entry.bank.topics.some((topic) => normalized(topic).includes(needle)))
  ))
}

