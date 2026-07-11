import type { Message, Responses } from '../shared/messages';
import { isMessage } from '../shared/messages';
import type { AgentClient } from '../agent/AgentClient';
import { HCompanyClient } from '../agent/HCompanyClient';

export async function getStoredClient(): Promise<AgentClient> {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('No H Company API key set. Add it in the sidebar settings.');
  }
  return new HCompanyClient({ apiKey });
}

export async function handleGenerate(
  msg: Extract<Message, { type: 'GENERATE' }>,
  deps: { getClient: () => Promise<AgentClient> },
): Promise<Responses['GENERATE']> {
  try {
    const client = await deps.getClient();
    const ruleSet = await client.generate({ pageRep: msg.pageRep, base: msg.base, instruction: msg.instruction });
    return { ruleSet };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('sidePanel setup failed', err));

  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    if (!isMessage(raw)) return false;
    if (raw.type === 'GENERATE') {
      handleGenerate(raw, { getClient: getStoredClient }).then(sendResponse);
      return true;
    }
    return false;
  });
}
