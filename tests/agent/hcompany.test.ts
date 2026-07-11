import { describe, it, expect, vi } from 'vitest';
import { HCompanyClient } from '../../src/agent/HCompanyClient';
import type { AgentProgress } from '../../src/agent/AgentClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

// Build an SSE stream response from chat-completion chunk frames.
function sseStream(frames: object[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(`data: ${JSON.stringify(f)}\n\n`));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function delta(d: object): object {
  return { choices: [{ delta: d }] };
}

function jsonResponse(message: object): Response {
  return new Response(
    JSON.stringify({ choices: [{ message }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('HCompanyClient', () => {
  it('streams reasoning then content, reports both phases, and parses the answer', async () => {
    const fetchImpl = vi.fn(async () => sseStream([
      delta({ reasoning: 'Let me think ' }),
      delta({ reasoning: 'about the ad.' }),
      delta({ content: '{"version":1,"ops":[{"op":"hide",' }),
      delta({ content: '"selector":".ad"}],"globalCss":""}' }),
    ])) as unknown as typeof fetch;

    const events: AgentProgress[] = [];
    const client = new HCompanyClient({ apiKey: 'k-123', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'hide ads' }, (p) => events.push(p));

    expect(rs.ops[0]).toMatchObject({ op: 'hide', selector: '.ad' });
    expect(events.some((e) => e.phase === 'thinking')).toBe(true);
    expect(events.some((e) => e.phase === 'answering')).toBe(true);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.hcompany.ai/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k-123' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ model: 'holo3-1-35b-a3b', stream: true });
    expect(body.max_tokens).toBeGreaterThanOrEqual(4000);
  });

  it('salvages the JSON from reasoning when content is never emitted', async () => {
    const fetchImpl = vi.fn(async () => sseStream([
      delta({ reasoning: 'The result should be {"version":1,"ops":[],"globalCss":"body{color:red}"}' }),
    ])) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'x' });
    expect(rs.globalCss).toContain('color:red');
  });

  it('falls back to a non-streamed body with null content', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ content: null, reasoning: 'final answer {"version":1,"ops":[],"globalCss":"a{color:blue}"}' }),
    ) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'x' });
    expect(rs.globalCss).toContain('color:blue');
  });

  it('honors a custom model override', async () => {
    const fetchImpl = vi.fn(async () => sseStream([delta({ content: '{"version":1,"ops":[],"globalCss":""}' })])) as unknown as typeof fetch;
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
      return Promise.resolve(sseStream([delta({ content: '{"version":1,"ops":[],"globalCss":""}' })]));
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
