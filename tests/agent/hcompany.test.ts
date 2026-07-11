import { describe, it, expect, vi } from 'vitest';
import { HCompanyClient } from '../../src/agent/HCompanyClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

// Build a Server-Sent-Events stream response from delta content strings.
function sseResponse(...deltas: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const d of deltas) {
        const frame = JSON.stringify({ choices: [{ delta: { content: d } }] });
        controller.enqueue(enc.encode(`data: ${frame}\n\n`));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function jsonResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('HCompanyClient', () => {
  it('streams a chat completion, reports progress, and parses the reply', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse('{"version":1,"ops":[{"op":"hide",', '"selector":".ad"}],"globalCss":""}'),
    ) as unknown as typeof fetch;

    const progress: string[] = [];
    const client = new HCompanyClient({ apiKey: 'k-123', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'hide ads' }, (p) => progress.push(p));

    expect(rs.ops[0]).toMatchObject({ op: 'hide', selector: '.ad' });
    expect(progress.length).toBeGreaterThan(1); // streamed in multiple deltas

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.hcompany.ai/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k-123' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ model: 'holo3-1-35b-a3b', stream: true });
    expect(body.messages.at(-1).content).toContain('hide ads');
  });

  it('falls back to a non-streamed JSON body', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse('{"version":1,"ops":[],"globalCss":"body{color:red}"}'),
    ) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'x' });
    expect(rs.globalCss).toContain('color:red');
  });

  it('honors a custom model override', async () => {
    const fetchImpl = vi.fn(async () => sseResponse('{"version":1,"ops":[],"globalCss":""}')) as unknown as typeof fetch;
    const client = new HCompanyClient({ apiKey: 'k', model: 'holo3-122b-a10b', fetchImpl });
    await client.generate({ pageRep, base, instruction: 'x' });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).model).toBe('holo3-122b-a10b');
  });

  it('aborts the request when the external signal fires', async () => {
    const external = new AbortController();
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k', fetchImpl });
    const p = client.generate({ pageRep, base, instruction: 'x' }, undefined, external.signal);
    external.abort();

    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws a helpful error on non-200', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    const client = new HCompanyClient({ apiKey: 'bad', fetchImpl });
    await expect(client.generate({ pageRep, base, instruction: 'x' })).rejects.toThrow(/401/);
  });

  it('calls the global fetch with the global receiver by default', async () => {
    // Mimics native fetch, which rejects an unexpected `this` (the cause of the
    // "Illegal invocation" error when fetch is called as an object method).
    const globalFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis && this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(sseResponse('{"version":1,"ops":[],"globalCss":""}'));
    });
    const original = globalThis.fetch;
    (globalThis as any).fetch = globalFetch;
    try {
      const client = new HCompanyClient({ apiKey: 'k' });
      const rs = await client.generate({ pageRep, base, instruction: 'x' });
      expect(rs.version).toBe(1);
      expect(globalFetch).toHaveBeenCalled();
    } finally {
      (globalThis as any).fetch = original;
    }
  });
});
