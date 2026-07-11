import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredClient } from '../../src/agent/stored';
import { HCompanyClient } from '../../src/agent/HCompanyClient';
import { __resetChromeStore } from '../setup';

describe('getStoredClient', () => {
  beforeEach(() => __resetChromeStore());

  it('throws a helpful error when no key is set', async () => {
    await expect(getStoredClient()).rejects.toThrow(/api key/i);
  });

  it('returns an HCompanyClient when a key is set', async () => {
    await chrome.storage.local.set({ apiKey: 'k-1' });
    expect(await getStoredClient()).toBeInstanceOf(HCompanyClient);
  });
});
