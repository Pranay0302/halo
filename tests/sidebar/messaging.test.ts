import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToTab } from '../../src/sidebar/state/messaging';

beforeEach(() => {
  (chrome.tabs.query as any) = vi.fn(async () => [{ id: 7, url: 'https://mail.google.com/' }]);
  (chrome.scripting.executeScript as any) = vi.fn(async () => []);
});

describe('sendToTab / ensureContentScript', () => {
  it('does not inject when the content script already answers PING', async () => {
    (chrome.tabs as any).sendMessage = vi.fn(async () => ({ ok: true, unmatched: 0 }));

    await sendToTab({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [], globalCss: '' } });

    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(7, expect.objectContaining({ type: 'APPLY_RULESET' }));
  });

  it('injects the content script when PING has no receiving end, then sends', async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockResolvedValue({ unmatched: 0 });
    (chrome.tabs as any).sendMessage = sendMessage;

    await sendToTab({ type: 'APPLY_RULESET', ruleSet: { version: 1, ops: [], globalCss: '' } });

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['content.js'] });
    expect(sendMessage).toHaveBeenLastCalledWith(7, expect.objectContaining({ type: 'APPLY_RULESET' }));
  });
});
