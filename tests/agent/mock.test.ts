import { describe, it, expect } from 'vitest';
import { MockClient, buildPrompt, parseAgentResponse } from '../../src/agent/AgentClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

describe('agent helpers', () => {
  it('buildPrompt includes instruction and url', () => {
    const p = buildPrompt({ pageRep, base, instruction: 'hide ads' });
    expect(p).toContain('hide ads');
    expect(p).toContain('mail.google.com');
  });

  it('parseAgentResponse extracts fenced JSON and validates', () => {
    const text = 'Sure!\n```json\n{"version":1,"ops":[{"op":"hide","selector":".ad"}],"globalCss":""}\n```';
    const rs = parseAgentResponse(text);
    expect(rs.ops[0]).toMatchObject({ op: 'hide', selector: '.ad' });
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
