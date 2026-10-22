// Starting texts for a card made from a note, from the selection in the editor.

import type { AppData, CardKind } from '../../data/model.ts';
import { type CardDraft, NEW_DECK } from './drafts.ts';

export interface Selection {
  from: number;
  to: number;
}

/** The paragraph (text between blank lines) around a range. */
function paragraphAround(text: string, from: number, to: number) {
  const before = text.lastIndexOf('\n\n', Math.max(0, from - 1));
  const after = text.indexOf('\n\n', to);
  return { start: before === -1 ? 0 : before + 2, end: after === -1 ? text.length : after };
}

/**
 * basic — the selection becomes the question;
 * cloze — the paragraph with the selection as gap 1 (the usual way to learn from notes).
 */
export function presetsFromSelection(
  text: string,
  selection: Selection | null,
): Record<CardKind, { front: string; back: string }> {
  const from = Math.min(selection?.from ?? 0, text.length);
  const to = Math.min(selection?.to ?? 0, text.length);
  const picked = text.slice(from, to);
  if (!picked.trim()) {
    return { basic: { front: '', back: '' }, cloze: { front: '', back: '' } };
  }
  const { start, end } = paragraphAround(text, from, to);
  const cloze = `${text.slice(start, from)}{{c1::${picked.trim()}}}${text.slice(to, end)}`;
  return {
    basic: { front: picked.trim(), back: '' },
    cloze: { front: cloze.trim(), back: '' },
  };
}

/** The deck a new card from this note most likely belongs to. */
export function suggestDeck(d: AppData, noteId: string): string {
  const fromNote = d.cards.filter((c) => c.noteId === noteId);
  const pool = fromNote.length ? fromNote : d.cards;
  const latest = pool.reduce<(typeof pool)[number] | null>(
    (best, c) => (!best || c.createdAt > best.createdAt ? c : best),
    null,
  );
  if (latest && d.decks.some((x) => x.id === latest.deckId)) return latest.deckId;
  return d.decks[0]?.id ?? NEW_DECK;
}

export function draftFromNote(
  d: AppData,
  noteId: string,
  text: string,
  selection: Selection | null,
): { draft: CardDraft; presets: Record<CardKind, { front: string; back: string }> } {
  const presets = presetsFromSelection(text, selection);
  const kind: CardKind = presets.cloze.front ? 'cloze' : 'basic';
  return {
    presets,
    draft: { kind, ...presets[kind], deckId: suggestDeck(d, noteId), newDeck: 'Заметки' },
  };
}
