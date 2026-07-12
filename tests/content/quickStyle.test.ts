import { describe, it, expect, beforeEach } from 'vitest';
import { parseIntent, regionScore, pickRegion, resolveQuickStyle, type RegionCand } from '../../src/content/quickStyle';

describe('parseIntent', () => {
  const cases: Array<[string, ReturnType<typeof parseIntent>]> = [
    ['hide the left sidebar', { kind: 'hideRegions', regions: ['left'] }],
    ['remove the left nav', { kind: 'hideRegions', regions: ['left'] }],
    ['remove the right sidebar', { kind: 'hideRegions', regions: ['right'] }],
    ['hide the right side panel', { kind: 'hideRegions', regions: ['right'] }],
    ['remove the header', { kind: 'hideRegions', regions: ['top'] }],
    ['hide the top bar', { kind: 'hideRegions', regions: ['top'] }],
    ['remove the footer', { kind: 'hideRegions', regions: ['bottom'] }],
    ['remove the top and left bar', { kind: 'hideRegions', regions: ['top', 'left'] }],
    ['keep only the mail, remove everything else', { kind: 'keepMain' }],
    ['keep only the content', { kind: 'keepMain' }],
    // A specific named target is ambiguous for the heuristic → defer to the agent.
    ['keep only the profile and remove everything else', null],
    ['remove the analytics section', null],
    ['dark mode', { kind: 'preset', id: 'dark' }],
    ['reader mode', { kind: 'preset', id: 'focus' }],
    ['remove ads', { kind: 'hideAds' }],
    ['make it look like twitter', null],
    ['change the font to comic sans', null],
    ['remove the top result', null],
    ['', null],
  ];
  it.each(cases)('parses %j', (input, expected) => {
    expect(parseIntent(input)).toEqual(expected);
  });
});

describe('regionScore / pickRegion (Gmail-like layout)', () => {
  const vw = 1440, vh = 900;
  const cands: RegionCand[] = [
    { hid: 'header', role: 'banner', tag: 'header', rect: { x: 0, y: 0, w: 1440, h: 64 } },
    { hid: 'nav', role: 'navigation', tag: 'nav', rect: { x: 0, y: 64, w: 230, h: 836 } },
    { hid: 'main', role: 'main', tag: 'main', rect: { x: 230, y: 64, w: 900, h: 836 } },
    { hid: 'aside', role: 'complementary', tag: 'aside', rect: { x: 1130, y: 64, w: 310, h: 836 } },
  ];

  it('picks the left nav for "left"', () => {
    expect(pickRegion(cands, 'left', vw, vh)).toEqual(['nav']);
  });
  it('picks the right aside for "right"', () => {
    expect(pickRegion(cands, 'right', vw, vh)).toEqual(['aside']);
  });
  it('picks the header for "top"', () => {
    expect(pickRegion(cands, 'top', vw, vh)).toEqual(['header']);
  });
  it('does not score a right-hand aside for a "left" query', () => {
    const aside = cands.find((c) => c.hid === 'aside')!;
    expect(regionScore(aside, 'left', vw, vh)).toBe(0);
  });
  it('returns nothing when no candidate fits the region', () => {
    expect(pickRegion([cands[2]], 'left', vw, vh)).toEqual([]);
  });
});

describe('resolveQuickStyle', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('resolves a preset instruction without any geometry', () => {
    const rs = resolveQuickStyle(document, 'dark mode');
    expect(rs?.globalCss).toContain('invert');
  });

  it('resolves "remove ads" to ad-hiding css', () => {
    const rs = resolveQuickStyle(document, 'remove ads');
    expect(rs?.globalCss).toContain('adsbygoogle');
  });

  it('returns null for an unrecognized instruction (agent fallback)', () => {
    expect(resolveQuickStyle(document, 'make the buttons rounded and teal')).toBeNull();
  });
});
