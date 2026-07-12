import { describe, it, expect, beforeEach } from 'vitest';
import { durableSelector, generalizeToken, generalizeRuleSet } from '../../src/content/durableSelector';

function set(html: string) { document.body.innerHTML = html; }

describe('durableSelector', () => {
  beforeEach(() => set(''));

  it('uses a unique aria-label anchor', () => {
    set('<nav aria-label="Main menu"><a>Inbox</a></nav>');
    const nav = document.querySelector('nav')!;
    expect(durableSelector(nav, document)).toBe('nav[aria-label="Main menu"]');
  });

  it('falls back to a unique path when there is no aria-label', () => {
    set('<div role="navigation"><div>a</div><div id="target">b</div></div>');
    const target = document.querySelector('#target')!;
    const sel = durableSelector(target, document);
    expect(document.querySelectorAll(sel).length).toBe(1);
    expect(document.querySelector(sel)).toBe(target);
  });

  it('never emits a data-halo-id in the durable selector', () => {
    set('<section data-halo-id="h9"><p data-halo-id="h10">x</p></section>');
    const p = document.querySelector('p')!;
    expect(durableSelector(p, document)).not.toContain('data-halo-id');
  });
});

describe('generalizeToken / generalizeRuleSet', () => {
  beforeEach(() => set(''));

  it('replaces a data-halo-id token with a durable selector', () => {
    set('<aside role="complementary" data-halo-id="h3">side</aside>');
    expect(generalizeToken('[data-halo-id="h3"]{display:none}', document))
      .toBe('aside[role="complementary"]{display:none}');
  });

  it('leaves tokens whose element is gone untouched', () => {
    set('<div>nothing</div>');
    const css = '[data-halo-id="h99"]{display:none}';
    expect(generalizeToken(css, document)).toBe(css);
  });

  it('produces a selector that survives a reload with a fresh DOM (no hids)', () => {
    // Save-time DOM: tagged with data-halo-id.
    set('<header role="banner" data-halo-id="h1">h</header><nav aria-label="Primary" data-halo-id="h2"><a>Inbox</a></nav>');
    const rs = generalizeRuleSet(document, { version: 1, ops: [], globalCss: '[data-halo-id="h2"]{display:none !important}' });
    expect(rs.globalCss).not.toContain('data-halo-id');

    // Reload: fresh DOM, no data-halo-id, structurally similar (extra link added).
    set('<header role="banner">h</header><nav aria-label="Primary"><a>Inbox</a><a>Sent</a></nav>');
    const nav = document.querySelector('nav')!;
    const sel = rs.globalCss.replace('{display:none !important}', '');
    expect(document.querySelector(sel)).toBe(nav);
  });

  it('generalizes op selectors as well', () => {
    set('<main data-halo-id="h5">m</main>');
    const rs = generalizeRuleSet(document, { version: 1, ops: [{ op: 'hide', selector: '[data-halo-id="h5"]' }], globalCss: '' });
    expect(rs.ops[0].selector).not.toContain('data-halo-id');
    expect(document.querySelector(rs.ops[0].selector)).toBe(document.querySelector('main'));
  });
});
