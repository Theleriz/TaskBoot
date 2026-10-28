import { describe, expect, it } from 'vitest';
import nativeData from './__fixtures__/native-data.json';
import { DataFormatError, SchemaTooNewError } from './errors.ts';
import { exportData, exportFileName, importData } from './exchange.ts';
import { migrate, CURRENT_SCHEMA_VERSION } from './schema.ts';

describe('schema migrations', () => {
  it('treats data without schemaVersion as version 0 and upgrades it', () => {
    expect(migrate({ tasks: [] })).toEqual({
      tasks: [],
      folders: [],
      decks: [],
      cards: [],
      reviews: [],
      activity: {},
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
  });

  it('puts version 1 notes into the root folder without links', () => {
    const v1 = {
      schemaVersion: 1,
      tasks: [{ id: 't1', title: 'Task' }],
      notes: [{ id: 'n1', title: 'Old note', text: 'body', createdAt: 5, updatedAt: 6 }],
    };
    expect(migrate(v1)).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      folders: [],
      notes: [{ id: 'n1', title: 'Old note', text: 'body', folderId: null, taskIds: [] }],
    });
    const data = importData(JSON.stringify(v1));
    expect(data.notes[0]).toEqual({
      id: 'n1',
      title: 'Old note',
      text: 'body',
      folderId: null,
      taskIds: [],
      createdAt: 5,
      updatedAt: 6,
    });
    expect(data.tasks[0]?.title).toBe('Task');
  });

  it('refuses data from a newer app', () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(SchemaTooNewError);
  });
});

describe('import', () => {
  it('reads the native app data.json without changes to its content', () => {
    const data = importData(JSON.stringify(nativeData));
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[1]?.checklist.map((c) => c.done)).toEqual([true, false]);
    expect(data.tasks[1]?.links[0]?.url).toBe('https://example.com/issue/1');
    expect(data.settings.theme).toMatchObject({ mode: 'saved', savedId: 't1', randomBg: null });
    expect(data.settings.themes[0]).toEqual({
      id: 't1',
      name: 'Фиолетовая',
      bg: '#F3EDF5',
      accent: '#A95DD4',
    });
    expect(data.notes[0]).toMatchObject({ title: 'Идеи', folderId: null, taskIds: [] });
    expect(data.folders).toEqual([]);
    expect(data.secrets[0]?.value).toBe('demo-value');
  });

  it('reports broken files and files from a newer app', () => {
    expect(() => importData('{not json')).toThrow(DataFormatError);
    expect(() => importData('[1, 2]')).toThrow(DataFormatError);
    expect(() => importData(JSON.stringify({ schemaVersion: 99 }))).toThrow(SchemaTooNewError);
  });
});

describe('export', () => {
  const data = importData(JSON.stringify(nativeData));
  const now = new Date(2026, 9, 20, 12, 0, 0);

  it('round-trips through import', () => {
    const text = exportData(data, { includeSecrets: true, now });
    expect(JSON.parse(text)).toMatchObject({ app: 'task-tracker', exportedAt: now.toISOString() });
    expect(importData(text)).toEqual(data);
  });

  it('can leave secrets out', () => {
    const text = exportData(data, { includeSecrets: false, now });
    expect(text).not.toContain('demo-value');
    expect(importData(text).secrets).toEqual([]);
  });

  it('names files by date', () => {
    expect(exportFileName(now)).toBe('task-tracker-2026-10-20.json');
  });
});
