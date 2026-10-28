// Markdown → HTML for note previews. Loaded lazily together with KaTeX (see NotePreview.tsx).
//
// Safety: raw HTML in notes is not rendered (html: false), markdown-it drops javascript: and
// similar links, and KaTeX runs without `trust`. Images are not loaded: they would reach the
// internet without an explicit action of the user (spec N-05), so they are shown as links.

import MarkdownIt from 'markdown-it';
import { type ClozeEnv, clozePlugin } from './clozeRender.ts';
import { mathPlugin } from './math.ts';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
  .use(mathPlugin)
  .use(clozePlugin);

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  const src = token.attrGet('src') ?? '';
  const alt = self.renderInlineAsText(token.children ?? [], options, env);
  const label = alt ? `Изображение: ${alt}` : 'Изображение';
  return `<a class="md-image" href="${md.utils.escapeHtml(src)}">${md.utils.escapeHtml(label)}</a>`;
};

/** `env.cloze` shows a flashcard: which gap is asked and whether the answer is revealed. */
export function renderMarkdown(text: string, env: ClozeEnv = {}): string {
  // markdown-it may write to env; a copy keeps the caller's object untouched.
  return md.render(text, { ...env });
}
