// Rendered note. Loaded lazily together with markdown-it and KaTeX (fonts included, works offline).

import 'katex/dist/katex.min.css';
import { useDeferredValue, useMemo } from 'react';
import { normalizeUrl } from '../../data/url.ts';
import { usePlatform } from '../../state/hooks.ts';
import { renderMarkdown } from './markdown.ts';

export default function NotePreview({ text }: { text: string }) {
  const platform = usePlatform();
  // Typing stays responsive in a long note: the preview catches up when there is time.
  const deferred = useDeferredValue(text);
  const html = useMemo(() => renderMarkdown(deferred), [deferred]);

  if (!deferred.trim()) return <div className="md md-empty">Пустая заметка</div>;

  return (
    <div
      className="md"
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
