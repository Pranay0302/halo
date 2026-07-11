import { describe, it, expect, vi } from 'vitest';
import { HCompanyClient } from '../../src/agent/HCompanyClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('HCompanyClient', () => {
  it('posts a chat completion with auth and model, and parses the reply', async () => {
    const fetchImpl = vi.fn(async () =>
      chatResponse('{"version":1,"ops":[{"op":"hide","selector":".ad"}],"globalCss":""}'),
    ) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k-123', fetchImpl });
    const rs = await client.generate({ pageRep, base, instruction: 'hide ads' });

    expect(rs.ops[0]).toMatchObject({ op: 'hide', selector: '.ad' });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.hcompany.ai/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k-123' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('holo3-1-35b-a3b');
    expect(body.messages.at(-1).content).toContain('hide ads');
  });

  it('honors a custom model override', async () => {
    const fetchImpl = vi.fn(async () =>
      chatResponse('{"version":1,"ops":[],"globalCss":""}'),
    ) as unknown as typeof fetch;

    const client = new HCompanyClient({ apiKey: 'k', model: 'holo3-122b-a10b', fetchImpl });
    await client.generate({ pageRep, base, instruction: 'x' });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).model).toBe('holo3-122b-a10b');
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
      return Promise.resolve(chatResponse('{"version":1,"ops":[],"globalCss":""}'));
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
