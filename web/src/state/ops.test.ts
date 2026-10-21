import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../data/normalize.ts';
import {
  addChecklistItem,
  addFolder,
  addNote,
  deleteFolder,
  isInsideFolder,
  linkNoteTask,
  notesOfTask,
  unlinkNoteTask,
  moveFolder,
  moveNote,
  renameFolder,
  renameNote,
  setNoteText,
  addLink,
  addTask,
  deleteTask,
  deleteTheme,
  moveTask,
  renameTask,
  saveTheme,
  setDurations,
  updateLink,
} from './ops.ts';

function withTask() {
  const d = createEmptyData();
  addTask(d, 'Task', 't1', 1);
  return d;
}

describe('ops', () => {
  it('adds tasks to q2 / todo and rejects blank titles', () => {
    const d = createEmptyData();
    expect(addTask(d, '  ', 'x', 1)).toBe(false);
    expect(addTask(d, ' A ', 'a', 5)).toBe(true);
    expect(d.tasks).toEqual([
      {
        id: 'a',
        title: 'A',
        quadrant: 'q2',
        status: 'todo',
        createdAt: 5,
        description: '',
        checklist: [],
        links: [],
      },
    ]);
  });

  it('moves only one axis at a time (F-05, F-06)', () => {
    const d = withTask();
    moveTask(d, 't1', { quadrant: 'q1' });
    moveTask(d, 't1', { status: 'done' });
    expect(d.tasks[0]).toMatchObject({ quadrant: 'q1', status: 'done' });
  });

  it('keeps the old title when renaming to blank', () => {
    const d = withTask();
    expect(renameTask(d, 't1', '   ')).toBe(false);
    expect(d.tasks[0]?.title).toBe('Task');
  });

  it('validates links (F-89) and deletes details with the task (F-96)', () => {
    const d = withTask();
    expect(addLink(d, 't1', 'javascript:alert(1)', '', 'l0')).toBe(false);
    expect(addLink(d, 't1', 'example.com', ' Ex ', 'l1')).toBe(true);
    expect(updateLink(d, 't1', 'l1', 'not a url', '')).toBe(false);
    expect(d.tasks[0]?.links).toEqual([{ id: 'l1', url: 'https://example.com/', label: 'Ex' }]);
    addChecklistItem(d, 't1', 'step', 'c1');
    deleteTask(d, 't1');
    expect(d.tasks).toEqual([]);
  });

  it('keeps notes when a linked task is deleted, without the link', () => {
    const d = withTask();
    addTask(d, 'Other', 't2', 2);
    addNote(d, 'Note', '', 'n1', 3, null);
    d.notes[0]!.taskIds = ['t1', 't2'];
    deleteTask(d, 't1');
    expect(d.notes[0]?.taskIds).toEqual(['t2']);
  });

  it('clamps durations (F-34)', () => {
    const d = createEmptyData();
    setDurations(d, { workMinutes: 999, restMinutes: 0 });
    expect(d.settings).toMatchObject({ workMinutes: 180, restMinutes: 1 });
  });

  it('keeps the colors of a deleted active theme as the custom theme', () => {
    const d = createEmptyData();
    saveTheme(d, 'Mine', '#111111', '#22AA33', 'th');
    expect(d.settings.theme).toMatchObject({ mode: 'saved', savedId: 'th' });
    deleteTheme(d, 'th');
    expect(d.settings.themes).toEqual([]);
    expect(d.settings.theme).toMatchObject({
      mode: 'custom',
      customBg: '#111111',
      customAccent: '#22AA33',
    });
  });
});

describe('knowledge space', () => {
  // root ─ a ─ b
  //      └ c
  function tree() {
    const d = createEmptyData();
    addFolder(d, 'A', 'a', 1);
    addFolder(d, 'B', 'b', 2, 'a');
    addFolder(d, 'C', 'c', 3);
    addNote(d, 'In B', '', 'n1', 4, 'b');
    addNote(d, 'In A', '', 'n2', 5, 'a');
    return d;
  }
  const parents = (d: ReturnType<typeof tree>) =>
    Object.fromEntries(d.folders.map((f) => [f.id, f.parentId]));

  it('creates folders and notes only in existing folders, with a name', () => {
    const d = tree();
    expect(addFolder(d, '  ', 'x', 6)).toBe(false);
    expect(addFolder(d, 'X', 'x', 6, 'missing')).toBe(false);
    addNote(d, 'Lost', '', 'n3', 7, 'missing');
    expect(d.notes.find((n) => n.id === 'n3')?.folderId).toBeNull();
    expect(renameFolder(d, 'a', '  Новое  ')).toBe(true);
    expect(d.folders[0]?.name).toBe('Новое');
    expect(renameFolder(d, 'a', ' ')).toBe(false);
  });

  it('never moves a folder into itself or its subfolders', () => {
    const d = tree();
    expect(isInsideFolder(d, 'b', 'a')).toBe(true);
    expect(isInsideFolder(d, 'a', 'b')).toBe(false);
    expect(moveFolder(d, 'a', 'a')).toBe(false);
    expect(moveFolder(d, 'a', 'b')).toBe(false);
    expect(moveFolder(d, 'a', 'missing')).toBe(false);
    expect(moveFolder(d, 'a', 'c')).toBe(true);
    expect(moveFolder(d, 'b', null)).toBe(true);
    expect(parents(d)).toEqual({ a: 'c', b: null, c: null });
  });

  it('keeps the contents of a deleted folder in its parent', () => {
    const d = tree();
    deleteFolder(d, 'a');
    expect(parents(d)).toEqual({ b: null, c: null });
    expect(d.notes.map((n) => [n.id, n.folderId])).toEqual([
      ['n1', 'b'],
      ['n2', null],
    ]);
  });

  it('moves, renames and edits notes', () => {
    const d = tree();
    expect(moveNote(d, 'n1', 'c')).toBe(true);
    expect(moveNote(d, 'n1', 'missing')).toBe(false);
    expect(moveNote(d, 'n2', null)).toBe(true);
    expect(d.notes.map((n) => n.folderId)).toEqual(['c', null]);

    expect(renameNote(d, 'n1', '  ', 10)).toBe(false);
    expect(renameNote(d, 'n1', ' Renamed ', 10)).toBe(true);
    setNoteText(d, 'n1', '# Text', 11);
    expect(d.notes[0]).toMatchObject({ title: 'Renamed', text: '# Text', updatedAt: 11 });
    // The same text does not count as an edit.
    setNoteText(d, 'n1', '# Text', 12);
    expect(d.notes[0]?.updatedAt).toBe(11);
  });
});

describe('links between notes and tasks', () => {
  function data() {
    const d = createEmptyData();
    addTask(d, 'Task 1', 't1', 1);
    addTask(d, 'Task 2', 't2', 2);
    addNote(d, 'Note A', '', 'a', 3);
    addNote(d, 'Note B', '', 'b', 4);
    return d;
  }

  it('links both ways, once, and only existing items', () => {
    const d = data();
    expect(linkNoteTask(d, 'a', 't1')).toBe(true);
    expect(linkNoteTask(d, 'a', 't1')).toBe(true);
    expect(linkNoteTask(d, 'b', 't1')).toBe(true);
    expect(linkNoteTask(d, 'a', 'missing')).toBe(false);
    expect(linkNoteTask(d, 'missing', 't1')).toBe(false);
    expect(d.notes[0]?.taskIds).toEqual(['t1']);
    expect(notesOfTask(d, 't1').map((n) => n.id)).toEqual(['a', 'b']);
    expect(notesOfTask(d, 't2')).toEqual([]);
    // A link is not an edit of the note text.
    expect(d.notes[0]?.updatedAt).toBe(3);
  });

  it('unlinks without touching other links', () => {
    const d = data();
    linkNoteTask(d, 'a', 't1');
    linkNoteTask(d, 'a', 't2');
    unlinkNoteTask(d, 'a', 't1');
    expect(d.notes[0]?.taskIds).toEqual(['t2']);
    expect(notesOfTask(d, 't1')).toEqual([]);
  });
});
