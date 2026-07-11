import type { PageRep, RestyleRuleSet } from '../shared/types';
import { validateRuleSet } from '../rules/schema';

export interface AgentInput {
  pageRep: PageRep;
  base: RestyleRuleSet;
  instruction: string;
}

export interface AgentClient {
  generate(input: AgentInput): Promise<RestyleRuleSet>;
}

export function buildPrompt(input: AgentInput): string {
  return [
    'You restyle web pages by returning a JSON RestyleRuleSet.',
    'Schema: { "version": 1, "ops": Op[], "globalCss": string }.',
    'Op is one of: {op:"hide",selector}, {op:"restyle",selector,css:{}},',
    '{op:"move",selector,target,position:"before|after|prepend|append"},',
    '{op:"reorder",selector,order:[]}, {op:"setText",selector,text}, {op:"wrap",selector,wrapper,className?}.',
    'Return ONLY the JSON object, no prose.',
    `Page URL: ${input.pageRep.url}`,
    `Current rule set: ${JSON.stringify(input.base)}`,
    `Page structure (truncated): ${JSON.stringify(input.pageRep.root).slice(0, 6000)}`,
    `User instruction: ${input.instruction}`,
  ].join('\n');
}

export function parseAgentResponse(text: string): RestyleRuleSet {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('No JSON object in agent response');
  let parsed: unknown;
  try { parsed = JSON.parse(raw.slice(start, end + 1)); }
  catch (e) { throw new Error(`Agent response is not valid JSON: ${(e as Error).message}`); }
  const res = validateRuleSet(parsed);
  if (!res.ok) throw new Error(`Agent rule set invalid: ${res.errors.join('; ')}`);
  return res.value!;
}

export { MockClient } from './MockClient';
