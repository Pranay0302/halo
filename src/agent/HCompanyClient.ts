import type { RestyleRuleSet } from '../shared/types';
import { type AgentClient, type AgentInput, type AgentProgress, buildPrompt, parseAgentResponse } from './AgentClient';

// H Company exposes an OpenAI-compatible chat-completions API.
// Docs: https://hub.hcompany.ai/quickstart
const DEFAULT_ENDPOINT = 'https://api.hcompany.ai/v1/chat/completions';
const DEFAULT_MODEL = 'holo3-1-35b-a3b';
// holo3 is a reasoning model. Its default (full) reasoning is very slow — often
// tens of seconds. "low" effort keeps it fast (~1-3s) while still emitting the
// JSON answer, so the page updates quickly.
const DEFAULT_REASONING_EFFORT = 'low';
const DEFAULT_MAX_TOKENS = 2000;
// Abort if no data arrives for this long. Streaming resets it on every chunk,
// so a slow-but-steady model keeps going. The model normally answers in ~1-2s;
// a long silence means the free-tier rate limit was hit, so fail fast and clear.
const DEFAULT_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT =
  'You restyle web pages with CSS. Target elements ONLY via their unique ' +
  '[data-halo-id="<hid>"] attribute — never class or tag selectors (classes are reused and unsafe). ' +
  'Change only the element the user names; never hide <body>/<html> or a page-covering wrapper. ' +
  'Respond with ONLY a JSON object {"css":"<css rules>"} — one JSON object, no prose, no markdown.';

interface Delta {
  content?: string | null;
  reasoning?: string | null;
}

type UserContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

// Multimodal when a screenshot is present: send the prompt text plus the image
// so the model can see the page; otherwise send plain text.
function buildUserContent(input: AgentInput): UserContent {
  const text = buildPrompt(input);
  if (!input.screenshot) return text;
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: input.screenshot } },
  ];
}

export interface HCompanyOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HCompanyClient implements AgentClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly reasoningEffort: 'low' | 'medium' | 'high';
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HCompanyOptions) {
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.reasoningEffort = opts.reasoningEffort ?? DEFAULT_REASONING_EFFORT;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Bind to the global scope: native fetch throws "Illegal invocation" if
    // called with a receiver other than the window/worker global.
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(
    input: AgentInput,
    onProgress?: (progress: AgentProgress) => void,
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

    let content = '';
    let reasoning = '';
    const consumeDelta = (delta: Delta) => {
      if (typeof delta.reasoning === 'string' && delta.reasoning) {
        reasoning += delta.reasoning;
        onProgress?.({ phase: 'thinking', text: reasoning, chars: reasoning.length });
      }
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        onProgress?.({ phase: 'answering', text: content, chars: content.length });
      }
    };

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
            max_tokens: this.maxTokens,
            reasoning_effort: this.reasoningEffort,
            stream: true,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildUserContent(input) },
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
                const delta: Delta | undefined = json.choices?.[0]?.delta;
                if (delta) consumeDelta(delta);
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
        if (reader) {
          try { await reader.cancel(); } catch { /* stream already closed */ }
        }
      }

      // Non-streamed fallback: the server returned a single JSON body.
      if (!content && raw) {
        try {
          const json = JSON.parse(raw) as {
            choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
            output?: string;
            text?: string;
          };
          const msg = json.choices?.[0]?.message;
          const c = msg?.content ?? json.output ?? json.text;
          if (typeof c === 'string') content = c;
          if (!content && typeof msg?.reasoning === 'string') reasoning = msg.reasoning;
        } catch {
          // Not JSON either — fall through to the "no output" handling below.
        }
      }

      // Prefer the answer; if the model spent its budget reasoning, salvage the
      // JSON object it produced inside the reasoning text.
      const answer = content.trim() ? content : reasoning;
      if (!answer.trim()) throw new Error('H Company API returned no text output');
      return parseAgentResponse(answer);
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
