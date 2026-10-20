import { describe, expect, it } from 'vitest';
import { markParts, mergeRanges, snippets } from './snippets.ts';

const render = (parts: { text: string; mark: boolean }[]) =>
  parts.map((p) => (p.mark ? `[${p.text}]` : p.text)).join('');

describe('snippets', () => {
  it('merges overlapping ranges', () => {
    expect(
      mergeRanges([
        { from: 5, to: 8 },
        { from: 0, to: 2 },
        { from: 7, to: 10 },
      ]),
    ).toEqual([
      { from: 0, to: 2 },
      { from: 5, to: 10 },
    ]);
  });

  it('marks parts of a string', () => {
    expect(render(markParts('один два три', [{ from: 5, to: 8 }]))).toBe('один [два] три');
  });

  it('cuts one-line fragments around matches', () => {
    const text = `${'x'.repeat(60)} цель ${'y'.repeat(60)}\nвторая строка с целью`;
    const second = text.indexOf('целью');
    const [a, b] = snippets(text, [
      { from: 61, to: 65 },
      { from: second, to: second + 4 },
    ]);
    expect(render(a!.parts)).toBe(`…${'x'.repeat(39)} [цель] ${'y'.repeat(39)}…`);
    expect(render(b!.parts)).toBe('вторая строка с [цель]ю');
    expect(b!.range.from).toBe(second);
  });

  it('keeps close matches in one fragment and limits the count', () => {
    const ranges = [0, 3, 6, 9].map((from) => ({ from, to: from + 2 }));
    const result = snippets('аб аб аб аб', ranges, 3);
    expect(result).toHaveLength(1);
    expect(render(result[0]!.parts)).toBe('[аб] [аб] [аб] [аб]');
    const far = [0, 200, 400, 600].map((from) => ({ from, to: from + 1 }));
    expect(snippets('z'.repeat(700), far, 3)).toHaveLength(3);
  });
});
