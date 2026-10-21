// One search per worker: the page creates a worker, sends one request and terminates the worker
// when the answer comes or the time limit runs out (regexRunner.ts).

import { type RegexRequest, searchRegex } from './regex.ts';

// The project is typed for the page (DOM lib); in a worker `self` is the worker scope.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<RegexRequest>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = (e) => {
  scope.postMessage(searchRegex(e.data));
};
