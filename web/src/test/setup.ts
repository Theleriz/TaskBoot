import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout. CodeMirror measures text ranges; empty rectangles are enough for tests.
if (typeof Range !== 'undefined' && !('getClientRects' in Range.prototype)) {
  const empty = () => new DOMRect(0, 0, 0, 0);
  Object.assign(Range.prototype, {
    getClientRects: () => Object.assign([], { item: () => null }),
    getBoundingClientRect: empty,
  });
}

afterEach(() => {
  cleanup();
});
