import { describe, it, expect } from 'vitest';
import { isMessage } from '../../src/shared/messages';

describe('isMessage', () => {
  it('accepts known message types', () => {
    expect(isMessage({ type: 'RESET' })).toBe(true);
    expect(isMessage({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [], globalCss: '' } })).toBe(true);
  });
  it('rejects unknown or malformed', () => {
    expect(isMessage({ type: 'WAT' })).toBe(false);
    expect(isMessage(null)).toBe(false);
    expect(isMessage({})).toBe(false);
  });
});
