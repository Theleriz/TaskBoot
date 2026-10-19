import { newId } from '../data/ids.ts';
import { isRecord } from '../data/normalize.ts';
import type {
  BridgeEvent,
  BridgeEvents,
  BridgeMethod,
  BridgeMethods,
  RequestMessage,
} from './protocol.ts';

/** How messages travel. The WebView2 transport is in webview.ts; tests use a fake one. */
export interface Transport {
  send(message: RequestMessage): void;
  /** Subscribes to incoming messages; returns an unsubscribe function. */
  listen(handler: (message: unknown) => void): () => void;
}

export class BridgeError extends Error {
  override name = 'BridgeError';
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface BridgeClient {
  request<M extends BridgeMethod>(
    method: M,
    payload: BridgeMethods[M]['payload'],
  ): Promise<BridgeMethods[M]['result']>;
  on<E extends BridgeEvent>(event: E, handler: (payload: BridgeEvents[E]) => void): () => void;
  dispose(): void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createBridgeClient(
  transport: Transport,
  options: { timeoutMs?: number } = {},
): BridgeClient {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pending = new Map<string, Pending>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const unlisten = transport.listen((message) => {
    if (!isRecord(message)) return;

    if (message.kind === 'response' && typeof message.id === 'string') {
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.ok === true) {
        call.resolve(message.result ?? null);
      } else {
        const err = isRecord(message.error) ? message.error : {};
        call.reject(
          new BridgeError(
            typeof err.code === 'string' ? err.code : 'host_error',
            typeof err.message === 'string' ? err.message : 'The shell reported an error.',
          ),
        );
      }
      return;
    }

    if (message.kind === 'event' && typeof message.event === 'string') {
      listeners.get(message.event)?.forEach((handler) => handler(message.payload ?? null));
    }
  });

  return {
    request(method, payload) {
      const id = newId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new BridgeError('timeout', `The shell did not answer "${method}" in time.`));
        }, timeoutMs);
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
        try {
          transport.send({ kind: 'request', id, method, payload });
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new BridgeError('send_failed', e instanceof Error ? e.message : String(e)));
        }
      });
    },

    on(event, handler) {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      const wrapped = handler as (payload: unknown) => void;
      set.add(wrapped);
      return () => set.delete(wrapped);
    },

    dispose() {
      unlisten();
      for (const call of pending.values()) {
        clearTimeout(call.timer);
        call.reject(new BridgeError('disposed', 'The bridge was closed.'));
      }
      pending.clear();
      listeners.clear();
    },
  };
}
