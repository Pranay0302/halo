import { describe, it, expect } from 'vitest';
import { PRESETS, getPreset } from '../../src/rules/presets';
import { validateRuleSet } from '../../src/rules/schema';

describe('presets', () => {
  it('exposes at least minimal, dark, focus', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['minimal', 'dark', 'focus']));
  });
  it('every preset rule set is schema-valid', () => {
    for (const p of PRESETS) expect(validateRuleSet(p.ruleSet).ok).toBe(true);
  });
  it('getPreset returns by id and undefined for unknown', () => {
    expect(getPreset('dark')?.name).toBeTruthy();
    expect(getPreset('nope')).toBeUndefined();
  });
});
