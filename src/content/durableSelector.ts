import type { Op, RestyleRuleSet } from '../shared/types';

// data-halo-id is assigned fresh on every page load, so it is perfect for the
// immediate apply but useless in a saved template. When a template is saved we
// "generalize" each [data-halo-id="…"] reference into a durable selector built
// from the element's stable, semantic attributes so it re-matches on later visits.

const HID_TOKEN = /\[data-halo-id\s*=\s*["']?([^"'\]]+)["']?\]/g;

function attrEscape(v: string): string {
  return v.replace(/["\\]/g, '\\$&');
}

function nthOfType(el: Element): number {
  let i = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i++;
    sib = sib.previousElementSibling;
  }
  return i;
}

// One path segment: prefer a semantic anchor (aria-label, then role), falling
// back to tag + position. data-halo-id is never used (it is not durable).
function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const label = el.getAttribute('aria-label');
  if (label) return `${tag}[aria-label="${attrEscape(label)}"]`;
  const role = el.getAttribute('role');
  if (role) return `${tag}[role="${attrEscape(role)}"]`;
  return `${tag}:nth-of-type(${nthOfType(el)})`;
}

export function durableSelector(el: Element, root: ParentNode): string {
  // A single unique aria-label is the most stable anchor.
  const label = el.getAttribute('aria-label');
  if (label) {
    const s = `${el.tagName.toLowerCase()}[aria-label="${attrEscape(label)}"]`;
    try { if (root.querySelectorAll(s).length === 1) return s; } catch { /* invalid */ }
  }
  // Otherwise climb toward <body>, adding specificity until the path is unique.
  const segs: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
    segs.unshift(segmentFor(cur));
    const candidate = segs.join(' > ');
    try {
      const matches = root.querySelectorAll(candidate);
      if (matches.length === 1 && matches[0] === el) return candidate;
    } catch { /* keep climbing */ }
    cur = cur.parentElement;
  }
  return segs.join(' > ');
}

// Replace every [data-halo-id="…"] token in a string with a durable selector.
// Tokens whose element is gone are left untouched.
export function generalizeToken(str: string, root: ParentNode): string {
  return str.replace(HID_TOKEN, (whole, hid: string) => {
    let el: Element | null = null;
    try { el = root.querySelector(`[data-halo-id="${attrEscape(hid)}"]`); } catch { /* invalid */ }
    return el ? durableSelector(el, root) : whole;
  });
}

export function generalizeRuleSet(root: ParentNode, ruleSet: RestyleRuleSet): RestyleRuleSet {
  return {
    ...ruleSet,
    globalCss: generalizeToken(ruleSet.globalCss, root),
    ops: ruleSet.ops.map((op) => ({ ...op, selector: generalizeToken(op.selector, root) }) as Op),
  };
}
