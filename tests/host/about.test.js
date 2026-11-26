import { describe, expect, it } from 'vitest';
import { aboutHtml, aboutStaysOnTop, escapeHtml } from '../../app/main/about.js';

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

  it('sets its own colours for a light and a dark system theme, so the text never matches the window background', () => {
    expect(aboutHtml(content)).toMatch(/background: #ffffff; color: #1a1a1a/);
    expect(aboutHtml({ ...content, dark: true })).toMatch(/background: #1e1e1e; color: #f0f0f0/);
    expect(aboutHtml({ ...content, dark: true })).toContain('color-scheme: dark');
  });

  it('escapes the five characters that matter in a page', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('the About window and an always-on-top window', () => {
  const win = (onTop, destroyed = false) => ({
    isAlwaysOnTop: () => onTop,
    isDestroyed: () => destroyed,
  });

  it('stays on top when another window is always on top', () => {
    expect(aboutStaysOnTop([win(false), win(true)])).toBe(true);
  });

  it('does not, when none is, or when the only one is a destroyed window or About itself', () => {
    const about = win(true);
    expect(aboutStaysOnTop([])).toBe(false);
    expect(aboutStaysOnTop([win(false)])).toBe(false);
    expect(aboutStaysOnTop([win(true, true)])).toBe(false);
    expect(aboutStaysOnTop([about, win(false)], about)).toBe(false);
  });
});
