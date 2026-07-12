import type { Op, RestyleRuleSet } from '../shared/types';

const POSITIONS = ['before', 'after', 'prepend', 'append'];

function validateOp(op: unknown, i: number, errors: string[]): void {
  if (typeof op !== 'object' || op === null) { errors.push(`ops[${i}] not an object`); return; }
  const o = op as Record<string, unknown>;
  const sel = () => { if (typeof o.selector !== 'string' || !o.selector) errors.push(`ops[${i}] missing selector`); };
  switch (o.op) {
    case 'hide': sel(); break;
    case 'restyle':
      sel();
      if (typeof o.css !== 'object' || o.css === null) errors.push(`ops[${i}] restyle missing css object`);
      break;
    case 'move':
      sel();
      if (typeof o.target !== 'string' || !o.target) errors.push(`ops[${i}] move missing target`);
      if (!POSITIONS.includes(o.position as string)) errors.push(`ops[${i}] move bad position`);
      break;
    case 'reorder':
      sel();
      if (!Array.isArray(o.order)) errors.push(`ops[${i}] reorder missing order[]`);
      break;
    case 'setText':
      sel();
      if (typeof o.text !== 'string') errors.push(`ops[${i}] setText missing text`);
      break;
    case 'wrap':
      sel();
      if (typeof o.wrapper !== 'string' || !o.wrapper) errors.push(`ops[${i}] wrap missing wrapper`);
      break;
    default: errors.push(`ops[${i}] unknown op '${String(o.op)}'`);
  }
}

// Keep only the well-formed ops, so a single malformed structural op from the
// model doesn't discard the whole (otherwise valid) response.
export function filterValidOps(ops: unknown[]): Op[] {
  return ops.filter((op) => {
    const errs: string[] = [];
    validateOp(op, 0, errs);
    return errs.length === 0;
  }) as Op[];
}

export function validateRuleSet(value: unknown): { ok: boolean; errors: string[]; value?: RestyleRuleSet } {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null) return { ok: false, errors: ['not an object'] };
  const v = value as Record<string, unknown>;
  if (typeof v.version !== 'number') errors.push('version must be a number');
  if (typeof v.globalCss !== 'string') errors.push('globalCss must be a string');
  if (!Array.isArray(v.ops)) errors.push('ops must be an array');
  else v.ops.forEach((op, i) => validateOp(op, i, errors));
  return errors.length === 0
    ? { ok: true, errors, value: value as RestyleRuleSet }
    : { ok: false, errors };
}

export type { Op, RestyleRuleSet };
