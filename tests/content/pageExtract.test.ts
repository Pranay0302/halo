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

  it('assigns a unique data-halo-id to each element and mirrors it as hid', () => {
    document.body.innerHTML = '<nav>Sidebar</nav><main>Content</main>';
    const rep = extractPageRep(document.body);
    const [nav, main] = rep.root.children!;
    expect(nav.hid).toMatch(/^h\d+$/);
    expect(main.hid).toMatch(/^h\d+$/);
    expect(nav.hid).not.toBe(main.hid);
    // The real element is tagged so [data-halo-id="…"] resolves to exactly it.
    expect(document.querySelector(`[data-halo-id="${nav.hid}"]`)!.textContent).toBe('Sidebar');
  });

  it('reuses an existing data-halo-id instead of reassigning', () => {
    document.body.innerHTML = '<div data-halo-id="keep">x</div>';
    const rep = extractPageRep(document.body);
    expect(rep.root.children![0].hid).toBe('keep');
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
