import { describe, it, expect } from 'vitest';
import { handleGenerate } from '../../src/background/serviceWorker';
import { MockClient } from '../../src/agent/AgentClient';
import type { PageRep, RestyleRuleSet } from '../../src/shared/types';

const pageRep: PageRep = { url: 'https://mail.google.com', root: { tag: 'body' } };
const base: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

describe('handleGenerate', () => {
  it('returns a rule set from the client', async () => {
    const res = await handleGenerate(
      { type: 'GENERATE', instruction: 'hide ads', base, pageRep },
      { getClient: async () => new MockClient() },
    );
    expect('ruleSet' in res && res.ruleSet.ops.some((o) => o.op === 'hide')).toBe(true);
  });

  it('returns an error object when the client throws', async () => {
    const res = await handleGenerate(
      { type: 'GENERATE', instruction: 'x', base, pageRep },
      { getClient: async () => { throw new Error('no api key'); } },
    );
    expect('error' in res && res.error).toMatch(/no api key/);
  });
});
