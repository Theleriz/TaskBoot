import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeError, createBridgeClient, type Transport } from './client.ts';
import type { RequestMessage } from './protocol.ts';

function manualTransport() {
  const sent: RequestMessage[] = [];
  let handler: ((m: unknown) => void) | null = null;
  const transport: Transport = {
    send: (m) => {
      sent.push(m);
    },
    listen: (h) => {
      handler = h;
      return () => {
        handler = null;
      };
    },
  };
  return { transport, sent, deliver: (m: unknown) => handler?.(m) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('bridge client', () => {
  it('matches responses to requests by id', async () => {
    const t = manualTransport();
    const client = createBridgeClient(t.transport);

    const info = client.request('app.info', null);
    const req = t.sent[0];
    expect(req).toMatchObject({ kind: 'request', method: 'app.info', payload: null });

    t.deliver({ kind: 'response', id: 'other', ok: true, result: 'ignored' });
    t.deliver({
      kind: 'response',
      id: req?.id,
      ok: true,
      result: { version: '1.0', platform: 'windows' },
    });
    await expect(info).resolves.toEqual({ version: '1.0', platform: 'windows' });
  });

  it('rejects with the host error', async () => {
    const t = manualTransport();
    const client = createBridgeClient(t.transport);
    const call = client.request('storage.save', { json: '{}' });
    t.deliver({
      kind: 'response',
      id: t.sent[0]?.id,
      ok: false,
      error: { code: 'io_error', message: 'Disk is full' },
    });
    await expect(call).rejects.toMatchObject({
      name: 'BridgeError',
      code: 'io_error',
      message: 'Disk is full',
    });
  });

  it('times out when the host does not answer', async () => {
    vi.useFakeTimers();
    const t = manualTransport();
    const client = createBridgeClient(t.transport, { timeoutMs: 1000 });
    const call = client.request('storage.load', null);
    vi.advanceTimersByTime(1000);
    await expect(call).rejects.toMatchObject({ code: 'timeout' });
  });

  it('delivers host events to subscribers', () => {
    const t = manualTransport();
    const client = createBridgeClient(t.transport);
    const seen: unknown[] = [];
    const off = client.on('app.activated', (p) => seen.push(p));

    t.deliver({ kind: 'event', event: 'app.activated', payload: null });
    off();
    t.deliver({ kind: 'event', event: 'app.activated', payload: null });

    expect(seen).toEqual([null]);
  });

  it('rejects pending calls when disposed', async () => {
    const t = manualTransport();
    const client = createBridgeClient(t.transport);
    const call = client.request('storage.load', null);
    client.dispose();
    await expect(call).rejects.toBeInstanceOf(BridgeError);
  });
});
