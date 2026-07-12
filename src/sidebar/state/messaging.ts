import type { Message } from '../../shared/messages';

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return tab;
}

export async function getActiveDomain(): Promise<string> {
  const tab = await getActiveTab();
  try { return new URL(tab.url ?? '').hostname; } catch { return ''; }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_r, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Decode via createImageBitmap (reliable in the side panel — unlike Image.onload,
// which could hang) and redraw small, so the multimodal payload stays ~50KB.
async function downscale(dataUrl: string, maxWidth = 1024): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / (bitmap.width || maxWidth));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.5);
}

// Small screenshot of the visible tab for visual grounding. Timeboxed so it can
// never stall the flow — on failure the agent runs DOM-only.
export async function captureScreenshot(): Promise<string | undefined> {
  try {
    const tab = await getActiveTab();
    const shot = await withTimeout(chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 }), 2000);
    return await withTimeout(downscale(shot), 2000);
  } catch {
    return undefined;
  }
}

async function ping(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' } as Message);
    return true;
  } catch {
    return false;
  }
}

// Content scripts declared in the manifest are only injected into pages that
// load *after* the extension. A tab already open when the extension is
// installed/reloaded has no receiving end, so we inject on demand.
async function ensureContentScript(tabId: number): Promise<void> {
  if (await ping(tabId)) return;

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  if (files.length === 0) throw new Error('No content script to inject.');

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
  } catch {
    throw new Error("Can't modify this page. Try reloading the tab, or open a normal website.");
  }

  // The injected loader registers its listener after an async dynamic import,
  // so wait for the content script to actually come online before messaging.
  for (let i = 0; i < 20; i++) {
    if (await ping(tabId)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Content script did not become ready. Try reloading the tab.');
}

export async function sendToTab<T>(msg: Message): Promise<T> {
  const tab = await getActiveTab();
  await ensureContentScript(tab.id!);
  return chrome.tabs.sendMessage(tab.id!, msg) as Promise<T>;
}
