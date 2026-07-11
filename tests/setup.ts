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
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
    getManifest: vi.fn(() => ({ content_scripts: [{ js: ['content.js'] }] })),
  },
  scripting: { executeScript: vi.fn(async () => []) },
  sidePanel: { setPanelBehavior: vi.fn(() => Promise.resolve()), open: vi.fn(() => Promise.resolve()) },
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: 'https://mail.google.com/' }]),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  windows: {
    WINDOW_ID_NONE: -1,
    onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

export function __resetChromeStore() {
  for (const k of Object.keys(store)) delete store[k];
}
