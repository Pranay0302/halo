import { vi } from 'vitest';

const store: Record<string, unknown> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[] | null) => {
        if (!keys) return { ...store };
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.map((k) => [k, store[k]]));
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete store[key];
      }),
    },
  },
  runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
  sidePanel: { setPanelBehavior: vi.fn(), open: vi.fn() },
  tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://mail.google.com/' }]) },
};

export function __resetChromeStore() {
  for (const k of Object.keys(store)) delete store[k];
}
