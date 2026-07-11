import { describe, it, expect, beforeEach } from 'vitest';
import { extractPageRep } from '../../src/content/pageExtract';

describe('extractPageRep', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('captures tag, id, classes and trimmed text', () => {
    document.body.innerHTML = '<div id="hero" class="a b"><p>Hello world</p></div>';
    const rep = extractPageRep(document.body, { url: 'https://x' });
    const hero = rep.root.children![0];
    expect(hero.tag).toBe('div');
    expect(hero.id).toBe('hero');
    expect(hero.classes).toEqual(['a', 'b']);
    expect(hero.children![0].text).toBe('Hello world');
  });

  it('skips script and style nodes', () => {
    document.body.innerHTML = '<script>var x=1</script><span>ok</span>';
    const rep = extractPageRep(document.body);
    const tags = rep.root.children!.map((c) => c.tag);
    expect(tags).not.toContain('script');
    expect(tags).toContain('span');
  });

  it('respects maxDepth', () => {
    document.body.innerHTML = '<div><div><div><div>deep</div></div></div></div>';
    const rep = extractPageRep(document.body, { maxDepth: 2 });
    expect(rep.root.children![0].children![0].children).toBeUndefined();
  });
});
