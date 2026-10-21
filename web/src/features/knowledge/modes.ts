export const NOTE_MODES = [
  { mode: 'edit', title: 'Редактор' },
  { mode: 'split', title: 'Рядом' },
  { mode: 'preview', title: 'Просмотр' },
] as const;

export type NoteMode = (typeof NOTE_MODES)[number]['mode'];

export const isNoteMode = (v: unknown): v is NoteMode => NOTE_MODES.some((m) => m.mode === v);
