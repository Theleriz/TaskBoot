// Match ranges and short text fragments around them, shared by full-text and RegEx search.

/** A match in a string: [from, to). */
export interface Range {
  from: number;
  to: number;
}

export interface Hit {
  noteId: string;
  titleRanges: Range[];
  textRanges: Range[];
}

export interface Part {
  text: string;
  mark: boolean;
}

export interface Snippet {
  /** The match the fragment is built around: where the editor jumps to. */
  range: Range;
  parts: Part[];
}

/** Sorted, without overlaps. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}

/** Splits `text` into plain and marked parts. */
export function markParts(text: string, ranges: Range[]): Part[] {
  const parts: Part[] = [];
  let pos = 0;
  for (const r of mergeRanges(ranges)) {
    const from = Math.max(r.from, pos);
    const to = Math.min(r.to, text.length);
    if (from >= to) continue;
    if (from > pos) parts.push({ text: text.slice(pos, from), mark: false });
    parts.push({ text: text.slice(from, to), mark: true });
    pos = to;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), mark: false });
  return parts;
}

/**
 * Up to `max` one-line fragments around the matches, `radius` characters on each side.
 * Matches close to each other share a fragment.
 */
export function snippets(text: string, ranges: Range[], max = 3, radius = 40): Snippet[] {
  const merged = mergeRanges(ranges);
  const out: Snippet[] = [];
  let i = 0;
  while (i < merged.length && out.length < max) {
    const first = merged[i]!;
    const lineStart = text.lastIndexOf('\n', first.from - 1) + 1;
    const lineEndAt = text.indexOf('\n', first.to);
    const lineEnd = lineEndAt === -1 ? text.length : lineEndAt;
    const from = Math.max(lineStart, first.from - radius);
    let to = Math.min(lineEnd, first.to + radius);
    const inside: Range[] = [];
    while (i < merged.length && merged[i]!.from < to) {
      inside.push(merged[i]!);
      to = Math.min(lineEnd, Math.max(to, merged[i]!.to));
      i++;
    }
    const local = inside.map((r) => ({ from: r.from - from, to: Math.min(r.to, to) - from }));
    const parts = markParts(text.slice(from, to), local);
    if (from > lineStart) parts.unshift({ text: '…', mark: false });
    if (to < lineEnd) parts.push({ text: '…', mark: false });
    out.push({ range: first, parts });
  }
  return out;
}
