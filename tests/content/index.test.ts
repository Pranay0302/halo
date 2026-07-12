import { describe, it, expect, beforeEach } from 'vitest';
import { handleMessage } from '../../src/content/index';

describe('content handleMessage', () => {
  beforeEach(() => { document.body.innerHTML = '<div class="ad">a</div>'; });

  it('EXTRACT_PAGE returns a page rep', async () => {
    const res = await handleMessage({ type: 'EXTRACT_PAGE' });
    expect('pageRep' in res && res.pageRep.root.tag).toBe('body');
  });

  it('APPLY_RULESET applies and reports unmatched', async () => {
    const res = await handleMessage({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [{ op: 'hide', selector: '.ad' }], globalCss: '' } });
    expect((document.querySelector('.ad') as HTMLElement).style.display).toBe('none');
    expect('unmatched' in res && res.unmatched).toBe(0);
  });

  it('RESET reverses the previous apply', async () => {
    await handleMessage({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [{ op: 'hide', selector: '.ad' }], globalCss: '' } });
    await handleMessage({ type: 'RESET' });
    expect((document.querySelector('.ad') as HTMLElement).style.display).toBe('');
  });

  it('a second APPLY reverses the first', async () => {
    await handleMessage({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [{ op: 'restyle', selector: '.ad', css: { color: 'rgb(1, 2, 3)' } }], globalCss: '' } });
    await handleMessage({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [], globalCss: '' } });
    expect((document.querySelector('.ad') as HTMLElement).style.color).toBe('');
  });

  it('GENERALIZE_RULESET rewrites data-halo-id selectors into durable ones', async () => {
    document.body.innerHTML = '<aside role="complementary" data-halo-id="mine">s</aside>';
    const res = await handleMessage({
      type: 'GENERALIZE_RULESET',
      ruleSet: { version: 1, ops: [], globalCss: '[data-halo-id="mine"]{display:none}' },
    });
    expect('ruleSet' in res && res.ruleSet.globalCss).toBe('aside[role="complementary"]{display:none}');
  });
});
