// markdown-it plugin for KaTeX formulas: `$…$` inline, `$$…$$` display (inline or as a block).
// Written here instead of a library: the available plugins pin older KaTeX versions (D-05).
//
// Rules for `$…$`, as in Pandoc, so that prices like "$5 and $10" stay text:
// no space right after the opening `$`, no space right before the closing one,
// and no digit right after the closing one. `\$` is a literal dollar sign.

import katex from 'katex';
import type MarkdownIt from 'markdown-it';
import type { StateBlock, StateInline } from 'markdown-it';

const DOLLAR = 0x24;
const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9';

function isEscaped(src: string, pos: number, from: number): boolean {
  let backslashes = 0;
  for (let i = pos - 1; i >= from && src[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const { src, pos: start, posMax } = state;
  if (src.charCodeAt(start) !== DOLLAR) return false;
  const display = src.charCodeAt(start + 1) === DOLLAR;
  const marker = display ? '$$' : '$';
  const first = start + marker.length;
  if (first >= posMax || (!display && isSpace(src[first]))) return false;

  let end = first;
  for (;;) {
    end = src.indexOf(marker, end);
    if (end === -1 || end >= posMax) return false;
    const valid =
      !isEscaped(src, end, first) &&
      (display || (!isSpace(src[end - 1]) && !isDigit(src[end + 1])));
    if (valid) break;
    end += 1;
  }
  if (end === first) return false;

  if (!silent) {
    const token = state.push(display ? 'math_display' : 'math_inline', 'math', 0);
    token.content = src.slice(first, end);
    token.markup = marker;
  }
  state.pos = end + marker.length;
  return true;
}

/**
 * A block starts with `$$` at the beginning of a line and ends at the line that ends with `$$`.
 * A blank line before the closing `$$` means it is not a formula (TeX does not allow blank lines
 * there either), so an unfinished `$$` never swallows the rest of the note.
 */
function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) =>
    state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]);
  // Indented by 4+ spaces: a code block, not a formula.
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const opening = lineText(startLine);
  if (!opening.startsWith('$$')) return false;

  const firstRest = opening.slice(2);
  let content: string;
  let last = startLine;
  if (firstRest.trimEnd().endsWith('$$') && firstRest.trim().length >= 2) {
    content = firstRest.trimEnd().slice(0, -2);
  } else {
    const lines = firstRest.trim() ? [firstRest] : [];
    for (;;) {
      last += 1;
      if (last >= endLine) return false;
      const text = lineText(last);
      if (!text.trim()) return false;
      const trimmed = text.trimEnd();
      if (trimmed.endsWith('$$')) {
        const rest = trimmed.slice(0, -2);
        if (rest.trim()) lines.push(rest);
        break;
      }
      lines.push(text);
    }
    content = lines.join('\n');
  }
  if (!content.trim()) return false;
  if (silent) return true;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.markup = '$$';
  token.map = [startLine, last + 1];
  state.line = last + 1;
  return true;
}

function render(tex: string, displayMode: boolean, escapeHtml: (s: string) => string): string {
  try {
    // throwOnError: false shows TeX errors in place (in red) instead of throwing;
    // trust: false (the default) keeps \href, \url and other commands that could run links.
    return katex.renderToString(tex, { displayMode, throwOnError: false, strict: 'ignore' });
  } catch {
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
}

export function mathPlugin(md: MarkdownIt): void {
  const escape = md.utils.escapeHtml;
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.math_inline = (tokens, idx) => render(tokens[idx]!.content, false, escape);
  md.renderer.rules.math_display = (tokens, idx) => render(tokens[idx]!.content, true, escape);
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="math-block">${render(tokens[idx]!.content, true, escape)}</div>\n`;
}
