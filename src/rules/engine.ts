import type { Op, RestyleRuleSet } from '../shared/types';
import { sanitizeCss } from './sanitize';

export interface ApplyResult {
  unmatched: number;
  reverse: () => void;
}

type Undo = () => void;

function applyOp(root: ParentNode, op: Op, undos: Undo[]): number {
  const matched = Array.from(root.querySelectorAll<HTMLElement>(op.selector));
  if (matched.length === 0) return 1;

  for (const el of matched) {
    switch (op.op) {
      case 'hide': {
        const prev = el.style.display;
        el.style.display = 'none';
        undos.push(() => { el.style.display = prev; });
        break;
      }
      case 'restyle': {
        const prev: Record<string, string> = {};
        for (const [k, v] of Object.entries(op.css)) {
          prev[k] = el.style.getPropertyValue(k);
          el.style.setProperty(k, v);
        }
        undos.push(() => { for (const [k, v] of Object.entries(prev)) el.style.setProperty(k, v); });
        break;
      }
      case 'setText': {
        const prev = el.textContent ?? '';
        el.textContent = op.text;
        undos.push(() => { el.textContent = prev; });
        break;
      }
      case 'move': {
        const target = root.querySelector(op.target);
        if (!target) break;
        const parent = el.parentNode!;
        const next = el.nextSibling;
        if (op.position === 'before') target.parentNode!.insertBefore(el, target);
        else if (op.position === 'after') target.parentNode!.insertBefore(el, target.nextSibling);
        else if (op.position === 'prepend') target.insertBefore(el, target.firstChild);
        else target.appendChild(el);
        undos.push(() => { parent.insertBefore(el, next); });
        break;
      }
      case 'reorder': {
        const prevOrder = Array.from(el.children);
        const picked = op.order
          .map((sel) => el.querySelector(sel))
          .filter((n): n is Element => n !== null);
        picked.forEach((n) => el.appendChild(n));
        undos.push(() => { prevOrder.forEach((n) => el.appendChild(n)); });
        break;
      }
      case 'wrap': {
        const wrapper = document.createElement(op.wrapper);
        if (op.className) wrapper.className = op.className;
        wrapper.setAttribute('data-hco-wrap', '1');
        const parent = el.parentNode!;
        parent.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        undos.push(() => { parent.insertBefore(el, wrapper); wrapper.remove(); });
        break;
      }
    }
  }
  return 0;
}

export function applyRuleSet(root: Document | HTMLElement, ruleSet: RestyleRuleSet): ApplyResult {
  const parent = root as ParentNode;
  const undos: Undo[] = [];
  let unmatched = 0;

  for (const op of ruleSet.ops) unmatched += applyOp(parent, op, undos);

  if (ruleSet.globalCss.trim()) {
    const doc = 'createElement' in root ? (root as Document) : document;
    const style = doc.createElement('style');
    style.setAttribute('data-hco-style', '1');
    style.textContent = sanitizeCss(ruleSet.globalCss);
    (doc.head ?? doc.body ?? parent).appendChild(style);
    undos.push(() => style.remove());
  }

  return {
    unmatched,
    reverse: () => { for (let i = undos.length - 1; i >= 0; i--) undos[i](); },
  };
}
