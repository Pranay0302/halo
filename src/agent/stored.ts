import type { AgentClient } from './AgentClient';
import { HCompanyClient } from './HCompanyClient';

export async function getStoredClient(): Promise<AgentClient> {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('No H Company API key set. Add it in the sidebar settings.');
  }
  return new HCompanyClient({ apiKey });
}
