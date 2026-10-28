import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import { BROWSER_DATA_KEY } from '../../data/store.ts';
import { createEnvironment } from '../../platform/platform.ts';

const tabNames = () =>
  within(screen.getByRole('tablist', { name: 'Разделы' }))
    .getAllByRole('tab')
    .map((t) => t.textContent);

const saved = () =>
  JSON.parse(localStorage.getItem(BROWSER_DATA_KEY) ?? 'null') as {
    settings: { workspaces: { name: string; tabs: string[] }[] };
  };

function renderApp(stored?: object) {
  if (stored) localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(stored));
  render(<App env={createEnvironment(window)} />);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('workspaces', () => {
  it('starts with "Основное" and all tabs, as before workspaces existed', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: 'Основное' })).toBeInTheDocument();
    expect(tabNames()).toEqual(['Эйзенхауэр', 'Канбан', 'Pomodoro', 'Пространство', 'Карточки']);
  });

  it('creates a workspace with chosen tabs in a chosen order and switches to it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Основное' }));
    await user.click(screen.getByRole('button', { name: '+ Новое рабочее пространство' }));

    const dialog = screen.getByRole('dialog', { name: 'Новое рабочее пространство' });
    const name = within(dialog).getByRole('textbox');
    await user.clear(name);
    await user.type(name, 'Учёба');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Эйзенхауэр' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Pomodoro' }));
    for (let i = 0; i < 4; i++) {
      await user.click(within(dialog).getByRole('button', { name: 'Выше: Карточки' }));
    }
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: 'Учёба' })).toBeInTheDocument();
    expect(tabNames()).toEqual(['Карточки', 'Канбан', 'Пространство']);
    // The open tab (the matrix) is not in the new workspace: its first tab opens instead.
    expect(screen.getByRole('tab', { name: 'Карточки' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(saved().settings.workspaces.map((w) => [w.name, w.tabs])).toEqual([
        ['Основное', ['matrix', 'kanban', 'pomodoro', 'space', 'cards']],
        ['Учёба', ['cards', 'kanban', 'space']],
      ]),
    );
  });

  it('does not save a workspace without a name or without tabs', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Основное' }));
    await user.click(screen.getByRole('button', { name: 'Настроить «Основное»…' }));
    const dialog = screen.getByRole('dialog');
    for (const tab of ['Эйзенхауэр', 'Канбан', 'Pomodoro', 'Пространство', 'Карточки']) {
      await user.click(within(dialog).getByRole('checkbox', { name: tab }));
    }
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    expect(within(dialog).getByText('Выберите хотя бы одну вкладку')).toBeInTheDocument();
    // The only workspace cannot be deleted.
    expect(within(dialog).queryByRole('button', { name: 'Удалить пространство' })).toBeNull();
  });

  it('remembers the workspace, keeps a shared tab when switching, and deletes a workspace', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('taskTracker.tab', 'kanban');
    localStorage.setItem('taskTracker.workspace', 'w');
    renderApp({
      schemaVersion: 4,
      settings: {
        workspaces: [
          { id: 'main', name: 'Основное', tabs: ['matrix', 'kanban'] },
          { id: 'w', name: 'Работа', tabs: ['kanban', 'pomodoro'] },
        ],
      },
    });
    expect(await screen.findByRole('button', { name: 'Работа' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Канбан' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Работа' }));
    await user.click(screen.getByRole('button', { name: 'Основное' }));
    expect(tabNames()).toEqual(['Эйзенхауэр', 'Канбан']);
    expect(screen.getByRole('tab', { name: 'Канбан' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Основное' }));
    await user.click(screen.getByRole('button', { name: 'Настроить «Основное»…' }));
    await user.click(screen.getByRole('button', { name: 'Удалить пространство' }));
    expect(await screen.findByRole('button', { name: 'Работа' })).toBeInTheDocument();
    await waitFor(() => expect(saved().settings.workspaces.map((w) => w.name)).toEqual(['Работа']));
  });

  it('shows a tab outside the workspace while it is open (a note opened from a card)', async () => {
    const user = userEvent.setup();
    localStorage.setItem('taskTracker.tab', 'cards');
    localStorage.setItem('taskTracker.workspace', 'w');
    renderApp({
      schemaVersion: 4,
      notes: [{ id: 'n', title: 'Источник', text: '' }],
      decks: [{ id: 'd', name: 'Колода' }],
      cards: [{ id: 'c', deckId: 'd', kind: 'basic', front: 'Q', back: 'A', noteId: 'n' }],
      settings: { workspaces: [{ id: 'w', name: 'Карточки', tabs: ['cards'] }] },
    });
    await user.click(await screen.findByRole('button', { name: /^Колода/ }));
    await user.click(screen.getByRole('button', { name: 'Заметка' }));
    expect(tabNames()).toEqual(['Карточки', 'Пространство']);
    expect(screen.getByRole('tab', { name: 'Пространство' })).toHaveAttribute(
      'title',
      'Этой вкладки нет в рабочем пространстве',
    );
  });
});
