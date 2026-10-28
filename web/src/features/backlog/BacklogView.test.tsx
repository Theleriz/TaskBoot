import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import { BROWSER_DATA_KEY } from '../../data/store.ts';
import { createEnvironment } from '../../platform/platform.ts';

const saved = () =>
  JSON.parse(localStorage.getItem(BROWSER_DATA_KEY) ?? 'null') as {
    tasks: { title: string; backlog: boolean; goalId: string | null; status: string }[];
    goals: { id: string; title: string; deadline: string | null }[];
  };

function renderApp(tab: string, stored?: object) {
  localStorage.setItem('taskTracker.tab', tab);
  if (stored) localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(stored));
  render(<App env={createEnvironment(window)} />);
}

const backlogList = () => screen.getByRole('list', { name: 'Задачи на потом' });
const zone = (key: string) => document.querySelector<HTMLElement>(`[data-zone="${key}"]`)!;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('backlog tab', () => {
  it('keeps tasks for later off the boards until taken for today', async () => {
    const user = userEvent.setup();
    renderApp('backlog');
    const title = await screen.findByRole('textbox', { name: 'Заголовок задачи на потом' });
    await user.type(title, 'Прочитать статью{Enter}');
    expect(within(backlogList()).getByText('Прочитать статью')).toBeInTheDocument();
    // The quadrant it will go to is shown.
    expect(within(backlogList()).getByText('Важно · Не срочно')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Эйзенхауэр' }));
    expect(screen.queryByText('Прочитать статью')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Бэклог' }));
    await user.click(screen.getByRole('button', { name: 'Взять на сегодня: Прочитать статью' }));
    expect(within(backlogList()).queryByText('Прочитать статью')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Эйзенхауэр' }));
    expect(within(zone('q2')).getByText('Прочитать статью')).toBeInTheDocument();
    await waitFor(() => expect(saved().tasks).toMatchObject([{ backlog: false, status: 'todo' }]));
  });

  it('puts a board task off from its details and brings it back', async () => {
    const user = userEvent.setup();
    renderApp('matrix', {
      schemaVersion: 5,
      tasks: [{ id: 't', title: 'Отпуск', quadrant: 'q1', status: 'doing' }],
    });
    await user.click(await screen.findByRole('article', { name: 'Отпуск' }));
    const panel = screen.getByRole('dialog', { name: 'Детали задачи' });
    await user.click(within(panel).getByRole('button', { name: 'Отложить в бэклог' }));
    expect(within(panel).getByText(/В бэклоге/)).toBeInTheDocument();
    // A backlog task has no stage: it is always "todo".
    expect(within(panel).queryByRole('combobox', { name: 'Стадия' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('article', { name: 'Отпуск' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Бэклог' }));
    expect(within(backlogList()).getByText('Важно · Срочно')).toBeInTheDocument();
    await user.click(within(backlogList()).getByText('Отпуск'));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Детали задачи' })).getByRole('button', {
        name: 'Взять на сегодня',
      }),
    );
    await waitFor(() => expect(saved().tasks).toMatchObject([{ backlog: false, status: 'todo' }]));
  });

  it('creates a goal, links tasks to it and shows progress', async () => {
    const user = userEvent.setup();
    renderApp('backlog', {
      schemaVersion: 5,
      tasks: [{ id: 't', title: 'Глава 1', status: 'todo' }],
    });
    await user.click(await screen.findByRole('button', { name: '+ Новая цель' }));
    const dialog = screen.getByRole('dialog', { name: 'Новая цель' });
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    expect(within(dialog).getByText('Введите название цели')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Название' }), 'Диплом');
    await user.type(within(dialog).getByLabelText(/Срок/), '2027-06-01');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByText('нет задач')).toBeInTheDocument();
    expect(screen.getByText(/срок 1 июня 2027/)).toBeInTheDocument();

    // A task added while the goal is shown belongs to it.
    await user.click(screen.getByRole('button', { name: 'Диплом' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Заголовок задачи на потом' }),
      'Глава 2{Enter}',
    );
    expect(screen.getByText('выполнено 0 из 1')).toBeInTheDocument();

    // A board task is linked in its details; finishing it moves the progress.
    await user.click(screen.getByRole('tab', { name: 'Канбан' }));
    await user.click(screen.getByRole('article', { name: 'Глава 1' }));
    const panel = screen.getByRole('dialog', { name: 'Детали задачи' });
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Цель' }), 'Диплом');
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Стадия' }), 'Готово');
    await user.keyboard('{Escape}');
    expect(within(zone('done')).getByText('Диплом')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Бэклог' }));
    expect(screen.getByText('выполнено 1 из 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Прогресс цели «Диплом»' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    await waitFor(() => {
      const data = saved();
      expect(data.goals).toMatchObject([{ title: 'Диплом', deadline: '2027-06-01' }]);
      expect(data.tasks.map((t) => t.goalId)).toEqual([data.goals[0]!.id, data.goals[0]!.id]);
    });
  });

  it('deletes a goal but keeps its tasks', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('backlog', {
      schemaVersion: 5,
      goals: [{ id: 'g', title: 'Английский', deadline: '2020-01-01' }],
      tasks: [{ id: 't', title: 'Слова', backlog: true, goalId: 'g' }],
    });
    // An unfinished goal past its deadline is marked.
    expect(await screen.findByText(/просрочен на/)).toHaveClass('overdue');
    await user.click(screen.getByRole('button', { name: 'Изменить цель «Английский»' }));
    await user.click(screen.getByRole('button', { name: 'Удалить цель' }));
    expect(screen.queryByRole('button', { name: 'Английский' })).toBeNull();
    expect(within(backlogList()).getByText('Слова')).toBeInTheDocument();
    await waitFor(() => expect(saved().tasks).toMatchObject([{ goalId: null, backlog: true }]));
  });
});
