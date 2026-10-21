import { describe, expect, it } from 'vitest';
import { normalizeAppData } from '../../data/normalize.ts';
import { folderAncestors, folderOptions, indexTree } from './tree.ts';

const data = normalizeAppData({
  schemaVersion: 2,
  folders: [
    { id: 'm', name: 'Математика', parentId: 's' },
    { id: 's', name: 'Учёба', parentId: null },
    { id: 'a', name: 'Архив', parentId: null },
    { id: 'm10', name: 'Глава 10', parentId: 'm' },
    { id: 'm2', name: 'Глава 2', parentId: 'm' },
  ],
  notes: [
    { id: 'n2', title: 'бета', folderId: null },
    { id: 'n1', title: 'Альфа', folderId: null },
  ],
});

describe('folder tree', () => {
  it('sorts folders and notes by name, numbers in natural order', () => {
    const index = indexTree(data);
    expect(index.folders.get(null)?.map((f) => f.name)).toEqual(['Архив', 'Учёба']);
    expect(index.folders.get('m')?.map((f) => f.name)).toEqual(['Глава 2', 'Глава 10']);
    expect(index.notes.get(null)?.map((n) => n.title)).toEqual(['Альфа', 'бета']);
  });

  it('lists folders with full paths in tree order', () => {
    expect(folderOptions(data).map((o) => [o.label, o.depth])).toEqual([
      ['Архив', 0],
      ['Учёба', 0],
      ['Учёба / Математика', 1],
      ['Учёба / Математика / Глава 2', 2],
      ['Учёба / Математика / Глава 10', 2],
    ]);
  });

  it('finds the folders to expand to show a folder', () => {
    expect(folderAncestors(data, 'm10')).toEqual(['s', 'm', 'm10']);
    expect(folderAncestors(data, null)).toEqual([]);
  });
});
