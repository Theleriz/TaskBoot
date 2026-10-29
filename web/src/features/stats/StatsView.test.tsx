import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App.tsx';
import { dayKey } from '../../data/activity.ts';
import { BROWSER_DATA_KEY } from '../../data/store.ts';
import { createEnvironment } from '../../platform/platform.ts';
import { addDays } from './stats.ts';

const today = dayKey(Date.now());
const yesterday = addDays(today, -1);

function renderStats(stored: object) {
  localStorage.setItem('taskTracker.tab', 'stats');
  localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(stored));
  render(<App env={createEnvironment(window)} />);
}

const tile = (title: string) => screen.getByText(title).closest<HTMLElement>('.stat-tile')!;

beforeEach(() => {
  localStorage.clear();
});

describe('statistics tab', () => {
  it('sums the last 7 days, counts the streak and shows a year of days', async () => {
    renderStats({
      schemaVersion: 6,
      activity: {
        [yesterday]: { tasksDone: 2, pomodoroSessions: 1, pomodoroMinutes: 45 },
        [today]: { tasksDone: 1, notesEdited: 3 },
        [addDays(today, -20)]: { tasksDone: 5 },
      },
    });
    expect(await screen.findByRole('heading', { name: 'За 7 дней' })).toBeInTheDocument();
    expect(within(tile('Дней подряд')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Задач выполнено')).getByText('3')).toBeInTheDocument();
    expect(within(tile('Задач выполнено')).getByText('сегодня: 1')).toBeInTheDocument();
    expect(within(tile('Минут Pomodoro')).getByText('45')).toBeInTheDocument();
    expect(screen.getByText(/Данные собираются с/)).toBeInTheDocument();

    const cells = document.querySelectorAll('.heatmap rect[data-day]');
    expect(cells.length).toBeGreaterThan(52 * 7);
    expect(cells[cells.length - 1]).toHaveAttribute('data-day', today);
    // The busiest day is the darkest; an empty day has no color.
    expect(document.querySelector(`[data-day="${addDays(today, -20)}"]`)).toHaveClass('hm-l4');
    expect(document.querySelector(`[data-day="${addDays(today, -2)}"]`)).toHaveClass('hm-l0');
  });

  it('switches the metric and describes the hovered day', async () => {
    const user = userEvent.setup();
    renderStats({
      schemaVersion: 6,
      activity: {
        [yesterday]: { tasksDone: 2, tasksCreated: 1, pomodoroSessions: 1, pomodoroMinutes: 45 },
      },
    });
    const cell = await screen.findByText((_, el) => el?.getAttribute('data-day') === yesterday);
    expect(within(cell).getByText(/: 3 действий$/)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Показатель' }),
      'Минуты Pomodoro',
    );
    expect(within(cell).getByText(/: 45 мин$/)).toBeInTheDocument();

    fireEvent.mouseEnter(cell);
    expect(
      screen.getByText(/выполнено задач: 2 · создано задач: 1 · Pomodoro: 45 мин/),
    ).toBeInTheDocument();
    expect(cell).toHaveClass('hovered');
  });

  it('summarizes flashcards and says when there is nothing yet', async () => {
    renderStats({
      schemaVersion: 6,
      decks: [{ id: 'd', name: 'D' }],
      cards: [{ id: 'c', deckId: 'd', kind: 'basic', front: 'Q' }],
      reviews: [
        { cardId: 'c', slot: '0', rating: 3, state: 0, at: Date.now() },
        { cardId: 'c', slot: '0', rating: 1, state: 2, at: Date.now() },
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Карточки' })).toBeInTheDocument();
    expect(within(tile('Повторений за 30 дней')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Вспомнили')).getByText('50%')).toBeInTheDocument();
    expect(within(tile('Новых')).getByText('1')).toBeInTheDocument();
  });

  it('explains that collecting starts with v2.3.0 when there is no data', async () => {
    renderStats({ schemaVersion: 6 });
    expect(await screen.findByText(/собирается с версии 2\.3\.0/)).toBeInTheDocument();
    expect(within(tile('Дней подряд')).getByText('0')).toBeInTheDocument();
  });
});
