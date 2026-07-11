import type { RestyleRuleSet } from '../shared/types';
import type { AgentClient, AgentInput, AgentProgress } from './AgentClient';

export class MockClient implements AgentClient {
  async generate(
    input: AgentInput,
    _onProgress?: (progress: AgentProgress) => void,
    _signal?: AbortSignal,
  ): Promise<RestyleRuleSet> {
    const hideAds = /\bads?\b/i.test(input.instruction);
    return {
      version: 1,
      ops: [
        ...input.base.ops,
        ...(hideAds ? [{ op: 'hide', selector: '[aria-label*="ad" i]' } as const] : []),
      ],
      globalCss: input.base.globalCss,
    };
  }
}
