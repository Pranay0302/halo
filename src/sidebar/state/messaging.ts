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

// Downscale a data URL to keep the multimodal payload small and fast.
async function downscale(dataUrl: string, maxWidth = 1200): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / (img.width || maxWidth));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.6);
}

// Screenshot of the visible tab for multimodal grounding. Returns undefined on
// restricted pages so the flow falls back to DOM-only.
export async function captureScreenshot(): Promise<string | undefined> {
  try {
    const tab = await getActiveTab();
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
    return await downscale(shot);
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
