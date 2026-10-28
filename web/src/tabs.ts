// The tab registry: every tool a workspace can show (phase 2.2). The ids and their default order
// live in the data model (WORKSPACE_TABS), because workspaces store them; titles live here.
// App.tsx renders each tab by id. A new tool adds its id to WORKSPACE_TABS, a title here and a
// case in App.tsx.

import { WORKSPACE_TABS, type WorkspaceTab } from './data/model.ts';

export const TAB_TITLES: Record<WorkspaceTab, string> = {
  matrix: 'Эйзенхауэр',
  kanban: 'Канбан',
  backlog: 'Бэклог',
  pomodoro: 'Pomodoro',
  space: 'Пространство',
  cards: 'Карточки',
};

/** All tabs in the default order. */
export const TABS = WORKSPACE_TABS.map((id) => ({ id, title: TAB_TITLES[id] }));

export type TabId = WorkspaceTab;

/** The gear in the top-right corner opens settings; it is a view, not one of the tabs. */
export type ViewId = TabId | 'settings';

export const VIEW_IDS: readonly ViewId[] = [...WORKSPACE_TABS, 'settings'];
