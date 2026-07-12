import type { RestyleRuleSet } from '../shared/types';
import { getPreset } from '../rules/presets';
import { extractPageRep } from './pageExtract';

// A deterministic fast-path (BrowserOS-style: the model plans novel tasks, but
// common operations are plain tools). Recognized layout commands resolve
// instantly in the page — no network, no rate limit — and only unrecognized
// instructions fall through to the H Company agent.

export type Region = 'left' | 'right' | 'top' | 'bottom';
export type Intent =
  | { kind: 'preset'; id: string }
  | { kind: 'hideRegions'; regions: Region[] }
  | { kind: 'hideAds' }
  | { kind: 'keepMain' };

export interface RegionCand {
  hid: string;
  role: string | null;
  tag: string;
  rect: { x: number; y: number; w: number; h: number };
}

const REMOVE = /\b(hide|remove|delete|clear|kill|drop|get rid of|no more|without)\b/;

export function parseIntent(instruction: string): Intent | null {
  const s = instruction.toLowerCase().trim();
  if (!s) return null;

  // Presets (no geometry needed).
  if (/\bdark\s*(mode|theme)\b/.test(s) || s === 'dark') return { kind: 'preset', id: 'dark' };
  if (/\b(reader|reading|focus)\s*(mode|view)?\b/.test(s)) return { kind: 'preset', id: 'focus' };
  if (/\b(minimal|declutter|clean up|simplify)\b/.test(s)) return { kind: 'preset', id: 'minimal' };

  // Keep only the GENERIC main content. A specific target ("keep only the
  // profile") is ambiguous for a heuristic, so it falls through to the agent,
  // which can see the screenshot and locate that named section.
  if (/\b(keep|show|just)\b/.test(s) && /\bonly\b/.test(s)
    && /\b(main content|the content|the article|the post|the video|the feed|the story|reading|the main|the mail|the inbox|the email|the messages)\b/.test(s)) {
    return { kind: 'keepMain' };
  }

  if (REMOVE.test(s)) {
    if (/\bad(s|vert|verts|vertisement|vertisements)?\b/.test(s)) return { kind: 'hideAds' };
    // Collect every region mentioned so "remove the top and left bar" hides both.
    const regions: Region[] = [];
    const isSide = /\b(side\s*bar|sidebar|side\s*panel|nav|navigation|panel|menu|column|rail|bar)\b/.test(s);
    if (/\b(header|banner|top\s*bar|nav\s*bar|navbar|top\s+navigation)\b/.test(s) || (/\btop\b/.test(s) && /\bbar\b/.test(s))) regions.push('top');
    if (/\bfooter\b/.test(s) || (/\bbottom\b/.test(s) && /\bbar\b/.test(s))) regions.push('bottom');
    if (/\bleft\b/.test(s) && isSide) regions.push('left');
    if (/\bright\b/.test(s) && isSide) regions.push('right');
    if (!regions.includes('left') && !regions.includes('right') && /\b(side\s*bar|sidebar|side\s*panel)\b/.test(s)) regions.push('left');
    if (regions.length) return { kind: 'hideRegions', regions };
  }
  return null;
}

// Score how well a candidate matches a screen region, combining geometry
// (position/size in the viewport) with semantic role/tag. 0 = not a match.
export function regionScore(c: RegionCand, region: Region, vw: number, vh: number): number {
  const { x, y, w, h } = c.rect;
  if (w <= 0 || h <= 0) return 0;
  const right = x + w;
  const bottom = y + h;
  // Semantic bonus only counts when the geometry already places the element in
  // the region, so a right-hand <aside> never scores for a "left" query.
  if (region === 'left' && x <= vw * 0.15 && w <= vw * 0.5 && h >= vh * 0.4) {
    return 1 + h / vh + (c.role === 'navigation' ? 2 : c.tag === 'nav' ? 1.5 : c.tag === 'aside' ? 0.5 : 0);
  }
  if (region === 'right' && right >= vw * 0.85 && w <= vw * 0.5 && h >= vh * 0.4) {
    return 1 + h / vh + (c.role === 'complementary' ? 2 : c.tag === 'aside' ? 1.5 : 0);
  }
  if (region === 'top' && y <= vh * 0.1 && w >= vw * 0.6 && h <= vh * 0.3) {
    return 1 + w / vw + (c.role === 'banner' ? 2 : c.tag === 'header' ? 1.5 : 0);
  }
  if (region === 'bottom' && bottom >= vh * 0.9 && w >= vw * 0.6 && h <= vh * 0.3) {
    return 1 + w / vw + (c.role === 'contentinfo' ? 2 : c.tag === 'footer' ? 1.5 : 0);
  }
  return 0;
}

export function pickRegion(cands: RegionCand[], region: Region, vw: number, vh: number): string[] {
  const scored = cands
    .map((c) => ({ hid: c.hid, score: regionScore(c, region, vw, vh) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.length ? [scored[0].hid] : [];
}

const CAND_SELECTOR =
  'header,nav,aside,main,footer,[role="banner"],[role="navigation"],[role="complementary"],[role="main"],[role="contentinfo"]';

const AD_CSS =
  '[aria-label*="advert" i],[class*="advertisement" i],[class*="sponsored" i],[id*="google_ads"],' +
  'ins.adsbygoogle,iframe[src*="doubleclick"],iframe[src*="googlesyndication"]{display:none !important}';

function candidatesFrom(root: Document): RegionCand[] {
  return Array.from(root.querySelectorAll(CAND_SELECTOR)).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      hid: el.getAttribute('data-halo-id') || '',
      role: el.getAttribute('role'),
      tag: el.tagName.toLowerCase(),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  }).filter((c) => c.hid);
}

function hideCss(hids: string[]): string {
  return hids.map((h) => `[data-halo-id="${h}"]`).join(',') + '{display:none !important}';
}

// "Keep only the main content": hide every sibling along the ancestor chain of
// the main element, leaving just its path visible.
function keepMainCss(root: Document, cands: RegionCand[], vw: number, vh: number): string | null {
  let main: Element | null = root.querySelector('[role="main"], main');
  if (!main) {
    // Largest central, non-full-width candidate (avoids selecting the root wrapper).
    const central = cands
      .filter((c) => c.rect.w > vw * 0.3 && c.rect.w < vw * 0.98 && c.rect.h > vh * 0.3)
      .sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)[0];
    if (central) main = root.querySelector(`[data-halo-id="${central.hid}"]`);
  }
  if (!main) return null;

  const toHide: string[] = [];
  let el: Element | null = main;
  while (el && el.parentElement && el.tagName !== 'BODY') {
    for (const sib of Array.from(el.parentElement.children)) {
      const hid = sib !== el ? sib.getAttribute('data-halo-id') : null;
      if (hid) toHide.push(hid);
    }
    el = el.parentElement;
  }
  return toHide.length ? hideCss(toHide) : null;
}

export function resolveQuickStyle(root: Document, instruction: string): RestyleRuleSet | null {
  const intent = parseIntent(instruction);
  if (!intent) return null;

  if (intent.kind === 'preset') return getPreset(intent.id)?.ruleSet ?? null;
  if (intent.kind === 'hideAds') return { version: 1, ops: [], globalCss: AD_CSS };

  // Region/keepMain need geometry — make sure elements are tagged first.
  extractPageRep(root);
  const vw = root.defaultView?.innerWidth || 1280;
  const vh = root.defaultView?.innerHeight || 800;
  const cands = candidatesFrom(root);

  if (intent.kind === 'hideRegions') {
    const hids = [...new Set(intent.regions.flatMap((r) => pickRegion(cands, r, vw, vh)))];
    return hids.length ? { version: 1, ops: [], globalCss: hideCss(hids) } : null;
  }
  // keepMain
  const css = keepMainCss(root, cands, vw, vh);
  return css ? { version: 1, ops: [], globalCss: css } : null;
}
