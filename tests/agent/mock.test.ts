import { describe, it, expect } from 'vitest';
import { MockClient, buildPrompt, parseAgentResponse } from '../../src/agent/AgentClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

describe('agent helpers', () => {
  it('buildPrompt covers full restyling (centering, structure) and mandates data-halo-id', () => {
    const p = buildPrompt({ pageRep, base, instruction: 'center the header' });
    expect(p).toContain('center the header');
    expect(p).toContain('mail.google.com');
    expect(p).toContain('data-halo-id');
    expect(p.toLowerCase()).toContain('center');
    expect(p).toMatch(/"op":"move"|reorder/);
  });

  it('parseAgentResponse turns {css} into a globalCss rule set', () => {
    const rs = parseAgentResponse('{"css":"aside{display:none !important}"}');
    expect(rs.globalCss).toBe('aside{display:none !important}');
    expect(rs.ops).toEqual([]);
  });

  it('parseAgentResponse accepts {css, ops} for structural changes', () => {
    const text = '{"css":"body{color:red}","ops":[{"op":"move","selector":"[data-halo-id=\\"h5\\"]","target":"[data-halo-id=\\"h2\\"]","position":"after"}]}';
    const rs = parseAgentResponse(text);
    expect(rs.globalCss).toBe('body{color:red}');
    expect(rs.ops[0]).toMatchObject({ op: 'move', position: 'after' });
  });

  it('parseAgentResponse accepts ops-only structural moves and drops malformed ops', () => {
    const text = '{"ops":[{"op":"reorder","selector":"[data-halo-id=\\"h1\\"]","order":["a","b"]},{"op":"bogus"}]}';
    const rs = parseAgentResponse(text);
    expect(rs.ops).toHaveLength(1);
    expect(rs.ops[0].op).toBe('reorder');
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
