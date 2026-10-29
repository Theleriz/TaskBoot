import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../data/normalize.ts';
import {
  addGoal,
  deleteGoal,
  goalProblem,
  goalProgress,
  sendToBacklog,
  setTaskGoal,
  takeForToday,
  updateGoal,
  addWorkspace,
  deleteWorkspace,
  updateWorkspace,
  workspaceProblem,
  recordPomodoro,
  addCard,
  addDeck,
  answerCard,
  cardProblem,
  deleteCard,
  deleteDeck,
  deleteNote,
  renameDeck,
  resetCard,
  setNewCardsPerDay,
  updateCard,
  addChecklistItem,
  addFolder,
  addNote,
  deleteFolder,
  isInsideFolder,
  linkNoteTask,
  notesOfTask,
  unlinkNoteTask,
  moveFolder,
  moveNote,
  renameFolder,
  renameNote,
  setNoteText,
  addLink,
  addTask,
  deleteTask,
  deleteTheme,
  moveTask,
  renameTask,
  saveTheme,
  setDurations,
  updateLink,
} from './ops.ts';

function withTask() {
  const d = createEmptyData();
  addTask(d, 'Task', 't1', 1);
  return d;
}

describe('ops', () => {
  it('adds tasks to q2 / todo and rejects blank titles', () => {
    const d = createEmptyData();
    expect(addTask(d, '  ', 'x', 1)).toBe(false);
    expect(addTask(d, ' A ', 'a', 5)).toBe(true);
    expect(d.tasks).toEqual([
      {
        id: 'a',
        title: 'A',
        quadrant: 'q2',
        status: 'todo',
        createdAt: 5,
        doneAt: null,
        backlog: false,
        goalId: null,
        description: '',
        checklist: [],
        links: [],
      },
    ]);
  });

  it('moves only one axis at a time (F-05, F-06)', () => {
    const d = withTask();
    moveTask(d, 't1', { quadrant: 'q1' }, 2);
    moveTask(d, 't1', { status: 'done' }, 3);
    expect(d.tasks[0]).toMatchObject({ quadrant: 'q1', status: 'done' });
  });

  it('keeps the old title when renaming to blank', () => {
    const d = withTask();
    expect(renameTask(d, 't1', '   ')).toBe(false);
    expect(d.tasks[0]?.title).toBe('Task');
  });

  it('validates links (F-89) and deletes details with the task (F-96)', () => {
    const d = withTask();
    expect(addLink(d, 't1', 'javascript:alert(1)', '', 'l0')).toBe(false);
    expect(addLink(d, 't1', 'example.com', ' Ex ', 'l1')).toBe(true);
    expect(updateLink(d, 't1', 'l1', 'not a url', '')).toBe(false);
    expect(d.tasks[0]?.links).toEqual([{ id: 'l1', url: 'https://example.com/', label: 'Ex' }]);
    addChecklistItem(d, 't1', 'step', 'c1');
    deleteTask(d, 't1');
    expect(d.tasks).toEqual([]);
  });

  it('keeps notes when a linked task is deleted, without the link', () => {
    const d = withTask();
    addTask(d, 'Other', 't2', 2);
    addNote(d, 'Note', '', 'n1', 3, null);
    d.notes[0]!.taskIds = ['t1', 't2'];
    deleteTask(d, 't1');
    expect(d.notes[0]?.taskIds).toEqual(['t2']);
  });

  it('clamps durations (F-34)', () => {
    const d = createEmptyData();
    setDurations(d, { workMinutes: 999, restMinutes: 0 });
    expect(d.settings).toMatchObject({ workMinutes: 180, restMinutes: 1 });
  });

  it('keeps the colors of a deleted active theme as the custom theme', () => {
    const d = createEmptyData();
    saveTheme(d, 'Mine', '#111111', '#22AA33', 'th');
    expect(d.settings.theme).toMatchObject({ mode: 'saved', savedId: 'th' });
    deleteTheme(d, 'th');
    expect(d.settings.themes).toEqual([]);
    expect(d.settings.theme).toMatchObject({
      mode: 'custom',
      customBg: '#111111',
      customAccent: '#22AA33',
    });
  });
});

describe('knowledge space', () => {
  // root ─ a ─ b
  //      └ c
  function tree() {
    const d = createEmptyData();
    addFolder(d, 'A', 'a', 1);
    addFolder(d, 'B', 'b', 2, 'a');
    addFolder(d, 'C', 'c', 3);
    addNote(d, 'In B', '', 'n1', 4, 'b');
    addNote(d, 'In A', '', 'n2', 5, 'a');
    return d;
  }
  const parents = (d: ReturnType<typeof tree>) =>
    Object.fromEntries(d.folders.map((f) => [f.id, f.parentId]));

  it('creates folders and notes only in existing folders, with a name', () => {
    const d = tree();
    expect(addFolder(d, '  ', 'x', 6)).toBe(false);
    expect(addFolder(d, 'X', 'x', 6, 'missing')).toBe(false);
    addNote(d, 'Lost', '', 'n3', 7, 'missing');
    expect(d.notes.find((n) => n.id === 'n3')?.folderId).toBeNull();
    expect(renameFolder(d, 'a', '  Новое  ')).toBe(true);
    expect(d.folders[0]?.name).toBe('Новое');
    expect(renameFolder(d, 'a', ' ')).toBe(false);
  });

  it('never moves a folder into itself or its subfolders', () => {
    const d = tree();
    expect(isInsideFolder(d, 'b', 'a')).toBe(true);
    expect(isInsideFolder(d, 'a', 'b')).toBe(false);
    expect(moveFolder(d, 'a', 'a')).toBe(false);
    expect(moveFolder(d, 'a', 'b')).toBe(false);
    expect(moveFolder(d, 'a', 'missing')).toBe(false);
    expect(moveFolder(d, 'a', 'c')).toBe(true);
    expect(moveFolder(d, 'b', null)).toBe(true);
    expect(parents(d)).toEqual({ a: 'c', b: null, c: null });
  });

  it('keeps the contents of a deleted folder in its parent', () => {
    const d = tree();
    deleteFolder(d, 'a');
    expect(parents(d)).toEqual({ b: null, c: null });
    expect(d.notes.map((n) => [n.id, n.folderId])).toEqual([
      ['n1', 'b'],
      ['n2', null],
    ]);
  });

  it('moves, renames and edits notes', () => {
    const d = tree();
    expect(moveNote(d, 'n1', 'c')).toBe(true);
    expect(moveNote(d, 'n1', 'missing')).toBe(false);
    expect(moveNote(d, 'n2', null)).toBe(true);
    expect(d.notes.map((n) => n.folderId)).toEqual(['c', null]);

    expect(renameNote(d, 'n1', '  ', 10)).toBe(false);
    expect(renameNote(d, 'n1', ' Renamed ', 10)).toBe(true);
    setNoteText(d, 'n1', '# Text', 11);
    expect(d.notes[0]).toMatchObject({ title: 'Renamed', text: '# Text', updatedAt: 11 });
    // The same text does not count as an edit.
    setNoteText(d, 'n1', '# Text', 12);
    expect(d.notes[0]?.updatedAt).toBe(11);
  });
});

describe('links between notes and tasks', () => {
  function data() {
    const d = createEmptyData();
    addTask(d, 'Task 1', 't1', 1);
    addTask(d, 'Task 2', 't2', 2);
    addNote(d, 'Note A', '', 'a', 3);
    addNote(d, 'Note B', '', 'b', 4);
    return d;
  }

  it('links both ways, once, and only existing items', () => {
    const d = data();
    expect(linkNoteTask(d, 'a', 't1')).toBe(true);
    expect(linkNoteTask(d, 'a', 't1')).toBe(true);
    expect(linkNoteTask(d, 'b', 't1')).toBe(true);
    expect(linkNoteTask(d, 'a', 'missing')).toBe(false);
    expect(linkNoteTask(d, 'missing', 't1')).toBe(false);
    expect(d.notes[0]?.taskIds).toEqual(['t1']);
    expect(notesOfTask(d, 't1').map((n) => n.id)).toEqual(['a', 'b']);
    expect(notesOfTask(d, 't2')).toEqual([]);
    // A link is not an edit of the note text.
    expect(d.notes[0]?.updatedAt).toBe(3);
  });

  it('unlinks without touching other links', () => {
    const d = data();
    linkNoteTask(d, 'a', 't1');
    linkNoteTask(d, 'a', 't2');
    unlinkNoteTask(d, 'a', 't1');
    expect(d.notes[0]?.taskIds).toEqual(['t2']);
    expect(notesOfTask(d, 't1')).toEqual([]);
  });
});

describe('flashcards', () => {
  const NOW = 1_000_000;
  function data() {
    const d = createEmptyData();
    addDeck(d, 'Колода', 'd1', NOW);
    addDeck(d, 'Другая', 'd2', NOW);
    addNote(d, 'Источник', '', 'n1', NOW);
    return d;
  }

  it('creates decks and cards only with valid input', () => {
    const d = data();
    expect(addDeck(d, '  ', 'x', NOW)).toBe(false);
    expect(renameDeck(d, 'd1', ' Слова ')).toBe(true);
    expect(d.decks[0]?.name).toBe('Слова');
    expect(cardProblem({ kind: 'basic', front: ' ' })).toBe('Введите вопрос');
    expect(cardProblem({ kind: 'cloze', front: 'без пропусков' })).toMatch(/пропуск/);
    expect(addCard(d, { deckId: 'missing', kind: 'basic', front: 'Q', back: '' }, 'c0', NOW)).toBe(
      false,
    );
    expect(
      addCard(
        d,
        { deckId: 'd1', kind: 'cloze', front: '{{c1::a}} {{c2::b}}', back: '', noteId: 'n1' },
        'c1',
        NOW,
      ),
    ).toBe(true);
    expect(d.cards[0]).toMatchObject({ noteId: 'n1', kind: 'cloze' });
    expect(Object.keys(d.cards[0]!.schedules)).toEqual(['1', '2']);
  });

  it('keeps progress when a card is edited and resets only what changed', () => {
    const d = data();
    addCard(d, { deckId: 'd1', kind: 'cloze', front: '{{c1::a}} {{c2::b}}', back: '' }, 'c', NOW);
    answerCard(d, 'c', '1', 3, NOW);
    const learned = d.cards[0]!.schedules['1'];
    expect(
      updateCard(
        d,
        'c',
        { deckId: 'd2', kind: 'cloze', front: '{{c1::a!}} {{c3::c}}', back: 'x' },
        NOW + 1,
      ),
    ).toBe(true);
    const card = d.cards[0]!;
    expect(card).toMatchObject({ deckId: 'd2', back: 'x', updatedAt: NOW + 1 });
    expect(Object.keys(card.schedules)).toEqual(['1', '3']);
    expect(card.schedules['1']).toEqual(learned);
    expect(card.schedules['3']?.state).toBe(0);
    // Switching the kind starts over.
    updateCard(d, 'c', { deckId: 'd2', kind: 'basic', front: 'Q', back: 'A' }, NOW + 2);
    expect(card.schedules['0']?.state).toBe(0);
    resetCard(d, 'c', NOW + 3);
    expect(card.schedules['0']?.due).toBe(NOW + 3);
  });

  it('logs answers and removes history with the card or the deck', () => {
    const d = data();
    addCard(d, { deckId: 'd1', kind: 'basic', front: 'Q', back: 'A' }, 'a', NOW);
    addCard(d, { deckId: 'd2', kind: 'basic', front: 'Q2', back: 'A2' }, 'b', NOW);
    expect(answerCard(d, 'a', '0', 3, NOW)).toBe(true);
    expect(answerCard(d, 'a', '9', 3, NOW)).toBe(false);
    answerCard(d, 'b', '0', 1, NOW);
    expect(d.reviews).toEqual([
      { cardId: 'a', slot: '0', rating: 3, state: 0, at: NOW },
      { cardId: 'b', slot: '0', rating: 1, state: 0, at: NOW },
    ]);
    deleteCard(d, 'b');
    expect(d.reviews.map((r) => r.cardId)).toEqual(['a']);
    deleteDeck(d, 'd1');
    expect(d.cards).toEqual([]);
    expect(d.reviews).toEqual([]);
    expect(d.decks.map((x) => x.id)).toEqual(['d2']);
  });

  it('keeps cards when their note is deleted', () => {
    const d = data();
    addCard(d, { deckId: 'd1', kind: 'basic', front: 'Q', back: '', noteId: 'n1' }, 'c', NOW);
    deleteNote(d, 'n1');
    expect(d.cards[0]?.noteId).toBeNull();
  });

  it('clamps the daily limit of new cards', () => {
    const d = data();
    setNewCardsPerDay(d, -3);
    expect(d.settings.newCardsPerDay).toBe(0);
    setNewCardsPerDay(d, 12.6);
    expect(d.settings.newCardsPerDay).toBe(13);
  });
});

describe('activity counters (phase 2)', () => {
  // 28 October 2026, local time.
  const day = (h: number, d = 28) => new Date(2026, 9, d, h, 0).getTime();

  it('counts created and done tasks, and takes a "done" back when the task is reopened', () => {
    const d = createEmptyData();
    addTask(d, 'A', 'a', day(9));
    addTask(d, 'B', 'b', day(9));
    moveTask(d, 'a', { status: 'doing' }, day(10));
    moveTask(d, 'a', { status: 'done' }, day(11));
    moveTask(d, 'b', { status: 'done' }, day(11));
    expect(d.tasks[0]?.doneAt).toBe(day(11));
    expect(d.activity['2026-10-28']).toMatchObject({ tasksCreated: 2, tasksDone: 2 });

    // Reopened the next day: the count goes away from the day it was made.
    moveTask(d, 'b', { status: 'todo' }, day(9, 29));
    expect(d.tasks[1]?.doneAt).toBeNull();
    expect(d.activity['2026-10-28']?.tasksDone).toBe(1);
    expect(d.activity['2026-10-29']).toBeUndefined();

    // Moving within "done" or along the other axis changes nothing.
    moveTask(d, 'a', { status: 'done' }, day(12));
    moveTask(d, 'a', { quadrant: 'q1' }, day(12));
    expect(d.activity['2026-10-28']?.tasksDone).toBe(1);
    expect(d.tasks[0]?.doneAt).toBe(day(11));
  });

  it('counts each note once per day, however many edits', () => {
    const d = createEmptyData();
    addNote(d, 'N', '', 'n', day(9));
    setNoteText(d, 'n', 'a', day(10));
    setNoteText(d, 'n', 'ab', day(11));
    renameNote(d, 'n', 'New', day(12));
    expect(d.activity['2026-10-28']?.notesEdited).toBe(1);
    setNoteText(d, 'n', 'abc', day(9, 29));
    setNoteText(d, 'n', 'abcd', day(10, 29));
    expect(d.activity['2026-10-29']?.notesEdited).toBe(1);
  });

  it('records finished work sessions of the timer', () => {
    const d = createEmptyData();
    recordPomodoro(d, 45, day(10));
    recordPomodoro(d, 25, day(11));
    expect(d.activity['2026-10-28']).toMatchObject({ pomodoroSessions: 2, pomodoroMinutes: 70 });
  });
});

describe('workspaces', () => {
  it('creates workspaces with known tabs, each once, in order', () => {
    const d = createEmptyData();
    expect(workspaceProblem({ name: ' ', tabs: ['matrix'] })).toMatch(/название/);
    expect(workspaceProblem({ name: 'Учёба', tabs: [] })).toMatch(/вкладку/);
    expect(addWorkspace(d, { name: ' Учёба ', tabs: ['cards', 'kanban', 'cards'] }, 'w')).toBe(
      true,
    );
    expect(d.settings.workspaces[1]).toEqual({ id: 'w', name: 'Учёба', tabs: ['cards', 'kanban'] });
  });

  it('edits a workspace and keeps at least one', () => {
    const d = createEmptyData();
    addWorkspace(d, { name: 'A', tabs: ['matrix'] }, 'a');
    expect(updateWorkspace(d, 'a', { name: 'B', tabs: [] })).toBe(false);
    expect(updateWorkspace(d, 'a', { name: 'B', tabs: ['pomodoro', 'matrix'] })).toBe(true);
    expect(d.settings.workspaces[1]).toMatchObject({ name: 'B', tabs: ['pomodoro', 'matrix'] });
    expect(deleteWorkspace(d, 'main')).toBe(true);
    expect(deleteWorkspace(d, 'a')).toBe(false);
    expect(d.settings.workspaces.map((w) => w.id)).toEqual(['a']);
  });
});

describe('backlog and goals (phase 2.3)', () => {
  const goal = { title: 'Диплом', description: '', deadline: '2027-06-01' };

  it('keeps backlog tasks as "todo" and takes them for today', () => {
    const d = createEmptyData();
    addTask(d, 'Later', 'b', 1, { backlog: true });
    expect(d.tasks[0]).toMatchObject({ backlog: true, status: 'todo', quadrant: 'q2' });
    takeForToday(d, 'b');
    expect(d.tasks[0]).toMatchObject({ backlog: false, status: 'todo', quadrant: 'q2' });
  });

  it('puts off a task in progress but not a done one', () => {
    const d = withTask();
    moveTask(d, 't1', { status: 'doing' }, 2);
    expect(sendToBacklog(d, 't1')).toBe(true);
    expect(d.tasks[0]).toMatchObject({ backlog: true, status: 'todo' });
    moveTask(d, 't1', { status: 'done' }, 3);
    expect(d.tasks[0]).toMatchObject({ backlog: false, status: 'done' });
    expect(sendToBacklog(d, 't1')).toBe(false);
  });

  it('validates, edits and deletes goals; tasks stay', () => {
    const d = createEmptyData();
    expect(goalProblem({ ...goal, title: ' ' })).toMatch(/название/);
    expect(goalProblem({ ...goal, deadline: '1 июня' })).toMatch(/дата/);
    expect(addGoal(d, { ...goal, title: ' Диплом ' }, 'g', 5)).toBe(true);
    expect(d.goals).toEqual([
      { id: 'g', title: 'Диплом', description: '', deadline: '2027-06-01', createdAt: 5 },
    ]);
    expect(updateGoal(d, 'g', { title: 'ВКР', description: 'текст', deadline: null })).toBe(true);
    expect(d.goals[0]).toMatchObject({ title: 'ВКР', description: 'текст', deadline: null });

    addTask(d, 'Глава 1', 'a', 6, { goalId: 'g' });
    addTask(d, 'Глава 2', 'b', 6, { backlog: true, goalId: 'missing' });
    expect(d.tasks.map((t) => t.goalId)).toEqual(['g', null]);
    deleteGoal(d, 'g');
    expect(d.goals).toEqual([]);
    expect(d.tasks.map((t) => t.goalId)).toEqual([null, null]);
  });

  it('counts goal progress over done tasks, backlog included', () => {
    const d = createEmptyData();
    addGoal(d, goal, 'g', 1);
    addTask(d, 'A', 'a', 1);
    addTask(d, 'B', 'b', 1, { backlog: true, goalId: 'g' });
    addTask(d, 'C', 'c', 1);
    setTaskGoal(d, 'a', 'g');
    setTaskGoal(d, 'c', 'nope');
    moveTask(d, 'a', { status: 'done' }, 2);
    expect(goalProgress(d, 'g')).toEqual({ done: 1, total: 2 });
    setTaskGoal(d, 'a', null);
    expect(goalProgress(d, 'g')).toEqual({ done: 0, total: 1 });
  });
});
