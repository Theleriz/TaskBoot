import { describe, expect, it } from 'vitest';
import { countActivity, dayKey } from './activity.ts';
import { importData } from './exchange.ts';
import { DEFAULT_WORKSPACE, WORKSPACE_TABS } from './model.ts';
import { createEmptyData, normalizeAppData } from './normalize.ts';
import { CURRENT_SCHEMA_VERSION, migrate } from './schema.ts';

describe('schema 4', () => {
  it('upgrades version 3 data: one default workspace, no activity, unknown completion times', () => {
    expect(migrate({ schemaVersion: 3, tasks: [] })).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activity: {},
    });
    const data = importData(
      JSON.stringify({
        schemaVersion: 3,
        tasks: [
          { id: 'a', title: 'Done', status: 'done' },
          { id: 'b', title: 'Open', status: 'todo', doneAt: 5 },
        ],
        decks: [{ id: 'd', name: 'D' }],
      }),
    );
    expect(data.settings.workspaces).toEqual([DEFAULT_WORKSPACE]);
    expect(data.tasks.map((t) => t.doneAt)).toEqual([null, null]);
    expect(data.decks[0]?.name).toBe('D');
    expect(data.activity).toEqual({});
  });

  it('keeps known tabs of a workspace, in order, without repeats', () => {
    const data = normalizeAppData({
      settings: {
        workspaces: [
          { id: 'w', name: ' Учёба ', tabs: ['cards', 'nope', 'kanban', 'cards'] },
          { id: 'x', name: 'Пустое', tabs: ['nope'] },
          { id: 'y', name: '', tabs: ['matrix'] },
        ],
      },
    });
    expect(data.settings.workspaces).toEqual([
      { id: 'w', name: 'Учёба', tabs: ['cards', 'kanban'] },
    ]);
    expect(createEmptyData().settings.workspaces[0]?.tabs).toEqual([...WORKSPACE_TABS]);
  });

  it('keeps a done time only for done tasks', () => {
    const data = normalizeAppData({
      tasks: [
        { id: 'a', title: 'A', status: 'done', doneAt: 100 },
        { id: 'b', title: 'B', status: 'doing', doneAt: 100 },
      ],
    });
    expect(data.tasks.map((t) => t.doneAt)).toEqual([100, null]);
  });

  it('cleans activity counters', () => {
    const data = normalizeAppData({
      activity: {
        '2026-10-28': { tasksDone: 2.4, notesEdited: -3, pomodoroMinutes: 'x' },
        '2026-10-29': { tasksDone: 0 },
        yesterday: { tasksDone: 5 },
      },
    });
    expect(data.activity).toEqual({
      '2026-10-28': {
        tasksCreated: 0,
        tasksDone: 2,
        pomodoroSessions: 0,
        pomodoroMinutes: 0,
        notesEdited: 0,
      },
    });
  });
});

describe('activity helpers', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 1).getTime())).toBe('2026-01-06');
  });

  it('never counts below zero', () => {
    const d = createEmptyData();
    const at = new Date(2026, 9, 28, 12).getTime();
    countActivity(d, at, 'tasksDone', -1);
    expect(d.activity['2026-10-28']?.tasksDone).toBe(0);
  });
});
