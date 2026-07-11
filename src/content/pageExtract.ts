import type { PageRep, PageRepNode } from '../shared/types';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'META', 'LINK']);

// A page-lifetime monotonic counter so ids never collide across re-extractions,
// and reset to 0 on a fresh page load (making structural ids reproducible).
function hidCounter(): { get(): number; set(n: number): void } {
  const w = (typeof window !== 'undefined' ? window : globalThis) as { __hcoHid?: number };
  return {
    get: () => (typeof w.__hcoHid === 'number' ? w.__hcoHid : 0),
    set: (n) => { w.__hcoHid = n; },
  };
}

function nodeOf(el: Element, depth: number, maxDepth: number, budget: { n: number }, ids: { n: number }): PageRepNode {
  const node: PageRepNode = { tag: el.tagName.toLowerCase() };

  // Tag the real element with a unique id so the agent can target it exactly via
  // [data-halo-id="…"] — class names in apps like Gmail are reused and unsafe.
  let hid = el.getAttribute('data-halo-id');
  if (!hid) {
    hid = `h${ids.n++}`;
    try { el.setAttribute('data-halo-id', hid); } catch { /* read-only / detached node */ }
  }
  node.hid = hid;

  if (el.id) node.id = el.id;
  const cls = (el.getAttribute('class') || '').trim();
  if (cls) node.classes = cls.split(/\s+/).slice(0, 6);
  const role = el.getAttribute('role');
  if (role) node.role = role;
  const label = el.getAttribute('aria-label');
  if (label) node.label = label.slice(0, 60);

  const ownText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent || '')
    .join(' ')
    .trim();
  if (ownText) node.text = ownText.slice(0, 80);

  const rect = (el as HTMLElement).getBoundingClientRect?.();
  if (rect && (rect.width || rect.height)) {
    node.rect = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
  }

  if (depth < maxDepth) {
    const kids: PageRepNode[] = [];
    for (const child of Array.from(el.children)) {
      if (budget.n <= 0) break;
      if (SKIP.has(child.tagName)) continue;
      budget.n -= 1;
      kids.push(nodeOf(child, depth + 1, maxDepth, budget, ids));
    }
    if (kids.length) node.children = kids;
  }
  return node;
}

export function extractPageRep(
  root: Document | HTMLElement,
  opts: { maxDepth?: number; maxNodes?: number; url?: string } = {},
): PageRep {
  const maxDepth = opts.maxDepth ?? 12;
  const budget = { n: opts.maxNodes ?? 800 };
  const counter = hidCounter();
  const ids = { n: counter.get() };
  const el = (root as Document).body ?? (root as HTMLElement);
  const rep: PageRep = {
    url: opts.url ?? (typeof location !== 'undefined' ? location.href : ''),
    root: nodeOf(el, 0, maxDepth, budget, ids),
  };
  counter.set(ids.n);
  return rep;
}
