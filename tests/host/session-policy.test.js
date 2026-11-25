import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequestFilter } from '../../app/main/session-policy.js';

const rendererDir = path.join(path.sep, 'app', 'dist', 'renderer');

describe('createRequestFilter', () => {
  const allow = createRequestFilter({ rendererDir });

  it('allows the files of the built page, with a query', () => {
    expect(allow('file:///app/dist/renderer/index.html?mode=window')).toBe(true);
    expect(allow('file:///app/dist/renderer/assets/index-abc.js')).toBe(true);
  });

  it('refuses other files, also by .. and by a folder with the same start', () => {
    expect(allow('file:///etc/passwd')).toBe(false);
    expect(allow('file:///app/dist/renderer/../../secret.json')).toBe(false);
    expect(allow('file:///app/dist/renderer/%2e%2e/%2e%2e/secret.json')).toBe(false);
    expect(allow('file:///app/dist/renderer-old/index.html')).toBe(false);
  });

  it('allows data and blob addresses (images and sounds made in the page)', () => {
    expect(allow('data:image/png;base64,AAAA')).toBe(true);
    expect(allow('blob:file:///0a1b2c')).toBe(true);
  });

  it('refuses the network and other schemes', () => {
    for (const url of [
      'https://example.org/x',
      'http://localhost:5173/',
      'ws://localhost:5173/',
      'ftp://example.org/',
      'devtools://devtools/bundled/x.js',
      'chrome-extension://abc/x.js',
      'not a url',
    ]) {
      expect(allow(url)).toBe(false);
    }
  });

  it('allows the dev server and its socket only in a development run', () => {
    const dev = createRequestFilter({ rendererDir, devUrl: 'http://localhost:5173' });
    expect(dev('http://localhost:5173/main.js')).toBe(true);
    expect(dev('ws://localhost:5173/')).toBe(true);
    expect(dev('http://localhost:5174/')).toBe(false);
    expect(dev('https://example.org/')).toBe(false);
    expect(dev('devtools://devtools/bundled/x.js')).toBe(true);
  });

  it('ignores case on Windows', () => {
    const win = createRequestFilter({ rendererDir, caseInsensitive: true });
    expect(win('file:///APP/Dist/Renderer/index.html')).toBe(true);
    expect(allow('file:///APP/Dist/Renderer/index.html')).toBe(false);
  });
});
