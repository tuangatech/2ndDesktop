import { describe, expect, it, vi } from 'vitest';
import { buildAppMenuTemplate, buildTrayTemplate, sanitizeSceneMenu } from '../../app/main/menu.js';
import { menuItems, statusLine } from '../../scenes/fishtank/menu.js';

const base = {
  waiting: 3,
  stash: 5,
  stashFull: false,
  hungry: 2,
  fishCount: 2,
  eggs: 0,
  eggReady: false,
  allFull: false,
  feeding: false,
};
// What the tank reports for a summary, cleaned the way the main process cleans it, then the tray template.
const tankMenu = (summary) =>
  sanitizeSceneMenu({ name: 'Tank', line: statusLine(summary), items: menuItems(summary) });
const tray = (summary, settings, note, h) =>
  buildTrayTemplate(summary && tankMenu(summary), settings, note, h);
const handlers = () => ({ action: vi.fn(), setMode: vi.fn(), quit: vi.fn() });
const labels = (items) => items.filter((i) => i.type !== 'separator').map((i) => i.label);
const find = (items, label) => items.find((i) => i.label === label);

describe('statusLine', () => {
  it('lists what is waiting, in the stash and hungry', () => {
    expect(statusLine(base)).toBe('3 pellets waiting · 5 in the stash · 2 hungry');
    expect(statusLine({ ...base, waiting: 1 })).toBe(
      '1 pellet waiting · 5 in the stash · 2 hungry',
    );
    expect(statusLine({ ...base, waiting: 0 })).toBe('5 in the stash · 2 hungry');
  });

  it('does not repeat the full-and-happy message of the feeding item when nothing is left to do', () => {
    expect(statusLine({ ...base, waiting: 0, stash: 0, hungry: 0, allFull: true })).toBe(
      'Nothing to do right now',
    );
  });
});

describe('the tray template with the items of the tank', () => {
  it('has the normal items when there is something to do', () => {
    const items = tray(base, { mode: 'desktop' }, null, handlers());
    expect(labels(items)).toEqual([
      '3 pellets waiting · 5 in the stash · 2 hungry',
      'Collect pellets',
      'Feed a pellet',
      'Feed until full',
      'Show in a window',
      'Launch at login',
      'Sound',
      'Copy diagnostics',
      'About 2ndDesktop',
      'Quit',
    ]);
  });

  it('sends each action through the handlers', () => {
    const h = handlers();
    const items = tray(base, { mode: 'window' }, null, h);
    find(items, 'Collect pellets').click();
    find(items, 'Feed a pellet').click();
    find(items, 'Feed until full').click();
    find(items, 'Show on desktop').click();
    find(items, 'Quit').click();
    expect(h.action.mock.calls.map((c) => c[0])).toEqual(['collect', 'feed', 'feedUntilFull']);
    expect(h.setMode).toHaveBeenCalledWith('desktop');
    expect(h.quit).toHaveBeenCalled();
  });

  it('greys collecting with the reason', () => {
    const full = tray({ ...base, stashFull: true }, { mode: 'window' }, null, handlers());
    expect(find(full, 'Stash is full').enabled).toBe(false);
    const none = tray({ ...base, waiting: 0 }, { mode: 'window' }, null, handlers());
    expect(find(none, 'No pellets waiting').enabled).toBe(false);
  });

  it('greys feeding with the reason: everyone full, or an empty stash', () => {
    const full = tray({ ...base, hungry: 0, allFull: true }, { mode: 'window' }, null, handlers());
    expect(find(full, 'Everyone is full and happy').enabled).toBe(false);
    expect(find(full, 'Feed a pellet')).toBeUndefined();
    const empty = tray({ ...base, stash: 0 }, { mode: 'window' }, null, handlers());
    expect(find(empty, 'No pellets in the stash').enabled).toBe(false);
    expect(find(empty, 'Feed until full')).toBeUndefined();
  });

  it('offers Stop feeding instead of Feed until full while the loop runs', () => {
    const h = handlers();
    const items = tray({ ...base, feeding: true }, { mode: 'window' }, null, h);
    expect(find(items, 'Feed until full')).toBeUndefined();
    find(items, 'Stop feeding').click();
    expect(h.action).toHaveBeenCalledWith('stopFeeding');
  });

  it('still offers Stop feeding when the loop has just made everyone full', () => {
    const items = tray(
      { ...base, hungry: 0, allFull: true, feeding: true },
      { mode: 'window' },
      null,
      handlers(),
    );
    expect(find(items, 'Stop feeding')).toBeDefined();
  });

  it('shows Hatch egg only while an egg is waiting', () => {
    expect(find(tray(base, { mode: 'window' }, null, handlers()), 'Hatch egg')).toBeUndefined();
    const h = handlers();
    const items = tray({ ...base, eggs: 1, eggReady: true }, { mode: 'window' }, null, h);
    find(items, 'Hatch egg').click();
    expect(h.action).toHaveBeenCalledWith('hatch');
    const crowded = tray(
      { ...base, eggs: 1, eggReady: false },
      { mode: 'window' },
      null,
      handlers(),
    );
    expect(find(crowded, 'Hatch egg')).toBeUndefined();
    expect(find(crowded, 'An egg is waiting (the tank is full)').enabled).toBe(false);
  });

  it('shows the note under the status line', () => {
    const items = tray(base, { mode: 'window' }, "Couldn't show on the desktop", handlers());
    expect(labels(items)[1]).toBe("Couldn't show on the desktop");
  });

  it('still has the mode switch and Quit when the scene has not answered', () => {
    const items = tray(null, { mode: 'window' }, null, handlers());
    expect(labels(items)).toContain('Show on desktop');
    expect(labels(items)).toContain('Quit');
    expect(find(items, 'Collect pellets')).toBeUndefined(); // nothing from the scene: the host's items only
    expect(labels(items)[0]).toBe('2ndDesktop');
  });
});

describe('the all-full menu', () => {
  it('shows "Everyone is full and happy" only once', () => {
    const items = tray(
      { ...base, waiting: 0, stash: 0, hungry: 0, allFull: true },
      { mode: 'window' },
      null,
      handlers(),
    );
    expect(items.filter((i) => i.label === 'Everyone is full and happy')).toHaveLength(1);
  });
});

describe('the settings items (FR-36)', () => {
  const build = (settings, extra = {}) => tray(base, settings, null, { ...handlers(), ...extra });

  it('lists Always on top, Launch at login, Sound, Copy diagnostics and About, between the mode switch and Quit', () => {
    const names = labels(build({ mode: 'window', canLaunchAtLogin: true }));
    for (const name of [
      'Always on top',
      'Launch at login',
      'Sound',
      'Copy diagnostics',
      'About 2ndDesktop',
    ]) {
      expect(names).toContain(name);
    }
    expect(names.indexOf('Show on desktop')).toBeLessThan(names.indexOf('Always on top'));
    expect(names.indexOf('About 2ndDesktop')).toBeLessThan(names.indexOf('Quit'));
  });

  it('has no Always on top in desktop mode (FR-20)', () => {
    const names = labels(build({ mode: 'desktop' }));
    expect(names).not.toContain('Always on top');
    expect(names).toContain('Sound');
  });

  it('shows the current values as checkboxes', () => {
    const items = build({
      mode: 'window',
      alwaysOnTop: true,
      sound: false,
      launchAtLogin: true,
      canLaunchAtLogin: true,
    });
    expect(find(items, 'Always on top').type).toBe('checkbox');
    expect(find(items, 'Always on top').checked).toBe(true);
    expect(find(items, 'Sound').checked).toBe(false);
    expect(find(items, 'Launch at login').checked).toBe(true);
  });

  it('has sound on unless it was switched off', () => {
    expect(find(build({ mode: 'window' }), 'Sound').checked).toBe(true);
  });

  it('sends the new value to setSetting', () => {
    const calls = [];
    const items = build(
      { mode: 'window', canLaunchAtLogin: true },
      { setSetting: (key, value) => calls.push([key, value]) },
    );
    find(items, 'Always on top').click({ checked: true });
    find(items, 'Sound').click({ checked: false });
    find(items, 'Launch at login').click({ checked: true });
    expect(calls).toEqual([
      ['alwaysOnTop', true],
      ['sound', false],
      ['launchAtLogin', true],
    ]);
  });

  it('greys Launch at login in a development run (only an installed app registers itself)', () => {
    const item = build({ mode: 'window', canLaunchAtLogin: false }).find((i) =>
      i.label?.startsWith('Launch at login'),
    );
    expect(item.enabled).toBe(false);
    expect(item.label).toContain('installed app only');
  });

  it('says Copied for a moment after Copy diagnostics', () => {
    const names = labels(build({ mode: 'window', copied: true }));
    expect(names).toContain('Copied');
    expect(names).not.toContain('Copy diagnostics');
  });

  it('calls the handlers for Copy diagnostics and About', () => {
    const calls = [];
    const items = build(
      { mode: 'window' },
      { copyDiagnostics: () => calls.push('copy'), about: () => calls.push('about') },
    );
    find(items, 'Copy diagnostics').click();
    find(items, 'About 2ndDesktop').click();
    expect(calls).toEqual(['copy', 'about']);
  });
});

describe('buildAppMenuTemplate (the macOS menu bar)', () => {
  const app = (settings = { mode: 'window' }, handlers = {}, options) =>
    buildAppMenuTemplate(settings, { setMode: vi.fn(), ...handlers }, options);
  const menu = (template, name) => template.find((m) => m.label === name).submenu;

  it('has the application, scene and Window menus, and nothing else', () => {
    expect(app().map((m) => m.label)).toEqual(['2ndDesktop', 'Scene', 'Window']);
    expect(app(undefined, {}, { sceneName: 'Tank' }).map((m) => m.label)).toEqual([
      '2ndDesktop',
      'Tank',
      'Window',
    ]);
  });

  it('gives the application menu About, Hide and Quit (Cmd+Q comes from the quit role)', () => {
    const items = menu(app(), '2ndDesktop');
    expect(items.map((i) => i.role ?? i.label).filter(Boolean)).toEqual([
      'About 2ndDesktop',
      'hide',
      'hideOthers',
      'unhide',
      'quit',
    ]);
  });

  it('gives the Window menu Minimize and Close (Cmd+M and Cmd+W come from the roles)', () => {
    expect(menu(app(), 'Window').map((i) => i.role)).toEqual(['minimize', 'close']);
  });

  it('puts the mode switch and the shared settings in the scene menu, with About only once', () => {
    const items = menu(app({ mode: 'window', sound: true }), 'Scene');
    const names = labels(items);
    expect(names).toEqual([
      'Show on desktop',
      'Always on top',
      'Launch at login',
      'Sound',
      'Copy diagnostics',
    ]);
    expect(labels(menu(app({ mode: 'desktop' }), 'Scene'))[0]).toBe('Show in a window');
  });

  it('calls the handlers', () => {
    const calls = [];
    const template = app(
      { mode: 'window' },
      {
        setMode: (mode) => calls.push(mode),
        about: () => calls.push('about'),
        copyDiagnostics: () => calls.push('copy'),
      },
    );
    find(menu(template, '2ndDesktop'), 'About 2ndDesktop').click();
    find(menu(template, 'Scene'), 'Show on desktop').click();
    find(menu(template, 'Scene'), 'Copy diagnostics').click();
    expect(calls).toEqual(['about', 'desktop', 'copy']);
  });

  it('adds Reload and Developer Tools only in a development run', () => {
    expect(app().some((m) => m.label === 'Developer')).toBe(false);
    const dev = app({ mode: 'window' }, {}, { dev: true });
    expect(menu(dev, 'Developer').map((i) => i.role)).toEqual(['reload', 'toggleDevTools']);
  });

  it('is built from the same list as the tray menu, so a new setting appears in both', () => {
    const trayLabels = labels(tray(base, { mode: 'window' }, null, handlers()));
    for (const name of labels(menu(app(), 'Scene')).slice(1)) expect(trayLabels).toContain(name);
  });
});

describe('sanitizeSceneMenu (what the main process lets through from a scene)', () => {
  it('keeps a good menu', () => {
    const menu = sanitizeSceneMenu({
      name: 'Tank',
      line: '2 hungry',
      diagnostics: 'Fish: 2',
      items: [{ id: 'feed', label: 'Feed a pellet' }, { label: 'Everyone is full' }],
    });
    expect(menu).toEqual({
      name: 'Tank',
      line: '2 hungry',
      diagnostics: 'Fish: 2',
      items: [
        { id: 'feed', label: 'Feed a pellet', enabled: true },
        { label: 'Everyone is full', enabled: false },
      ],
    });
  });

  it('cuts labels to 60 plain characters and drops items without a label', () => {
    const menu = sanitizeSceneMenu({
      items: [
        { id: 'a', label: 'x'.repeat(100) },
        { id: 'b', label: '' },
        { id: 'c', label: 'two\nlines' },
        7,
        null,
      ],
    });
    expect(menu.items.map((i) => i.label)).toEqual(['x'.repeat(60), 'two lines']);
  });

  it('drops ids of an odd shape, so the item cannot be chosen', () => {
    const menu = sanitizeSceneMenu({
      items: [
        { id: '../x', label: 'one' },
        { id: 'a'.repeat(41), label: 'two' },
        { id: 3, label: 'three' },
      ],
    });
    expect(menu.items.every((i) => i.id === undefined && i.enabled === false)).toBe(true);
  });

  it('allows at most 12 items and ignores a greyed flag only for items with an id', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: 'a' + i, label: 'item ' + i }));
    expect(sanitizeSceneMenu({ items }).items).toHaveLength(12);
    expect(
      sanitizeSceneMenu({ items: [{ id: 'a', label: 'grey', enabled: false }] }).items[0].enabled,
    ).toBe(false);
  });

  it('returns null for something that is not a menu and survives wrong types', () => {
    expect(sanitizeSceneMenu(null)).toBeNull();
    expect(sanitizeSceneMenu('menu')).toBeNull();
    expect(sanitizeSceneMenu({ items: 'no', line: 5, name: {} })).toEqual({
      name: 'Scene',
      line: null,
      diagnostics: null,
      items: [],
    });
  });
});
