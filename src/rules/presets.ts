import type { Preset } from '../shared/types';

export const PRESETS: Preset[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    ruleSet: {
      version: 1,
      ops: [],
      globalCss: `* { box-shadow: none !important; }
        [role="banner"], aside, [aria-label*="ad" i] { display: none !important; }
        body { max-width: 1100px; margin: 0 auto; }`,
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    ruleSet: {
      version: 1,
      ops: [],
      globalCss: `html { filter: invert(1) hue-rotate(180deg); background: #111; }
        img, video, canvas, [style*="background-image"] { filter: invert(1) hue-rotate(180deg); }`,
    },
  },
  {
    id: 'focus',
    name: 'Focus / Reading',
    ruleSet: {
      version: 1,
      ops: [],
      globalCss: `body { font-size: 18px; line-height: 1.6; }
        aside, nav, [role="complementary"] { display: none !important; }
        main, [role="main"], article { max-width: 720px; margin: 0 auto; }`,
    },
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
