// Rendered note. Loaded lazily together with markdown-it and KaTeX (fonts included, works offline).

import 'katex/dist/katex.min.css';
import { useDeferredValue, useMemo } from 'react';
import { normalizeUrl } from '../../data/url.ts';
import { usePlatform } from '../../state/hooks.ts';
import type { ClozeEnv } from './clozeRender.ts';
import { renderMarkdown } from './markdown.ts';

/** Also renders flashcards: `cloze` says which gap is asked and whether it is revealed. */
export default function NotePreview({
  text,
  cloze,
  empty = 'Пустая заметка',
  className = '',
}: {
  text: string;
  cloze?: ClozeEnv['cloze'];
  empty?: string;
  className?: string;
}) {
  const platform = usePlatform();
  // Typing stays responsive in a long note: the preview catches up when there is time.
  const deferred = useDeferredValue(text);
  const slot = cloze?.slot;
  const reveal = cloze?.reveal;
  const html = useMemo(
    () =>
      renderMarkdown(
        deferred,
        slot === undefined ? {} : { cloze: { slot, reveal: reveal ?? false } },
      ),
    [deferred, slot, reveal],
  );

  if (!deferred.trim()) return <div className={`md md-empty ${className}`}>{empty}</div>;

  return (
    <div
      className={`md ${className}`}
      // Links leave the app: the system browser opens them (in the shell, via the bridge).
      onClick={(e) => {
        const link = (e.target as Element).closest('a');
        if (!link) return;
        e.preventDefault();
        // Only full web addresses: a relative link like "notes.md" must not become a website.
        const href = link.getAttribute('href') ?? '';
        const url = /^https?:\/\//i.test(href) ? normalizeUrl(href) : null;
        if (url) platform.openExternal(url);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
