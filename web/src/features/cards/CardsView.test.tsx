import { EditorView } from '@codemirror/view';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import { BROWSER_DATA_KEY } from '../../data/store.ts';
import { createEnvironment } from '../../platform/platform.ts';

function renderTab(tab: string, stored?: object) {
  if (stored) localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(stored));
  localStorage.setItem('taskTracker.tab', tab);
  render(<App env={createEnvironment(window)} />);
}

const saved = () =>
  JSON.parse(localStorage.getItem(BROWSER_DATA_KEY) ?? 'null') as {
    decks: { id: string; name: string }[];
    cards: {
      kind: string;
      front: string;
      back: string;
      noteId: string | null;
      schedules: Record<string, { state: number; reps: number }>;
    }[];
    reviews: { rating: number }[];
  };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('flashcards tab', () => {
  it('creates a deck, adds cards and studies them with the keyboard', async () => {
    const user = userEvent.setup();
    renderTab('cards');
    await user.type(await screen.findByLabelText('Название новой колоды'), 'Английский{Enter}');
    await user.click(screen.getByRole('button', { name: /^Английский/ }));

    await user.click(screen.getByRole('button', { name: '+ Новая карточка' }));
    await user.type(screen.getByLabelText('Вопрос'), 'cat');
    await user.type(screen.getByLabelText('Ответ'), 'кошка');
    await user.click(screen.getByRole('button', { name: 'Добавить и ещё одну' }));

    // The form stays open for the next card; this time a cloze one.
    await user.click(screen.getByRole('radio', { name: 'Пропуски' }));
    await user.type(screen.getByLabelText('Текст с пропусками'), 'The {{{{c1::dog}} barks');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(saved().cards).toHaveLength(2));
    expect(
      saved()
        .cards.map((c) => c.kind)
        .sort(),
    ).toEqual(['basic', 'cloze']);

    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Учить' }));
    const study = await screen.findByRole('region', { name: 'Повторение: Английский' });

    // New cards come in the order they were added.
    expect(await within(study).findByText('cat')).toBeInTheDocument();
    expect(within(study).queryByText('кошка')).toBeNull();
    await user.keyboard(' ');
    expect(await within(study).findByText('кошка')).toBeInTheDocument();
    await user.keyboard('3');

    // The cloze card hides its gap until the answer is shown.
    expect(await within(study).findByText('[…]')).toBeInTheDocument();
    expect(within(study).queryByText('dog')).toBeNull();
    await user.click(within(study).getByRole('button', { name: 'Показать ответ' }));
    expect(await within(study).findByText('dog')).toBeInTheDocument();
    await user.click(within(study).getByRole('button', { name: /Легко/ }));

    await waitFor(() => expect(saved().reviews.map((r) => r.rating)).toEqual([3, 4]));
    expect(saved().cards.every((c) => Object.values(c.schedules)[0]?.reps === 1)).toBe(true);
  });

  it('ends a session when nothing is due and keeps the daily limit', async () => {
    const user = userEvent.setup();
    renderTab('cards', {
      schemaVersion: 3,
      decks: [{ id: 'd', name: 'Колода' }],
      cards: [
        { id: 'a', deckId: 'd', kind: 'basic', front: 'A', back: '1', createdAt: 1 },
        { id: 'b', deckId: 'd', kind: 'basic', front: 'B', back: '2', createdAt: 2 },
      ],
      settings: { newCardsPerDay: 1 },
    });
    await user.click(await screen.findByRole('button', { name: 'Учить «Колода»' }));
    const study = await screen.findByRole('region', { name: 'Повторение: Колода' });
    await user.keyboard(' ');
    await user.keyboard('4');
    expect(await within(study).findByText('На сегодня всё')).toBeInTheDocument();
    expect(within(study).queryByText('B')).toBeNull();
  });

  it('deletes a deck with its cards after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTab('cards', {
      schemaVersion: 3,
      decks: [{ id: 'd', name: 'Старая' }],
      cards: [{ id: 'a', deckId: 'd', kind: 'basic', front: 'A', back: '' }],
    });
    await user.click(await screen.findByRole('button', { name: 'Удалить колоду «Старая»' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('карточками (1)'));
    await waitFor(() => expect(saved().cards).toEqual([]));
    expect(screen.getByText(/пусто/)).toBeInTheDocument();
  });
});

describe('cards from notes', () => {
  it('turns the selected words of a note into a cloze card linked to the note', async () => {
    const user = userEvent.setup();
    renderTab('space', {
      schemaVersion: 3,
      notes: [
        { id: 'n', title: 'Химия', text: '# Химия\n\nВода кипит при 100 градусах.\n\nИ всё.' },
      ],
      decks: [{ id: 'd', name: 'Наука' }],
    });
    await user.click(await screen.findByRole('button', { name: 'Химия' }));

    const content = await screen.findByLabelText('Текст заметки');
    const view = EditorView.findFromDOM(content)!;
    const from = view.state.doc.toString().indexOf('100 градусах');
    view.dispatch({ selection: { anchor: from, head: from + '100 градусах'.length } });

    await user.click(screen.getByRole('button', { name: 'В карточку' }));
    const dialog = await screen.findByRole('dialog', { name: 'Новая карточка' });
    expect(within(dialog).getByLabelText('Текст с пропусками')).toHaveValue(
      'Вода кипит при {{c1::100 градусах}}.',
    );
    expect(within(dialog).getByRole('combobox')).toHaveDisplayValue('Наука');
    await user.click(within(dialog).getByRole('button', { name: 'Создать карточку' }));

    await waitFor(() =>
      expect(saved().cards[0]).toMatchObject({
        kind: 'cloze',
        front: 'Вода кипит при {{c1::100 градусах}}.',
        noteId: 'n',
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'Новая карточка' })).toBeNull();

    // From the card, the way back to its note.
    await user.click(screen.getByRole('tab', { name: 'Карточки' }));
    await user.click(screen.getByRole('button', { name: /^Наука/ }));
    await user.click(screen.getByRole('button', { name: 'Заметка' }));
    expect(screen.getByRole('tab', { name: 'Пространство' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Заголовок заметки')).toHaveValue('Химия');
  });

  it('can put the card into a new deck', async () => {
    const user = userEvent.setup();
    renderTab('space', {
      schemaVersion: 3,
      notes: [{ id: 'n', title: 'Пусто', text: '' }],
    });
    await user.click(await screen.findByRole('button', { name: 'Пусто' }));
    await user.click(screen.getByRole('button', { name: 'В карточку' }));
    const dialog = await screen.findByRole('dialog', { name: 'Новая карточка' });
    // No decks yet: a new one is offered.
    expect(within(dialog).getByLabelText('Название новой колоды')).toHaveValue('Заметки');
    await user.type(within(dialog).getByLabelText('Вопрос'), 'Q');
    await user.type(within(dialog).getByLabelText('Ответ'), 'A');
    await user.click(within(dialog).getByRole('button', { name: 'Создать карточку' }));
    await waitFor(() => expect(saved().decks.map((d) => d.name)).toEqual(['Заметки']));
    expect(saved().cards[0]).toMatchObject({ front: 'Q', back: 'A', noteId: 'n' });
  });
});
