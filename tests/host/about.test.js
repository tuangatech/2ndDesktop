import { describe, expect, it } from 'vitest';
import { aboutHtml, escapeHtml } from '../../app/main/about.js';

const content = {
  name: '2ndDesktop',
  version: '0.0.1',
  iconUrl: 'data:image/png;base64,AAAA',
  paragraphs: ['First line.', 'Second <b>part</b> & more.', 'Path: C:\\Users\\<you>\\data'],
};

describe('the About page', () => {
  it('puts the name, then the version, then every paragraph in order', () => {
    const html = aboutHtml(content);
    const at = ['<h1>2ndDesktop</h1>', 'Version 0.0.1', 'First line.', 'Second', 'Path:'].map((s) =>
      html.indexOf(s),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('keeps the version out of the paragraphs and in the header', () => {
    const html = aboutHtml(content);
    expect(html.indexOf('Version 0.0.1')).toBeLessThan(html.indexOf('</header>'));
    expect(html.indexOf('First line.')).toBeGreaterThan(html.indexOf('</header>'));
  });

  it('escapes the text, and has no script and no link', () => {
    const html = aboutHtml(content);
    expect(html).toContain('Second &lt;b&gt;part&lt;/b&gt; &amp; more.');
    expect(html).not.toContain('<b>');
    expect(html).not.toMatch(/<script|<a\s|href=/i);
    expect(html).toContain("default-src 'none'");
  });

  it('escapes the five characters that matter in a page', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
