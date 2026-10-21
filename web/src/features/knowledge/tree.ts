// Read-only helpers for the folder tree of the knowledge space.

import type { AppData, Folder, Note } from '../../data/model.ts';

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

export interface TreeIndex {
  /** Child folders by parent id (null — the root), sorted by name. */
  folders: Map<string | null, Folder[]>;
  /** Notes by folder id (null — the root), sorted by title. */
  notes: Map<string | null, Note[]>;
}

function push<T>(map: Map<string | null, T[]>, key: string | null, item: T) {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

export function indexTree(d: AppData): TreeIndex {
  const folders = new Map<string | null, Folder[]>();
  const notes = new Map<string | null, Note[]>();
  for (const f of d.folders) push(folders, f.parentId, f);
  for (const n of d.notes) push(notes, n.folderId, n);
  for (const list of folders.values()) list.sort((a, b) => collator.compare(a.name, b.name));
  for (const list of notes.values()) list.sort((a, b) => collator.compare(a.title, b.title));
  return { folders, notes };
}

export interface FolderOption {
  id: string;
  /** Full path, for example "Учёба / Математика". */
  label: string;
  depth: number;
}

/** All folders in tree order, for a "move to folder" list. */
export function folderOptions(d: AppData): FolderOption[] {
  const { folders } = indexTree(d);
  const out: FolderOption[] = [];
  const walk = (parentId: string | null, path: string[]) => {
    for (const f of folders.get(parentId) ?? []) {
      const next = [...path, f.name];
      out.push({ id: f.id, label: next.join(' / '), depth: path.length });
      walk(f.id, next);
    }
  };
  walk(null, []);
  return out;
}

/** Folder ids from the root down to `folderId`, inclusive. */
export function folderAncestors(d: AppData, folderId: string | null): string[] {
  const byId = new Map(d.folders.map((f) => [f.id, f]));
  const chain: string[] = [];
  for (let id = folderId; id !== null && chain.length <= d.folders.length;) {
    chain.unshift(id);
    id = byId.get(id)?.parentId ?? null;
  }
  return chain;
}
