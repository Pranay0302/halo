import { describe, it, expect, beforeEach } from 'vitest';
import { applyRuleSet } from '../../src/rules/engine';
import type { RestyleRuleSet } from '../../src/shared/types';

function setDom(html: string) { document.body.innerHTML = html; }

describe('applyRuleSet', () => {
  beforeEach(() => setDom(''));

  it('hides matching elements and reverses', () => {
    setDom('<div class="ad">a</div><div class="keep">k</div>');
    const rs: RestyleRuleSet = { version: 1, ops: [{ op: 'hide', selector: '.ad' }], globalCss: '' };
    const res = applyRuleSet(document, rs);
    expect((document.querySelector('.ad') as HTMLElement).style.display).toBe('none');
    res.reverse();
    expect((document.querySelector('.ad') as HTMLElement).style.display).toBe('');
  });

  it('applies restyle css and reverses', () => {
    setDom('<p id="t">hi</p>');
    const rs: RestyleRuleSet = { version: 1, ops: [{ op: 'restyle', selector: '#t', css: { color: 'rgb(255, 0, 0)' } }], globalCss: '' };
    const res = applyRuleSet(document, rs);
    expect((document.querySelector('#t') as HTMLElement).style.color).toBe('rgb(255, 0, 0)');
    res.reverse();
    expect((document.querySelector('#t') as HTMLElement).style.color).toBe('');
  });

  it('injects sanitized globalCss and removes it on reverse', () => {
    const rs: RestyleRuleSet = { version: 1, ops: [], globalCss: '@import url(evil); body{color:red}' };
    const res = applyRuleSet(document, rs);
    const style = document.querySelector('style[data-hco-style]') as HTMLStyleElement;
    expect(style).toBeTruthy();
    expect(style.textContent).not.toMatch(/@import/i);
    res.reverse();
    expect(document.querySelector('style[data-hco-style]')).toBeNull();
  });

  it('moves an element and reverses to original position', () => {
    setDom('<div id="a"></div><div id="b"><span id="s">x</span></div>');
    const rs: RestyleRuleSet = { version: 1, ops: [{ op: 'move', selector: '#s', target: '#a', position: 'append' }], globalCss: '' };
    const res = applyRuleSet(document, rs);
    expect(document.querySelector('#a')!.contains(document.querySelector('#s'))).toBe(true);
    res.reverse();
    expect(document.querySelector('#b')!.contains(document.querySelector('#s'))).toBe(true);
  });

  it('counts unmatched selectors', () => {
    const rs: RestyleRuleSet = { version: 1, ops: [{ op: 'hide', selector: '.nope' }], globalCss: '' };
    expect(applyRuleSet(document, rs).unmatched).toBe(1);
  });
});
