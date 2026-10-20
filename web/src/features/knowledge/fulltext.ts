// Full-text search over notes with MiniSearch. Loaded lazily with the search results.
//
// Russian has no stemmer here; prefix search and small typos (fuzzy) cover most word forms:
// "задач" finds "задачи", "задачи" finds "задача". "ё" and "е" are the same letter for search.

import MiniSearch from 'minisearch';
import type { Note } from '../../data/model.ts';
import { type Hit, type Range, mergeRanges } from './snippets.ts';

export const normalizeTerm = (term: string) => term.toLowerCase().replaceAll('ё', 'е');

type Doc = Pick<Note, 'id' | 'title' | 'text'>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where the matched index terms start words in `text`. Same length after normalization. */
export function termRanges(text: string, terms: readonly string[]): Range[] {
  if (terms.length === 0) return [];
  const normalized = normalizeTerm(text);
  const ranges: Range[] = [];
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}`, 'gu');
    for (const m of normalized.matchAll(re))
      ranges.push({ from: m.index, to: m.index + term.length });
  }
  return mergeRanges(ranges);
}

const versionOf = (n: Doc & { updatedAt?: number }) =>
  `${n.updatedAt ?? 0}:${n.title.length}:${n.text.length}:${n.title}`;

/** An index kept in step with the notes: only changed notes are re-indexed. */
export class NoteIndex {
  private readonly search = new MiniSearch<Doc>({
    fields: ['title', 'text'],
    processTerm: normalizeTerm,
    searchOptions: {
      boost: { title: 2 },
      prefix: true,
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  private readonly versions = new Map<string, string>();
  private docs = new Map<string, Doc>();

  sync(notes: readonly (Doc & { updatedAt?: number })[]): void {
    const next = new Map(notes.map((n) => [n.id, n]));
    for (const id of this.versions.keys()) {
      if (!next.has(id)) {
        this.search.discard(id);
        this.versions.delete(id);
      }
    }
    for (const note of notes) {
      const version = versionOf(note);
      const known = this.versions.get(note.id);
      if (known === version) continue;
      const doc = { id: note.id, title: note.title, text: note.text };
      if (known === undefined) this.search.add(doc);
      else this.search.replace(doc);
      this.versions.set(note.id, version);
    }
    this.docs = next;
  }

  /** Best matches first. */
  find(query: string, limit = 50): Hit[] {
    if (!query.trim()) return [];
    return this.search
      .search(query)
      .slice(0, limit)
      .flatMap((r) => {
        const doc = this.docs.get(r.id as string);
        if (!doc) return [];
        return [
          {
            noteId: doc.id,
            titleRanges: termRanges(doc.title, r.terms),
            textRanges: termRanges(doc.text, r.terms),
          },
        ];
      });
  }
}
