export function sanitizeCss(css: string): string {
  let out = css;
  // Remove @import rules entirely (up to the next semicolon).
  out = out.replace(/@import[^;]*;?/gi, '');
  // Remove IE expression() usage.
  out = out.replace(/expression\s*\([^)]*\)/gi, '');
  // Neutralize javascript: URLs inside url(...).
  out = out.replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, 'none');
  return out;
}
