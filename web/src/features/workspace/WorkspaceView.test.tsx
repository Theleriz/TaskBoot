import { EditorView } from '@codemirror/view';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.tsx';
import { BROWSER_DATA_KEY } from '../../data/store.ts';
import { createEnvironment } from '../../platform/platform.ts';

function renderSpace(stored?: object) {
  if (stored) localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(stored));
  localStorage.setItem('taskTracker.tab', 'space');
  const env = createEnvironment(window);
  const openExternal = vi.spyOn(env.platform, 'openExternal').mockImplementation(() => {});
  render(<App env={env} />);
  return { openExternal };
}

/** Waits until the stored data is loaded and the tree is shown. */
const loaded = () => screen.findByRole('group', { name: 'Папки и заметки' });

const tree = () => screen.getByRole('group', { name: 'Папки и заметки' });
const savedData = () =>
  JSON.parse(localStorage.getItem(BROWSER_DATA_KEY) ?? 'null') as {
    folders: { id: string; name: string; parentId: string | null }[];
    notes: { title: string; text: string; folderId: string | null }[];
  };

/** Types into the CodeMirror editor the way a user would: one transaction per input. */
async function typeInEditor(text: string) {
  const content = await screen.findByLabelText('Текст заметки');
  const view = EditorView.findFromDOM(content);
  if (!view) throw new Error('editor not found');
  view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('knowledge space', () => {
  it('opens notes saved by v2.0 from the root of the tree', async () => {
    const user = userEvent.setup();
    renderSpace({ schemaVersion: 1, notes: [{ id: 'n1', title: 'Старая заметка', text: '# Hi' }] });
    await user.click(await within(await loaded()).findByRole('button', { name: 'Старая заметка' }));
    expect(screen.getByLabelText('Заголовок заметки')).toHaveValue('Старая заметка');
    expect(
      await screen.findByRole('heading', { name: 'Hi' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('creates a note, renames it and saves text as you type', async () => {
    const user = userEvent.setup();
    renderSpace();
    await user.click(await screen.findByRole('button', { name: 'Новая заметка в корне' }));

    const title = screen.getByLabelText('Заголовок заметки');
    expect(title).toHaveValue('Новая заметка');
    await user.clear(title);
    await user.type(title, 'Формулы{Enter}');
    expect(within(tree()).getByRole('button', { name: 'Формулы' })).toBeInTheDocument();

    await typeInEditor('Площадь: $S = \\pi r^2$');
    expect(await screen.findByText((_, el) => el?.className === 'katex')).toBeInTheDocument();
    await waitFor(() =>
      expect(savedData().notes[0]).toMatchObject({
        title: 'Формулы',
        text: 'Площадь: $S = \\pi r^2$',
      }),
    );
  });

  it('keeps a blank title from replacing the old one', async () => {
    const user = userEvent.setup();
    renderSpace({ schemaVersion: 2, notes: [{ id: 'n1', title: 'Имя', text: '' }] });
    await user.click(await within(await loaded()).findByRole('button', { name: 'Имя' }));
    const title = screen.getByLabelText('Заголовок заметки');
    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue('Имя');
  });

  it('creates folders, puts notes into them and moves notes between folders', async () => {
    const user = userEvent.setup();
    renderSpace();
    await user.click(await screen.findByRole('button', { name: 'Новая папка в корне' }));
    const name = screen.getByLabelText('Название папки');
    await user.clear(name);
    await user.type(name, 'Учёба{Enter}');

    await user.click(screen.getByRole('button', { name: 'Новая заметка в «Учёба»' }));
    const folderSelect = screen.getByRole('combobox');
    expect(folderSelect).toHaveDisplayValue('Учёба');

    await user.selectOptions(folderSelect, 'Корень');
    await waitFor(() => expect(savedData().notes[0]?.folderId).toBeNull());
    expect(savedData().folders.map((f) => f.name)).toEqual(['Учёба']);
  });

  it('keeps notes when their folder is deleted', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSpace({
      schemaVersion: 2,
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
      notes: [{ id: 'n1', title: 'Внутри B', text: '', folderId: 'b' }],
    });
    await user.click(await within(await loaded()).findByRole('button', { name: 'A' }));
    await user.click(within(tree()).getByRole('button', { name: 'B' }));
    expect(within(tree()).getByRole('button', { name: 'Внутри B' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить папку «B»' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('в папку «A»'));
    expect(within(tree()).getByRole('button', { name: 'Внутри B' })).toBeInTheDocument();
    await waitFor(() => expect(savedData().notes[0]?.folderId).toBe('a'));
    expect(savedData().folders.map((f) => f.id)).toEqual(['a']);
  });

  it('opens links from the preview in the system browser', async () => {
    const user = userEvent.setup();
    const { openExternal } = renderSpace({
      schemaVersion: 2,
      notes: [
        { id: 'n1', title: 'Ссылки', text: '[сайт](https://example.com) и [файл](notes.md)' },
      ],
    });
    await user.click(await within(await loaded()).findByRole('button', { name: 'Ссылки' }));
    await user.click(await screen.findByRole('link', { name: 'сайт' }));
    expect(openExternal).toHaveBeenCalledWith('https://example.com/');
    await user.click(screen.getByRole('link', { name: 'файл' }));
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});

describe('search', () => {
  const stored = {
    schemaVersion: 2,
    folders: [{ id: 'f', name: 'Работа', parentId: null }],
    notes: [
      { id: 'n1', title: 'План', text: 'Первая строка\nсдать отчёт по ёлкам', folderId: 'f' },
      { id: 'n2', title: 'Почта', text: 'ivan@example.com' },
    ],
  };
  const results = () => screen.findByRole('region', { name: 'Результаты поиска' });

  it('finds notes by words and shows the match in the editor', async () => {
    const user = userEvent.setup();
    renderSpace(stored);
    await loaded();
    await user.type(screen.getByLabelText('Поиск по заметкам'), 'елкам');

    const list = await results();
    expect(await within(list).findByText('Найдено заметок: 1')).toBeInTheDocument();
    expect(within(list).getByText('Работа')).toBeInTheDocument();
    expect(within(list).getByText('ёлкам', { selector: 'mark' })).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: /сдать отчёт/ }));
    const content = await screen.findByLabelText('Текст заметки');
    const view = EditorView.findFromDOM(content);
    const { from, to } = view!.state.selection.main;
    expect(view!.state.sliceDoc(from, to)).toBe('ёлкам');

    // Escape clears the search and brings the tree back.
    await user.type(screen.getByLabelText('Поиск по заметкам'), '{Escape}');
    expect(await loaded()).toBeInTheDocument();
  });

  it('searches by regular expression and explains broken patterns', async () => {
    const user = userEvent.setup();
    renderSpace(stored);
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Регулярное выражение' }));
    const input = screen.getByLabelText('Поиск по заметкам');

    await user.type(input, '\\w+@\\w+');
    const list = await results();
    expect(await within(list).findByText('ivan@example', { selector: 'mark' })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '[[');
    expect(
      await within(await results()).findByText(/Неверное регулярное выражение/),
    ).toBeInTheDocument();
  });
});
