import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../data/normalize.ts';
import {
  addChecklistItem,
  addNote,
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
