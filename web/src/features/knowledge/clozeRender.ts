// markdown-it plugin for cloze gaps {{c1::answer::hint}} (syntax: data/cloze.ts).
// What a gap shows depends on the render env:
//   no `cloze` in env (note preview)     — the answer, lightly marked;
//   the gap being asked, not revealed    — a blank "[…]" or "[hint]";
//   the gap being asked, revealed        — the answer, highlighted;
//   other gaps of the same card          — their answers, as plain context.
// The answer is parsed as Markdown itself, so formulas and emphasis work inside a gap.

import type MarkdownIt from 'markdown-it';
import type { StateInline } from 'markdown-it';

export interface ClozeEnv {
  cloze?: { slot: string; reveal: boolean };
}

const GAP = /\{\{c(\d{1,3})::([\s\S]*?)(?:::([\s\S]*?))?\}\}/y;

function clozeRule(state: StateInline, silent: boolean): boolean {
  const { src, pos, posMax } = state;
  if (!src.startsWith('{{c', pos)) return false;
  GAP.lastIndex = pos;
  const m = GAP.exec(src);
  if (!m || pos + m[0].length > posMax) return false;

  if (!silent) {
    const [, number, answer = '', hint] = m;
    const asked = (state.env as ClozeEnv).cloze;
    const active = asked?.slot === String(Number(number));
    if (active && !asked.reveal) {
      state.push('cloze_blank', 'span', 0).content = hint ?? '';
    } else {
      const open = state.push('cloze_open', 'span', 1);
      open.attrSet('class', active ? 'cloze cloze-answer' : 'cloze');
      state.md.inline.parse(answer, state.md, state.env, state.tokens);
      state.push('cloze_close', 'span', -1);
    }
  }
  state.pos = pos + m[0].length;
  return true;
}

export function clozePlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'cloze', clozeRule);
  md.renderer.rules.cloze_blank = (tokens, idx) => {
    const hint = tokens[idx]!.content;
    return `<span class="cloze-blank">[${hint ? md.utils.escapeHtml(hint) : '…'}]</span>`;
  };
}
