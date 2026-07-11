import { describe, it, expect } from 'vitest';
import { sanitizeCss } from '../../src/rules/sanitize';

describe('sanitizeCss', () => {
  it('keeps normal declarations', () => {
    expect(sanitizeCss('body{color:#eee;font-size:16px}')).toContain('color:#eee');
  });
  it('strips @import', () => {
    expect(sanitizeCss("@import url('evil.css'); body{color:red}")).not.toMatch(/@import/i);
  });
  it('strips javascript: urls', () => {
    expect(sanitizeCss('a{background:url(javascript:alert(1))}')).not.toMatch(/javascript:/i);
  });
  it('strips expression()', () => {
    expect(sanitizeCss('div{width:expression(alert(1))}')).not.toMatch(/expression\(/i);
  });
  it('keeps safe image urls', () => {
    expect(sanitizeCss('a{background:url(https://x/y.png)}')).toContain('https://x/y.png');
  });
});
