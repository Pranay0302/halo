import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('runs and can see the chrome mock', () => {
    expect(typeof chrome.storage.local.get).toBe('function');
  });
});
