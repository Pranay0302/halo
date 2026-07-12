import { describe, it, expect } from 'vitest';
import { MockClient, buildPrompt, parseAgentResponse } from '../../src/agent/AgentClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

describe('agent helpers', () => {
  it('buildPrompt includes instruction and url and mandates data-halo-id targeting', () => {
    const p = buildPrompt({ pageRep, base, instruction: 'hide ads' });
    expect(p).toContain('hide ads');
    expect(p).toContain('mail.google.com');
    expect(p).toContain('data-halo-id');
  });

  it('parseAgentResponse turns {css} into a globalCss rule set', () => {
    const rs = parseAgentResponse('{"css":"aside{display:none !important}"}');
    expect(rs.globalCss).toBe('aside{display:none !important}');
    expect(rs.ops).toEqual([]);
  });

  it('parseAgentResponse extracts fenced JSON and validates a full rule set', () => {
    const text = 'Sure!\n```json\n{"version":1,"ops":[{"op":"hide","selector":".ad"}],"globalCss":""}\n```';
    const rs = parseAgentResponse(text);
    expect(rs.ops[0]).toMatchObject({ op: 'hide', selector: '.ad' });
  });

  it('parseAgentResponse extracts the JSON even when wrapped in reasoning/prose', () => {
    const text = 'The user wants to remove the top and left bar.\nLooking at the DOM {gb} I decide:\n{"css":"[data-halo-id=\\"h2\\"]{display:none}"}\nThat should do it.';
    const rs = parseAgentResponse(text);
    expect(rs.globalCss).toBe('[data-halo-id="h2"]{display:none}');
  });

  it('parseAgentResponse throws on invalid rule set', () => {
    expect(() => parseAgentResponse('{"version":1,"ops":[{"op":"nuke"}],"globalCss":""}')).toThrow();
  });

  it('MockClient returns a valid rule set', async () => {
    const rs = await new MockClient().generate({ pageRep, base, instruction: 'hide ads' });
    expect(rs.version).toBe(1);
    expect(Array.isArray(rs.ops)).toBe(true);
  });
});
