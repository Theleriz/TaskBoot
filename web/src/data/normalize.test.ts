import { describe, expect, it } from 'vitest';
import {
  createEmptyData,
  normalizeAppData,
  normalizeSettings,
  normalizeTask,
} from './normalize.ts';
import { CURRENT_SCHEMA_VERSION } from './schema.ts';
import { normalizeUrl } from './url.ts';

describe('normalizeUrl (F-89)', () => {
  it('adds https:// and keeps http(s) links', () => {
    expect(normalizeUrl('docs.python.org/3/')).toBe('https://docs.python.org/3/');
    expect(normalizeUrl(' http://example.com ')).toBe('http://example.com/');
    expect(normalizeUrl('http://localhost:5173')).toBe('http://localhost:5173/');
  });

  it('rejects empty, unsafe and host-less values', () => {
    for (const bad of [
      '',
      '   ',
      'javascript:alert(1)',
      'mailto:a@b.c',
      'not a url',
      'intranet',
      42,
    ]) {
      expect(normalizeUrl(bad)).toBeNull();
    }
  });
});

describe('normalizeTask', () => {
  it('drops tasks without a title (F-08)', () => {
    expect(normalizeTask({ title: '   ' })).toBeNull();
    expect(normalizeTask(null)).toBeNull();
  });

  it('fills missing detail fields for old tasks (N-23, F-98)', () => {
    const task = normalizeTask({
      id: 'a',
      title: ' Old ',
      quadrant: 'q3',
      status: 'done',
      createdAt: 5,
    });
    expect(task).toEqual({
      id: 'a',
      title: 'Old',
      quadrant: 'q3',
      status: 'done',
      createdAt: 5,
      description: '',
      checklist: [],
      links: [],
    });
  });

  it('falls back to q2 / todo for unknown values (F-02)', () => {
    const task = normalizeTask({ title: 'x', quadrant: 'q9', status: 'later' }, 100);
    expect(task).toMatchObject({ quadrant: 'q2', status: 'todo', createdAt: 100 });
  });

  it('cleans checklist items and links', () => {
    const task = normalizeTask({
      title: 'x',
      checklist: [{ id: 'c', text: '  a  ', done: true }, { text: '' }, 'junk'],
      links: [{ url: 'javascript:alert(1)' }, { id: 'l', url: 'example.com', label: ' Ex ' }],
    });
    expect(task?.checklist).toEqual([{ id: 'c', text: 'a', done: true }]);
    expect(task?.links).toEqual([{ id: 'l', url: 'https://example.com/', label: 'Ex' }]);
  });
});

describe('normalizeSettings', () => {
  it('clamps durations to the allowed ranges (F-34)', () => {
    expect(normalizeSettings({ workMinutes: 500, restMinutes: 0.4 })).toMatchObject({
      workMinutes: 180,
      restMinutes: 15,
    });
    expect(normalizeSettings({ workMinutes: 25.6, restMinutes: 90 })).toMatchObject({
      workMinutes: 26,
      restMinutes: 60,
    });
  });

  it('uses defaults for missing or broken theme values', () => {
    const s = normalizeSettings({ theme: { mode: 'neon', customBg: 'blue', randomBg: '#abcdef' } });
    expect(s.theme).toEqual({
      mode: 'system',
      customBg: '#F3F4F6',
      customAccent: '#3B5BDB',
      randomBg: '#ABCDEF',
      randomAccent: null,
      savedId: null,
    });
  });

  it('falls back to the system theme when the saved theme is gone', () => {
    const s = normalizeSettings({ theme: { mode: 'saved', savedId: 'missing' }, themes: [] });
    expect(s.theme.mode).toBe('system');
    expect(s.theme.savedId).toBeNull();
  });
});

describe('normalizeAppData', () => {
  it('returns empty data for garbage input', () => {
    expect(normalizeAppData('nope')).toEqual(createEmptyData());
    expect(createEmptyData()).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: [],
      notes: [],
      secrets: [],
      settings: { workMinutes: 45, restMinutes: 15 },
    });
  });

  it('gives duplicate and missing ids new unique values', () => {
    const data = normalizeAppData({
      tasks: [{ id: 'same', title: 'a' }, { id: 'same', title: 'b' }, { title: 'c' }],
    });
    const ids = data.tasks.map((t) => t.id);
    expect(ids[0]).toBe('same');
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('drops notes and secrets without a title or name', () => {
    const data = normalizeAppData({
      notes: [{ title: '' }, { title: 'N', text: 't', createdAt: 1 }],
      secrets: [{ name: ' ' }, { name: 'S', value: 'v', createdAt: 2 }],
    });
    expect(data.notes).toEqual([
      {
        id: expect.any(String),
        title: 'N',
        text: 't',
        folderId: null,
        taskIds: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    expect(data.secrets).toEqual([{ id: expect.any(String), name: 'S', value: 'v', createdAt: 2 }]);
  });
});

describe('knowledge space (schema 2)', () => {
  const folder = (id: string, parentId: string | null, name = id) => ({ id, name, parentId });

  it('moves folders with a missing parent to the root and drops nameless ones', () => {
    const data = normalizeAppData({
      folders: [folder('a', 'gone'), folder('b', 'a'), { id: 'c', name: '  ' }, folder('d', 'c')],
    });
    expect(data.folders.map((f) => [f.id, f.parentId])).toEqual([
      ['a', null],
      ['b', 'a'],
      ['d', null],
    ]);
  });

  it('breaks folder cycles but keeps the folders below them in place', () => {
    const data = normalizeAppData({
      folders: [folder('child', 'a'), folder('a', 'b'), folder('b', 'a'), folder('self', 'self')],
    });
    const parent = Object.fromEntries(data.folders.map((f) => [f.id, f.parentId]));
    expect(parent.child).toBe('a');
    expect(parent.self).toBeNull();
    // Exactly one of a / b moves to the root, the other stays inside it.
    expect([parent.a, parent.b].filter((p) => p === null)).toHaveLength(1);
  });

  it('checks note folders and task links', () => {
    const data = normalizeAppData({
      tasks: [{ id: 't1', title: 'Task' }],
      folders: [folder('f1', null)],
      notes: [
        { id: 'n1', title: 'In folder', folderId: 'f1', taskIds: ['t1', 'gone', 't1', 7] },
        { id: 'n2', title: 'Lost folder', folderId: 'gone', taskIds: 'nope' },
      ],
    });
    expect(data.notes.map((n) => [n.folderId, n.taskIds])).toEqual([
      ['f1', ['t1']],
      [null, []],
    ]);
  });
});
