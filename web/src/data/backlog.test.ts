import { describe, expect, it } from 'vitest';
import { importData } from './exchange.ts';
import { WORKSPACE_TABS } from './model.ts';
import { normalizeAppData } from './normalize.ts';
import { CURRENT_SCHEMA_VERSION, migrate } from './schema.ts';

describe('schema 5', () => {
  it('upgrades version 4 data: no goals, tasks off the backlog, «Бэклог» in «Основное»', () => {
    const v4 = {
      schemaVersion: 4,
      tasks: [{ id: 'a', title: 'Old', status: 'todo' }],
      settings: {
        workspaces: [
          { id: 'main', name: 'Основное', tabs: ['matrix', 'kanban', 'pomodoro', 'space'] },
          { id: 'w', name: 'Учёба', tabs: ['cards'] },
        ],
      },
    };
    expect(migrate(v4)).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, goals: [] });
    const data = importData(JSON.stringify(v4));
    expect(data.tasks[0]).toMatchObject({ backlog: false, goalId: null });
    expect(data.settings.workspaces.map((w) => w.tabs)).toEqual([
      ['matrix', 'kanban', 'backlog', 'pomodoro', 'space'],
      ['cards'],
    ]);
  });

  it('adds the tab at the end when «Основное» has no «Канбан», and only once', () => {
    const tabsOf = (tabs: string[]) =>
      importData(
        JSON.stringify({
          schemaVersion: 4,
          settings: { workspaces: [{ id: 'main', name: 'Основное', tabs }] },
        }),
      ).settings.workspaces[0]?.tabs;
    expect(tabsOf(['cards', 'matrix'])).toEqual(['cards', 'matrix', 'backlog']);
    expect(tabsOf(['backlog', 'matrix'])).toEqual(['backlog', 'matrix']);
  });

  it('gives version 3 data the full default workspace', () => {
    const data = importData(JSON.stringify({ schemaVersion: 3, tasks: [] }));
    expect(data.settings.workspaces[0]?.tabs).toEqual([...WORKSPACE_TABS]);
  });

  it('keeps the backlog flag only on "todo" tasks and drops unknown goals', () => {
    const data = normalizeAppData({
      goals: [
        { id: 'g', title: ' Цель ', deadline: '2027-01-31' },
        { id: 'h', title: 'Без срока', deadline: '31.01.2027' },
        { id: 'x', title: ' ' },
      ],
      tasks: [
        { id: 'a', title: 'A', status: 'todo', backlog: true, goalId: 'g' },
        { id: 'b', title: 'B', status: 'doing', backlog: true, goalId: 'x' },
        { id: 'c', title: 'C', backlog: 'yes' },
      ],
    });
    expect(data.goals.map((g) => [g.title, g.deadline])).toEqual([
      ['Цель', '2027-01-31'],
      ['Без срока', null],
    ]);
    expect(data.tasks.map((t) => [t.backlog, t.goalId])).toEqual([
      [true, 'g'],
      [false, null],
      [false, null],
    ]);
  });
});
