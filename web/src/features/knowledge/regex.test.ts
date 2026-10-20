import { describe, expect, it, vi } from 'vitest';
import { REGEX_LIMITS, type RegexRequest, searchRegex } from './regex.ts';
import { runRegexSearch } from './regexRunner.ts';

const docs = [
  { id: 'a', title: 'Почта', text: 'ivan@example.com\nAnna@Test.org' },
  { id: 'b', title: 'Пусто', text: 'ничего' },
];

describe('RegEx search', () => {
  it('finds matches in titles and text, case-insensitive by default', () => {
    const result = searchRegex({ pattern: '\\w+@\\w+\\.(com|org)', caseSensitive: false, docs });
    expect(result).toEqual({
      kind: 'ok',
      truncated: false,
      hits: [
        {
          noteId: 'a',
          titleRanges: [],
          textRanges: [
            { from: 0, to: 16 },
            { from: 17, to: 30 },
          ],
        },
      ],
    });
    expect(searchRegex({ pattern: '^anna', caseSensitive: true, docs })).toMatchObject({
      kind: 'ok',
      hits: [],
    });
  });

  it('treats ^ and $ per line and supports Unicode classes', () => {
    const result = searchRegex({ pattern: '^\\p{Lu}\\w+', caseSensitive: true, docs });
    expect(result.kind === 'ok' && result.hits[0]?.textRanges).toEqual([{ from: 17, to: 21 }]);
    const titles = searchRegex({ pattern: '^П\\p{L}+$', caseSensitive: true, docs });
    expect(titles.kind === 'ok' && titles.hits.map((h) => h.noteId)).toEqual(['a', 'b']);
  });

  it('reports invalid patterns instead of throwing', () => {
    expect(searchRegex({ pattern: '(', caseSensitive: false, docs })).toMatchObject({
      kind: 'invalid',
    });
  });

  it('skips empty matches and stops at the limits', () => {
    expect(searchRegex({ pattern: 'q*', caseSensitive: false, docs })).toMatchObject({
      kind: 'ok',
      hits: [],
    });
    const big = [{ id: 'big', title: '', text: 'a'.repeat(REGEX_LIMITS.perField * 2) }];
    const result = searchRegex({ pattern: 'a', caseSensitive: false, docs: big });
    expect(result.kind === 'ok' && result.hits[0]?.textRanges).toHaveLength(REGEX_LIMITS.perField);

    const many = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      title: '',
      text: 'a'.repeat(REGEX_LIMITS.perField),
    }));
    expect(searchRegex({ pattern: 'a', caseSensitive: false, docs: many })).toMatchObject({
      kind: 'ok',
      truncated: true,
    });
  });
});

/** Stands in for a Web Worker; `answer` decides whether the "worker" ever replies. */
function fakeWorker(answer: 'reply' | 'hang') {
  const worker = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null,
    terminate: vi.fn(),
    postMessage(request: RegexRequest) {
      if (answer === 'reply') {
        queueMicrotask(() => worker.onmessage?.({ data: searchRegex(request) } as MessageEvent));
      }
    },
  };
  return worker;
}

describe('running RegEx search in a worker', () => {
  const request = { pattern: 'ivan', caseSensitive: false, docs };

  it('returns the worker answer and stops the worker', async () => {
    const worker = fakeWorker('reply');
    const search = runRegexSearch(request, { createWorker: () => worker as unknown as Worker });
    await expect(search.result).resolves.toMatchObject({ kind: 'ok', hits: [{ noteId: 'a' }] });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('stops a worker that takes too long', async () => {
    vi.useFakeTimers();
    try {
      const worker = fakeWorker('hang');
      const search = runRegexSearch(request, {
        timeoutMs: 1000,
        createWorker: () => worker as unknown as Worker,
      });
      vi.advanceTimersByTime(1000);
      await expect(search.result).resolves.toEqual({ kind: 'timeout' });
      expect(worker.terminate).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs in place where workers are not available', async () => {
    const search = runRegexSearch(request, { createWorker: () => null });
    await expect(search.result).resolves.toMatchObject({ kind: 'ok' });
  });
});
