// Operations on AppData. Each one mutates the draft it receives; AppDataProvider passes a fresh
// clone, so callers never touch the stored state. Ids and timestamps come from the caller:
// React may run an update twice, and both runs must produce the same result.

import { cardSlots } from '../data/normalize.ts';
import { newSchedule, review } from '../data/scheduler.ts';
import {
  type AppData,
  type CardKind,
  type CardRating,
  type Quadrant,
  type Status,
  type Task,
  type ThemeSettings,
  DURATION_LIMITS,
  NEW_CARDS_LIMITS,
  REVIEW_LOG_LIMIT,
} from '../data/model.ts';
import { normalizeUrl } from '../data/url.ts';

const clampMinutes = (v: number, limits: { min: number; max: number }) =>
  Math.min(limits.max, Math.max(limits.min, Math.round(v)));

export const findTask = (d: AppData, id: string) => d.tasks.find((t) => t.id === id);

export const hasDetails = (t: Task) =>
  t.description.trim().length > 0 || t.checklist.length > 0 || t.links.length > 0;

/* ---------- Tasks ---------- */

/** F-01 / F-02 / F-08: a new task goes to q2 / todo; blank titles are rejected. */
export function addTask(d: AppData, title: string, id: string, now: number): boolean {
  const clean = title.trim();
  if (!clean) return false;
  d.tasks.push({
    id,
    title: clean,
    quadrant: 'q2',
    status: 'todo',
    createdAt: now,
    description: '',
    checklist: [],
    links: [],
  });
  return true;
}

export function renameTask(d: AppData, id: string, title: string): boolean {
  const task = findTask(d, id);
  const clean = title.trim();
  if (!task || !clean) return false;
  task.title = clean;
  return true;
}

/** F-05 / F-06: moving on one board changes only that board's axis. */
export function moveTask(d: AppData, id: string, to: { quadrant: Quadrant } | { status: Status }) {
  const task = findTask(d, id);
  if (task) Object.assign(task, to);
}

export function setDescription(d: AppData, id: string, description: string) {
  const task = findTask(d, id);
  if (task) task.description = description;
}

/** F-96: details live inside the task and go away with it. */
export function deleteTask(d: AppData, id: string) {
  d.tasks = d.tasks.filter((t) => t.id !== id);
  // Notes stay; only their link to the deleted task goes away.
  for (const note of d.notes) note.taskIds = note.taskIds.filter((t) => t !== id);
}

/* ---------- Checklist (F-81) ---------- */

export function addChecklistItem(d: AppData, taskId: string, text: string, id: string): boolean {
  const task = findTask(d, taskId);
  const clean = text.trim();
  if (!task || !clean) return false;
  task.checklist.push({ id, text: clean, done: false });
  return true;
}

export function updateChecklistItem(
  d: AppData,
  taskId: string,
  itemId: string,
  patch: { text?: string; done?: boolean },
) {
  const item = findTask(d, taskId)?.checklist.find((i) => i.id === itemId);
  if (!item) return;
  if (patch.text !== undefined && patch.text.trim()) item.text = patch.text.trim();
  if (patch.done !== undefined) item.done = patch.done;
}

export function removeChecklistItem(d: AppData, taskId: string, itemId: string) {
  const task = findTask(d, taskId);
  if (task) task.checklist = task.checklist.filter((i) => i.id !== itemId);
}

/* ---------- Links (F-82, F-89) ---------- */

export function addLink(
  d: AppData,
  taskId: string,
  url: string,
  label: string,
  id: string,
): boolean {
  const task = findTask(d, taskId);
  const normalized = normalizeUrl(url);
  if (!task || !normalized) return false;
  task.links.push({ id, url: normalized, label: label.trim() });
  return true;
}

export function updateLink(
  d: AppData,
  taskId: string,
  linkId: string,
  url: string,
  label: string,
): boolean {
  const link = findTask(d, taskId)?.links.find((l) => l.id === linkId);
  const normalized = normalizeUrl(url);
  if (!link || !normalized) return false;
  link.url = normalized;
  link.label = label.trim();
  return true;
}

export function removeLink(d: AppData, taskId: string, linkId: string) {
  const task = findTask(d, taskId);
  if (task) task.links = task.links.filter((l) => l.id !== linkId);
}

/* ---------- Notes (F-62..F-64) ---------- */

export function addNote(
  d: AppData,
  title: string,
  text: string,
  id: string,
  now: number,
  folderId: string | null = null,
): boolean {
  const clean = title.trim();
  if (!clean) return false;
  const folder = folderId !== null && findFolder(d, folderId) ? folderId : null;
  d.notes.push({
    id,
    title: clean,
    text,
    folderId: folder,
    taskIds: [],
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

export function updateNote(
  d: AppData,
  id: string,
  title: string,
  text: string,
  now: number,
): boolean {
  const note = d.notes.find((n) => n.id === id);
  const clean = title.trim();
  if (!note || !clean) return false;
  note.title = clean;
  note.text = text;
  note.updatedAt = now;
  return true;
}

/** Edits from the knowledge-space editor; an unchanged text keeps updatedAt. */
export function setNoteText(d: AppData, id: string, text: string, now: number) {
  const note = d.notes.find((n) => n.id === id);
  if (!note || note.text === text) return;
  note.text = text;
  note.updatedAt = now;
}

export function renameNote(d: AppData, id: string, title: string, now: number): boolean {
  const note = d.notes.find((n) => n.id === id);
  const clean = title.trim();
  if (!note || !clean) return false;
  if (note.title !== clean) {
    note.title = clean;
    note.updatedAt = now;
  }
  return true;
}

/** `folderId: null` moves the note to the root. */
export function moveNote(d: AppData, id: string, folderId: string | null): boolean {
  const note = d.notes.find((n) => n.id === id);
  if (!note || (folderId !== null && !findFolder(d, folderId))) return false;
  note.folderId = folderId;
  return true;
}

export function deleteNote(d: AppData, id: string) {
  d.notes = d.notes.filter((n) => n.id !== id);
  // Cards made from the note stay; they only lose the reference.
  for (const card of d.cards) if (card.noteId === id) card.noteId = null;
}

/* ---------- Links between notes and tasks (phase 1.4) ---------- */

/** The link is stored in the note (Note.taskIds); a task finds its notes through this. */
export const notesOfTask = (d: AppData, taskId: string) =>
  d.notes.filter((n) => n.taskIds.includes(taskId));

/** Linking does not count as editing the note: updatedAt stays. */
export function linkNoteTask(d: AppData, noteId: string, taskId: string): boolean {
  const note = d.notes.find((n) => n.id === noteId);
  if (!note || !findTask(d, taskId)) return false;
  if (!note.taskIds.includes(taskId)) note.taskIds.push(taskId);
  return true;
}

export function unlinkNoteTask(d: AppData, noteId: string, taskId: string) {
  const note = d.notes.find((n) => n.id === noteId);
  if (note) note.taskIds = note.taskIds.filter((id) => id !== taskId);
}

/* ---------- Folders (knowledge space, phase 1.2) ---------- */

export const findFolder = (d: AppData, id: string) => d.folders.find((f) => f.id === id);

/** True when `folderId` is `ancestorId` itself or lies somewhere inside it. */
export function isInsideFolder(d: AppData, folderId: string | null, ancestorId: string): boolean {
  // The tree is acyclic after normalization; the counter guards against a broken draft anyway.
  for (let id = folderId, steps = 0; id !== null && steps <= d.folders.length; steps++) {
    if (id === ancestorId) return true;
    id = findFolder(d, id)?.parentId ?? null;
  }
  return false;
}

export function addFolder(
  d: AppData,
  name: string,
  id: string,
  now: number,
  parentId: string | null = null,
): boolean {
  const clean = name.trim();
  if (!clean || (parentId !== null && !findFolder(d, parentId))) return false;
  d.folders.push({ id, name: clean, parentId, createdAt: now });
  return true;
}

export function renameFolder(d: AppData, id: string, name: string): boolean {
  const folder = findFolder(d, id);
  const clean = name.trim();
  if (!folder || !clean) return false;
  folder.name = clean;
  return true;
}

/** Refuses to move a folder into itself or into one of its subfolders. */
export function moveFolder(d: AppData, id: string, parentId: string | null): boolean {
  const folder = findFolder(d, id);
  if (!folder) return false;
  if (parentId !== null && (!findFolder(d, parentId) || isInsideFolder(d, parentId, id))) {
    return false;
  }
  folder.parentId = parentId;
  return true;
}

/** Nothing inside is lost: subfolders and notes move up to the parent of the deleted folder. */
export function deleteFolder(d: AppData, id: string) {
  const folder = findFolder(d, id);
  if (!folder) return;
  for (const f of d.folders) if (f.parentId === id) f.parentId = folder.parentId;
  for (const n of d.notes) if (n.folderId === id) n.folderId = folder.parentId;
  d.folders = d.folders.filter((f) => f.id !== id);
}

/* ---------- Secrets (F-65..F-67) ---------- */

export function addSecret(
  d: AppData,
  name: string,
  value: string,
  id: string,
  now: number,
): boolean {
  const clean = name.trim();
  if (!clean || !value) return false;
  d.secrets.push({ id, name: clean, value, createdAt: now });
  return true;
}

export function updateSecret(d: AppData, id: string, name: string, value: string): boolean {
  const secret = d.secrets.find((s) => s.id === id);
  const clean = name.trim();
  if (!secret || !clean || !value) return false;
  secret.name = clean;
  secret.value = value;
  return true;
}

export function deleteSecret(d: AppData, id: string) {
  d.secrets = d.secrets.filter((s) => s.id !== id);
}

/* ---------- Settings ---------- */

/** F-33 / F-34: values outside the range are clamped to it. */
export function setDurations(
  d: AppData,
  durations: { workMinutes?: number; restMinutes?: number },
) {
  if (durations.workMinutes !== undefined && Number.isFinite(durations.workMinutes)) {
    d.settings.workMinutes = clampMinutes(durations.workMinutes, DURATION_LIMITS.workMinutes);
  }
  if (durations.restMinutes !== undefined && Number.isFinite(durations.restMinutes)) {
    d.settings.restMinutes = clampMinutes(durations.restMinutes, DURATION_LIMITS.restMinutes);
  }
}

export function setTheme(d: AppData, patch: Partial<ThemeSettings>) {
  Object.assign(d.settings.theme, patch);
}

export function saveTheme(
  d: AppData,
  name: string,
  bg: string,
  accent: string,
  id: string,
): boolean {
  const clean = name.trim();
  if (!clean) return false;
  d.settings.themes.push({ id, name: clean, bg, accent });
  Object.assign(d.settings.theme, { mode: 'saved', savedId: id });
  return true;
}

/** Deleting the active saved theme keeps its colors as the custom theme, so nothing jumps. */
export function deleteTheme(d: AppData, id: string) {
  const theme = d.settings.themes.find((t) => t.id === id);
  if (!theme) return;
  d.settings.themes = d.settings.themes.filter((t) => t.id !== id);
  if (d.settings.theme.mode === 'saved' && d.settings.theme.savedId === id) {
    Object.assign(d.settings.theme, {
      mode: 'custom',
      savedId: null,
      customBg: theme.bg,
      customAccent: theme.accent,
    });
  }
}

/* ---------- Flashcards (phase 1.5) ---------- */

export const findDeck = (d: AppData, id: string) => d.decks.find((x) => x.id === id);
export const findCard = (d: AppData, id: string) => d.cards.find((c) => c.id === id);

export function addDeck(d: AppData, name: string, id: string, now: number): boolean {
  const clean = name.trim();
  if (!clean) return false;
  d.decks.push({ id, name: clean, createdAt: now });
  return true;
}

export function renameDeck(d: AppData, id: string, name: string): boolean {
  const deck = findDeck(d, id);
  const clean = name.trim();
  if (!deck || !clean) return false;
  deck.name = clean;
  return true;
}

/** The deck goes with its cards and their review history. */
export function deleteDeck(d: AppData, id: string) {
  const gone = new Set(d.cards.filter((c) => c.deckId === id).map((c) => c.id));
  d.decks = d.decks.filter((x) => x.id !== id);
  d.cards = d.cards.filter((c) => !gone.has(c.id));
  d.reviews = d.reviews.filter((r) => !gone.has(r.cardId));
}

export interface CardInput {
  deckId: string;
  kind: CardKind;
  front: string;
  back: string;
  noteId?: string | null;
}

/** Why a card cannot be saved, or null when it can. */
export function cardProblem(input: Pick<CardInput, 'kind' | 'front'>): string | null {
  if (!input.front.trim()) {
    return input.kind === 'cloze' ? 'Введите текст с пропусками' : 'Введите вопрос';
  }
  if (input.kind === 'cloze' && cardSlots('cloze', input.front).length === 0) {
    return 'Отметьте хотя бы один пропуск: {{c1::ответ}}';
  }
  return null;
}

export function addCard(d: AppData, input: CardInput, id: string, now: number): boolean {
  if (cardProblem(input) || !findDeck(d, input.deckId)) return false;
  const noteId = input.noteId && d.notes.some((n) => n.id === input.noteId) ? input.noteId : null;
  d.cards.push({
    id,
    deckId: input.deckId,
    kind: input.kind,
    front: input.front,
    back: input.back,
    noteId,
    schedules: Object.fromEntries(
      cardSlots(input.kind, input.front).map((s) => [s, newSchedule(now)]),
    ),
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

/**
 * Edits keep the progress of review items that still exist: a fixed typo does not reset the card.
 * New gaps start as new items; removed gaps and their schedules go away.
 */
export function updateCard(
  d: AppData,
  id: string,
  input: Omit<CardInput, 'noteId'>,
  now: number,
): boolean {
  const card = findCard(d, id);
  if (!card || cardProblem(input) || !findDeck(d, input.deckId)) return false;
  const schedules: typeof card.schedules = {};
  for (const slot of cardSlots(input.kind, input.front)) {
    schedules[slot] = (card.kind === input.kind && card.schedules[slot]) || newSchedule(now);
  }
  Object.assign(card, {
    deckId: input.deckId,
    kind: input.kind,
    front: input.front,
    back: input.back,
    schedules,
    updatedAt: now,
  });
  return true;
}

export function deleteCard(d: AppData, id: string) {
  d.cards = d.cards.filter((c) => c.id !== id);
  d.reviews = d.reviews.filter((r) => r.cardId !== id);
}

/** Starts the item over as a new one (for a card learned wrong). */
export function resetCard(d: AppData, id: string, now: number) {
  const card = findCard(d, id);
  if (!card) return;
  for (const slot of Object.keys(card.schedules)) card.schedules[slot] = newSchedule(now);
}

/** An answer in a study session: the FSRS schedule moves on and the answer is logged. */
export function answerCard(
  d: AppData,
  cardId: string,
  slot: string,
  rating: CardRating,
  now: number,
): boolean {
  const card = findCard(d, cardId);
  const current = card?.schedules[slot];
  if (!card || !current) return false;
  card.schedules[slot] = review(current, rating, now);
  d.reviews.push({ cardId, slot, rating, state: current.state, at: now });
  if (d.reviews.length > REVIEW_LOG_LIMIT) d.reviews.splice(0, d.reviews.length - REVIEW_LOG_LIMIT);
  return true;
}

export function setNewCardsPerDay(d: AppData, value: number) {
  if (!Number.isFinite(value)) return;
  d.settings.newCardsPerDay = Math.min(
    NEW_CARDS_LIMITS.max,
    Math.max(NEW_CARDS_LIMITS.min, Math.round(value)),
  );
}
