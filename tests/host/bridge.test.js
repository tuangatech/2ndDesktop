import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The bridge is what a page can call (docs/platform/02 section 4: "a bridge that is harmless when abused"). A new
// function here is a decision, so it has to be added to this list on purpose, with a review.
const BRIDGE = [
  'getAppInfo',
  'getSettings',
  'keepRecordCopy',
  'loadRecord',
  'onAction',
  'onMenuRequest',
  'onPause',
  'onPointer',
  'onSettingsChanged',
  'openMenu',
  'reportActivity',
  'reportError',
  'reportFps',
  'reportNote',
  'reportReady',
  'reportVisibility',
  'saveRecord',
  'windowClose',
  'windowMinimize',
];

const root = path.join(import.meta.dirname, '..', '..');
const preload = fs.readFileSync(path.join(root, 'app', 'main', 'preload.cjs'), 'utf8');
const main = fs.readFileSync(path.join(root, 'app', 'main', 'main.js'), 'utf8');
const all = (text, pattern) => [...text.matchAll(pattern)].map((match) => match[1]);

describe('the bridge between the page and the main process', () => {
  it('exposes exactly the functions of the list, and nothing else', () => {
    expect(all(preload, /^ {2}(\w+):/gm).sort()).toEqual(BRIDGE);
  });

  it('never hands the page ipcRenderer, and has no call that names a scene', () => {
    const exposed = preload.slice(preload.indexOf('exposeInMainWorld'));
    expect(exposed).not.toMatch(/^ {2}ipcRenderer:/m);
    expect(BRIDGE.some((name) => /scene/i.test(name))).toBe(false);
  });

  it('uses exactly the channels that the main process answers', () => {
    const fromPage = [...new Set(all(preload, /ipcRenderer\.(?:send|invoke)\('([^']+)'/g))];
    const inMain = [...new Set(all(main, /ipcMain\.(?:on|handle)\(\s*'([^']+)'/g))];
    expect(inMain.sort()).toEqual(fromPage.sort());
  });
});
