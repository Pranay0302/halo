import type { RestyleRuleSet } from '../shared/types';
import { type AgentClient, type AgentInput, buildPrompt, parseAgentResponse } from './AgentClient';

// H Company exposes an OpenAI-compatible chat-completions API.
// Docs: https://hub.hcompany.ai/quickstart
const DEFAULT_ENDPOINT = 'https://api.hcompany.ai/v1/chat/completions';
const DEFAULT_MODEL = 'holo3-1-35b-a3b';
const DEFAULT_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT =
  'You output only a JSON RestyleRuleSet describing how to restyle a web page. ' +
  'Respond with a single JSON object and no prose or markdown.';

export interface HCompanyOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HCompanyClient implements AgentClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HCompanyOptions) {
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Bind to the global scope: native fetch throws "Illegal invocation" if
    // called with a receiver other than the window/worker global.
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(input: AgentInput): Promise<RestyleRuleSet> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(input) },
          ],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`H Company API timed out after ${this.timeoutMs / 1000}s. Try again.`);
      }
      throw new Error(`Could not reach the H Company API: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`H Company API error ${res.status}: ${await res.text().catch(() => '')}`.trim());
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      output?: string;
      text?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? data.output ?? data.text;
    if (typeof text !== 'string') throw new Error('H Company API returned no text output');
    return parseAgentResponse(text);
  }
}
