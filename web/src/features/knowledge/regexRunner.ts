// Runs a RegEx search in a Web Worker and stops it after a time limit, so that a pattern with
// catastrophic backtracking, like (a+)+$, cannot freeze the interface.
// Kept apart from regex.ts: the worker imports regex.ts and must not create workers itself.

import { REGEX_TIMEOUT_MS, type RegexRequest, type RegexResult, searchRegex } from './regex.ts';

export interface RegexSearch {
  result: Promise<RegexResult>;
  /** Stops the search; the promise then never resolves. */
  cancel(): void;
}

export type WorkerFactory = () => Worker | null;

function defaultWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Searches in a fresh worker and stops it after `timeoutMs`. Without Worker support (tests in
 * jsdom) the search runs right here: there is no way to interrupt it then.
 */
export function runRegexSearch(
  request: RegexRequest,
  { timeoutMs = REGEX_TIMEOUT_MS, createWorker = defaultWorker } = {},
): RegexSearch {
  const worker = createWorker();
  if (!worker) {
    let cancelled = false;
    return {
      result: new Promise((resolve) => {
        queueMicrotask(() => {
          if (!cancelled) resolve(searchRegex(request));
        });
      }),
      cancel: () => {
        cancelled = true;
      },
    };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    worker.terminate();
  };
  const result = new Promise<RegexResult>((resolve) => {
    timer = setTimeout(() => {
      stop();
      resolve({ kind: 'timeout' });
    }, timeoutMs);
    worker.onmessage = (e: MessageEvent<RegexResult>) => {
      stop();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      stop();
      resolve({ kind: 'invalid', message: e.message || 'Ошибка поиска' });
    };
    worker.postMessage(request);
  });
  return { result, cancel: stop };
}
