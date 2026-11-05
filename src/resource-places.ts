// Where Resources and Folders sit, their Stars and their Trash state
// (ADR-0051), as pure rules over registry records. The services that store
// them and the pages that show them share these, so "is this in Trash?" has
// exactly one answer.

/** Where a Resource or Folder sits, and whether it is Starred or in Trash.
 *  `parentId` is a Folder's id, or null (or absent, in records written before
 *  Folders) for the top level. Only the thing deleted carries `trashedAt`:
 *  whatever it holds is in Trash because it is. */
export type Place = {
  parentId?: string | null
  starred?: boolean
  trashedAt?: string
}

export type FolderRecord = Place & {
  id: string
  name: string
  createdAt: string
  lastModifiedAt: string
  lastOpenedAt?: string
}

export const UNTITLED_FOLDER = 'Untitled folder'

/** How long something waits in Trash before it is deleted for good. */
export const TRASH_DAYS = 30
const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000

export function folderMap(folders: readonly FolderRecord[]): Map<string, FolderRecord> {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

/** The Folders from the top level down to the one `parentId` names. A missing
 *  Folder ends the path, and a cycle (which a move never makes) cannot loop. */
export function folderPath(parentId: string | null | undefined, folders: ReadonlyMap<string, FolderRecord>): FolderRecord[] {
  const path: FolderRecord[] = []
  const seen = new Set<string>()
  let id = parentId ?? null
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = folders.get(id)
    if (!folder) break
    path.unshift(folder)
    id = folder.parentId ?? null
  }
  return path
}

/** In Trash itself, or inside a Folder that is. */
export function inTrash(place: Place, folders: ReadonlyMap<string, FolderRecord>): boolean {
  return Boolean(place.trashedAt) || folderPath(place.parentId, folders).some((folder) => folder.trashedAt)
}

/** Whether `folderId` is `ancestorId` or sits anywhere inside it. */
export function isWithin(folderId: string | null | undefined, ancestorId: string, folders: ReadonlyMap<string, FolderRecord>): boolean {
  if (!folderId) return false
  if (folderId === ancestorId) return true
  return folderPath(folderId, folders).some((folder) => folder.id === ancestorId)
}

/** Where Restore puts something back: the Folder it came from, or the top
 *  level when that Folder is gone, deleted for good or itself in Trash. */
export function restoredParent(place: Place, folders: ReadonlyMap<string, FolderRecord>): string | null {
  const parentId = place.parentId ?? null
  if (!parentId) return null
  const parent = folders.get(parentId)
  if (!parent || inTrash(parent, folders)) return null
  return parentId
}

/** When something put in Trash at `trashedAt` is deleted for good. */
export function trashExpiry(trashedAt: string): Date {
  return new Date(new Date(trashedAt).getTime() + TRASH_MS)
}

/** The things in Trash 30 days or more by `now`. */
export function expiredTrash<T extends Place>(items: readonly T[], now: Date): T[] {
  return items.filter((item) => item.trashedAt && trashExpiry(item.trashedAt).getTime() <= now.getTime())
}

/** Whole days until something in Trash is deleted for good, never below 0. */
export function daysLeftInTrash(trashedAt: string, now: Date): number {
  return Math.max(0, Math.ceil((trashExpiry(trashedAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}
