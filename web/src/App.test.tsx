import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { BROWSER_DATA_KEY } from './data/store.ts';
import { LEGACY_KEYS } from './data/legacy.ts';
import { createEnvironment } from './platform/platform.ts';
import { TABS } from './tabs.ts';

function renderApp() {
  return render(<App env={createEnvironment(window)} />);
}

const zone = (name: string) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
});

describe('App', () => {
  it('shows every tab from the specs and the settings gear', async () => {
    renderApp();
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([...TABS.map((t) => t.title), '']);
    expect(screen.getByRole('tab', { name: 'Настройки' })).toBeInTheDocument();
  });

  it('adds a task to q2 / todo and shows it on both boards (F-01, F-02, F-04)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(await screen.findByLabelText('Заголовок новой задачи'), 'Купить молоко{Enter}');

    expect(within(zone('Важно · Не срочно')).getByText('Купить молоко')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Канбан' }));
    expect(within(zone('TODO')).getByText('Купить молоко')).toBeInTheDocument();
  });

  it('rejects a blank title (F-08)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(await screen.findByLabelText('Заголовок новой задачи'), '   {Enter}');
    expect(screen.getByText('Введите заголовок задачи')).toBeInTheDocument();
  });

  it('opens details, adds a checklist item and shows the indicator (F-81, F-85)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(await screen.findByLabelText('Заголовок новой задачи'), 'Отчёт{Enter}');
    await user.click(screen.getByText('Отчёт'));

    const dialog = screen.getByRole('dialog', { name: 'Детали задачи' });
    await user.type(
      within(dialog).getByLabelText('Новый пункт чек-листа'),
      'Собрать данные{Enter}',
    );
    expect(within(dialog).getByText('выполнено 0 из 1')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTitle('Чек-лист: выполнено 0 из 1')).toHaveTextContent('0/1');
  });

  it('saves to browser storage and reads it back', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await user.type(await screen.findByLabelText('Заголовок новой задачи'), 'Сохранится{Enter}');
    await new Promise((r) => setTimeout(r, 400));
    expect(localStorage.getItem(BROWSER_DATA_KEY)).toContain('Сохранится');
    first.unmount();

    renderApp();
    expect(await screen.findByText('Сохранится')).toBeInTheDocument();
  });

  it('migrates the legacy web app data on first start', async () => {
    localStorage.setItem(
      LEGACY_KEYS.tasks,
      JSON.stringify([{ id: 'x', title: 'Из старой версии' }]),
    );
    renderApp();
    expect(await screen.findByText('Из старой версии')).toBeInTheDocument();
    expect(screen.getByText('Данные перенесены из прежней веб-версии.')).toBeInTheDocument();
  });

  it('switches the theme from settings', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('tab', { name: 'Настройки' }));
    await user.click(screen.getByRole('radio', { name: 'Тёмная' }));
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#15171B');
    await user.click(screen.getByRole('radio', { name: 'Светлая' }));
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#F3F4F6');
  });
});
