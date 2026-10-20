// RegEx search over notes. In the app it runs inside a Web Worker (regex.worker.ts, started by
// regexRunner.ts); the functions here are plain and synchronous.

import type { Hit, Range } from './snippets.ts';

export interface RegexDoc {
  id: string;
  title: string;
  text: string;
}

export interface RegexRequest {
  pattern: string;
  caseSensitive: boolean;
  docs: RegexDoc[];
}

export type RegexResult =
  | { kind: 'ok'; hits: Hit[]; truncated: boolean }
  | { kind: 'invalid'; message: string }
  | { kind: 'timeout' };

/** Limits keep the answer small even for a pattern like "." over a large knowledge base. */
export const REGEX_LIMITS = { perField: 200, total: 5000 } as const;
export const REGEX_TIMEOUT_MS = 1000;

/** `m`: ^ and $ work per line, which suits notes; `u`: proper Unicode and \p{…} classes. */
export function compileRegex(pattern: string, caseSensitive: boolean): RegExp | string {
  try {
    return new RegExp(pattern, `gmu${caseSensitive ? '' : 'i'}`);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function matchRanges(re: RegExp, text: string, budget: { left: number }): Range[] {
  const ranges: Range[] = [];
  re.lastIndex = 0;
  while (ranges.length < REGEX_LIMITS.perField && budget.left > 0) {
    const m = re.exec(text);
    if (!m) break;
    if (m[0].length === 0) {
      // An empty match (like ^ or a*): step over it, there is nothing to highlight.
      re.lastIndex = m.index + 1;
      if (re.lastIndex > text.length) break;
      continue;
    }
    ranges.push({ from: m.index, to: m.index + m[0].length });
    budget.left -= 1;
  }
  return ranges;
}

/** Runs synchronously: call it inside the worker (or in tests). */
export function searchRegex(request: RegexRequest): RegexResult {
  if (!request.pattern) return { kind: 'ok', hits: [], truncated: false };
  const re = compileRegex(request.pattern, request.caseSensitive);
  if (typeof re === 'string') return { kind: 'invalid', message: re };
  const budget = { left: REGEX_LIMITS.total };
  const hits: Hit[] = [];
  for (const doc of request.docs) {
    const titleRanges = matchRanges(re, doc.title, budget);
    const textRanges = matchRanges(re, doc.text, budget);
    if (titleRanges.length || textRanges.length) {
      hits.push({ noteId: doc.id, titleRanges, textRanges });
    }
    if (budget.left <= 0) break;
  }
  return { kind: 'ok', hits, truncated: budget.left <= 0 };
}
