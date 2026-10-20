// Tabs from the base spec (F-50) plus the workspace from spec 02 (F-60).
// The views themselves are ported in phase 0.4.
export const TABS = [
  { id: 'matrix', title: 'Эйзенхауэр' },
  { id: 'kanban', title: 'Канбан' },
  { id: 'pomodoro', title: 'Pomodoro' },
  { id: 'space', title: 'Пространство' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** The gear in the top-right corner opens settings; it is a view, not one of the main tabs. */
export type ViewId = TabId | 'settings';

export const VIEW_IDS: readonly ViewId[] = [...TABS.map((t) => t.id), 'settings'];
