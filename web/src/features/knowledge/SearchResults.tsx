// Search results in the sidebar. Loaded lazily together with MiniSearch.

import { useEffect, useMemo, useState } from 'react';
import type { Note } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { Icon } from '../../ui/Icon.tsx';
import { NoteIndex } from './fulltext.ts';
import { REGEX_TIMEOUT_MS, type RegexRequest, type RegexResult } from './regex.ts';
import { runRegexSearch } from './regexRunner.ts';
import { type Hit, type Range, markParts, snippets } from './snippets.ts';
import { folderOptions } from './tree.ts';

export type OpenMatch = (noteId: string, range: Range | null) => void;

function Marked({ text, ranges }: { text: string; ranges: Range[] }) {
  return markParts(text, ranges).map((p, i) =>
    p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
  );
}

function HitList({ hits, onOpen }: { hits: Hit[]; onOpen: OpenMatch }) {
  const { data } = useAppData();
  const notes = new Map<string, Note>(data.notes.map((n) => [n.id, n]));
  const paths = new Map(folderOptions(data).map((f) => [f.id, f.label]));

  return (
    <ul className="results">
      {hits.map((hit) => {
        const note = notes.get(hit.noteId);
        if (!note) return null;
        const path = note.folderId ? paths.get(note.folderId) : null;
        const shown = snippets(note.text, hit.textRanges);
        return (
          <li key={hit.noteId} className="result">
            <button
              type="button"
              className="result-title"
              onClick={() => onOpen(note.id, hit.textRanges[0] ?? null)}
            >
              <Icon name="note" />
              <span className="tree-name">
                <Marked text={note.title} ranges={hit.titleRanges} />
              </span>
              {hit.textRanges.length > 0 && <span className="count">{hit.textRanges.length}</span>}
            </button>
            {path && <div className="result-path">{path}</div>}
            {shown.map((s) => (
              <button
                key={s.range.from}
                type="button"
                className="result-snippet"
                onClick={() => onOpen(note.id, s.range)}
              >
                {s.parts.map((p, i) =>
                  p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
                )}
              </button>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`search-status${error ? ' error' : ''}`} role="status">
      {children}
    </div>
  );
}

const found = (n: number) => (n === 0 ? 'Ничего не найдено' : `Найдено заметок: ${n}`);

function FullText({ query, onOpen }: { query: string; onOpen: OpenMatch }) {
  const { data } = useAppData();
  const index = useMemo(() => new NoteIndex(), []);
  const hits = useMemo(() => {
    index.sync(data.notes);
    return index.find(query);
  }, [index, data.notes, query]);
  return (
    <>
      <Status>{found(hits.length)}</Status>
      <HitList hits={hits} onOpen={onOpen} />
    </>
  );
}

function RegexSearch({
  query,
  caseSensitive,
  onOpen,
}: {
  query: string;
  caseSensitive: boolean;
  onOpen: OpenMatch;
}) {
  const { data } = useAppData();
  const request = useMemo<RegexRequest>(
    () => ({
      pattern: query,
      caseSensitive,
      docs: data.notes.map(({ id, title, text }) => ({ id, title, text })),
    }),
    [query, caseSensitive, data.notes],
  );
  const [answer, setAnswer] = useState<{ request: RegexRequest; result: RegexResult } | null>(null);

  useEffect(() => {
    let search: { cancel(): void } | null = null;
    // A short pause while typing: one worker per pause, not per key.
    const timer = setTimeout(() => {
      const running = runRegexSearch(request);
      search = running;
      void running.result.then((result) => setAnswer({ request, result }));
    }, 150);
    return () => {
      clearTimeout(timer);
      search?.cancel();
    };
  }, [request]);

  const pending = answer?.request !== request;
  const result = answer?.result;
  return (
    <>
      {!result && <Status>Поиск…</Status>}
      {result?.kind === 'invalid' && (
        <Status error>Неверное регулярное выражение: {result.message}</Status>
      )}
      {result?.kind === 'timeout' && (
        <Status error>
          Выражение выполнялось дольше {REGEX_TIMEOUT_MS / 1000} с, поиск остановлен. Упростите его.
        </Status>
      )}
      {result?.kind === 'ok' && (
        <>
          <Status>
            {found(result.hits.length)}
            {result.truncated && ' (показаны первые совпадения)'}
            {pending && ' · обновляется…'}
          </Status>
          <HitList hits={result.hits} onOpen={onOpen} />
        </>
      )}
    </>
  );
}

export default function SearchResults({
  query,
  regex,
  caseSensitive,
  onOpen,
}: {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  onOpen: OpenMatch;
}) {
  return (
    <div className="results-box" role="region" aria-label="Результаты поиска">
      {regex ? (
        <RegexSearch query={query} caseSensitive={caseSensitive} onOpen={onOpen} />
      ) : (
        <FullText query={query} onOpen={onOpen} />
      )}
    </div>
  );
}
