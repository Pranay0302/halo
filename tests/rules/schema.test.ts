import { describe, it, expect } from 'vitest';
import { validateRuleSet } from '../../src/rules/schema';

const valid = {
  version: 1,
  ops: [{ op: 'hide', selector: '.ad' }, { op: 'restyle', selector: 'body', css: { background: '#111' } }],
  globalCss: 'body{color:#eee}',
};

describe('validateRuleSet', () => {
  it('accepts a well-formed rule set', () => {
    const r = validateRuleSet(valid);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual(valid);
  });

  it('rejects a non-object', () => {
    expect(validateRuleSet(null).ok).toBe(false);
  });

  it('rejects an unknown op', () => {
    const r = validateRuleSet({ version: 1, ops: [{ op: 'nuke', selector: 'x' }], globalCss: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/op/i);
  });

  it('rejects a hide op without a selector', () => {
    const r = validateRuleSet({ version: 1, ops: [{ op: 'hide' }], globalCss: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects restyle without a css object', () => {
    const r = validateRuleSet({ version: 1, ops: [{ op: 'restyle', selector: 'a' }], globalCss: '' });
    expect(r.ok).toBe(false);
  });
});
