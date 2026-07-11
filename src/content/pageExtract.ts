import type { PageRep, PageRepNode } from '../shared/types';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'META', 'LINK']);

function nodeOf(el: Element, depth: number, maxDepth: number, budget: { n: number }): PageRepNode {
  const node: PageRepNode = { tag: el.tagName.toLowerCase() };
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

  if (depth < maxDepth) {
    const kids: PageRepNode[] = [];
    for (const child of Array.from(el.children)) {
      if (budget.n <= 0) break;
      if (SKIP.has(child.tagName)) continue;
      budget.n -= 1;
      kids.push(nodeOf(child, depth + 1, maxDepth, budget));
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
  const el = (root as Document).body ?? (root as HTMLElement);
  return {
    url: opts.url ?? (typeof location !== 'undefined' ? location.href : ''),
    root: nodeOf(el, 0, maxDepth, budget),
  };
}
