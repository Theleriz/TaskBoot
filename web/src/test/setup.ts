import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout. CodeMirror measures text ranges; empty rectangles are enough for tests.
if (typeof Range !== 'undefined' && !('getClientRects' in Range.prototype)) {
  const empty = () => new DOMRect(0, 0, 0, 0);
  Object.assign(Range.prototype, {
    getClientRects: () => Object.assign([], { item: () => null }),
    getBoundingClientRect: empty,
  });
}

// findBy… and waitFor wait for lazy parts of the app; 1 s is too little under a full parallel run.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
