import type { RestyleRuleSet } from '../shared/types';
import { type AgentClient, type AgentInput, buildPrompt, parseAgentResponse } from './AgentClient';

// H Company exposes an OpenAI-compatible chat-completions API.
// Docs: https://hub.hcompany.ai/quickstart
const DEFAULT_ENDPOINT = 'https://api.hcompany.ai/v1/chat/completions';
const DEFAULT_MODEL = 'holo3-1-35b-a3b';
// Abort if no data arrives for this long. Streaming resets it on every chunk,
// so a slow-but-steady model keeps going instead of hitting a hard wall.
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

  async generate(
    input: AgentInput,
    onProgress?: (partial: string) => void,
    externalSignal?: AbortSignal,
  ): Promise<RestyleRuleSet> {
    if (externalSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');

    const controller = new AbortController();
    let timer!: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    };
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort);
    arm();

    try {
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
            stream: true,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildPrompt(input) },
            ],
          }),
          signal: controller.signal,
        });
      } catch (e) {
        if (externalSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
        if (controller.signal.aborted) {
          throw new Error(
            `H Company API timed out after ${this.timeoutMs / 1000}s with no response. ` +
            'The free tier allows ~5 requests/min — wait a few seconds and try again.',
          );
        }
        throw new Error(`Could not reach the H Company API: ${(e as Error).message}`);
      }

      if (!res.ok) {
        throw new Error(`H Company API error ${res.status}: ${await res.text().catch(() => '')}`.trim());
      }

      let content = '';
      let raw = '';
      const reader = res.body?.getReader();
      try {
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            arm();
            const chunk = decoder.decode(value, { stream: true });
            raw += chunk;
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith('data:')) continue;
              const payload = t.slice(5).trim();
              if (payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                const delta: unknown = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
                if (typeof delta === 'string' && delta) {
                  content += delta;
                  onProgress?.(content);
                }
              } catch {
                // Partial SSE line spanning chunks — recovered on the next read.
              }
            }
          }
        } else {
          raw = await res.text();
        }
      } catch (e) {
        if (externalSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
        if (controller.signal.aborted) {
          throw new Error(`H Company API stalled (no data for ${this.timeoutMs / 1000}s). Try again.`);
        }
        throw e;
      } finally {
        // Release the connection promptly so the next request isn't blocked
        // waiting for this one's socket.
        if (reader) {
          try { await reader.cancel(); } catch { /* stream already closed */ }
        }
      }

      // Non-streamed fallback: the server returned a single JSON body.
      if (!content && raw) {
        try {
          const json = JSON.parse(raw) as {
            choices?: Array<{ message?: { content?: string } }>;
            output?: string;
            text?: string;
          };
          const c = json.choices?.[0]?.message?.content ?? json.output ?? json.text;
          if (typeof c === 'string') { content = c; onProgress?.(content); }
        } catch {
          // Not JSON either — fall through to the "no output" error below.
        }
      }

      if (!content) throw new Error('H Company API returned no text output');
      return parseAgentResponse(content);
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
