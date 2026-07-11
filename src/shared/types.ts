export type Op =
  | { op: 'hide'; selector: string }
  | { op: 'restyle'; selector: string; css: Record<string, string> }
  | { op: 'move'; selector: string; target: string; position: 'before' | 'after' | 'prepend' | 'append' }
  | { op: 'reorder'; selector: string; order: string[] }
  | { op: 'setText'; selector: string; text: string }
  | { op: 'wrap'; selector: string; wrapper: string; className?: string };

export interface RestyleRuleSet {
  version: number;
  ops: Op[];
  globalCss: string;
}

export interface Template {
  id: string;
  name: string;
  domain: string;
  presetBase: string | null;
  instructionHistory: string[];
  ruleSet: RestyleRuleSet;
  createdAt: number;
  updatedAt: number;
}

export interface PageRepNode {
  tag: string;
  id?: string;
  /** Unique, stable per-element id (mirrors the DOM's data-halo-id) for exact targeting. */
  hid?: string;
  classes?: string[];
  role?: string;
  label?: string;
  text?: string;
  /** Viewport geometry in px, so the agent can locate regions like "the left sidebar". */
  rect?: { x: number; y: number; w: number; h: number };
  children?: PageRepNode[];
}

export interface PageRep {
  url: string;
  root: PageRepNode;
}

export interface Preset {
  id: string;
  name: string;
  ruleSet: RestyleRuleSet;
}
