// Operations on AppData. Each one mutates the draft it receives; AppDataProvider passes a fresh
// clone, so callers never touch the stored state. Ids and timestamps come from the caller:
// React may run an update twice, and both runs must produce the same result.

import {
  type AppData,
  type Quadrant,
  type Status,
  type Task,
  type ThemeSettings,
  DURATION_LIMITS,
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
  d.notes.push({ id, title: clean, text, folderId, taskIds: [], createdAt: now, updatedAt: now });
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

export function deleteNote(d: AppData, id: string) {
  d.notes = d.notes.filter((n) => n.id !== id);
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
