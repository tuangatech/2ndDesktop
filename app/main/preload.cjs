'use strict';
// CommonJS on purpose: sandboxed preload scripts cannot be ES modules.
// Only a fixed list of functions is exposed. The renderer never gets ipcRenderer itself.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop2', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowClose: () => ipcRenderer.send('window:close'),
  openMenu: () => ipcRenderer.send('menu:open'),
  reportVisibility: (state) => ipcRenderer.send('diag:visibility', String(state)),
  reportFps: (fps) => ipcRenderer.send('diag:fps', Number(fps)),
  reportError: (text) => ipcRenderer.send('diag:error', String(text).slice(0, 2000)),
  // The tank is built and running; the main process counts 10 stable seconds before it trusts a desktop attach.
  reportReady: (info) => ipcRenderer.send('scene:ready', { name: String(info?.name ?? '') }),
  // A click or key press in the window (the usage log counts minutes with activity, NFR-7).
  reportActivity: () => ipcRenderer.send('diag:activity'),
  reportNote: (text) => ipcRenderer.send('diag:note', String(text).slice(0, 2000)),
  // The scene the page runs, said once by the host part of the page before any scene code is loaded. The records below
  // are always those of that scene: the main process ignores any other id (docs/platform/02 section 4).
  bindScene: (id) => ipcRenderer.send('scene:bind', String(id)),
  // The saved progress of the scene, one record per scene id (docs/03-platform-design.md section 5).
  loadRecord: () => ipcRenderer.invoke('record:load'),
  saveRecord: (record) => ipcRenderer.send('record:save', record),
  // Keeps a record that had to be repaired or replaced next to it (the main process names the file).
  keepRecordCopy: (record) => ipcRenderer.send('record:keep-copy', record),
  // Tray menu: the main process asks for the scene's lines and items before it opens the menu, and forwards the chosen id.
  onMenuRequest: (callback) => {
    ipcRenderer.on('scene:menu-request', () => ipcRenderer.send('scene:menu', callback()));
  },
  // Desktop mode: the pointer position in tank coordinates, or null when it is not over the tank.
  onPointer: (callback) => {
    ipcRenderer.on('pointer:pos', (_event, point) => callback(point));
  },
  onAction: (callback) => {
    ipcRenderer.on('scene:action', (_event, id) => callback(String(id)));
  },
  // The settings the renderer needs (the sound switch); the menus in the main process change them.
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings:changed', (_event, settings) => callback(settings));
  },
  onPause: (callback) => {
    ipcRenderer.on('scene:pause', (_event, paused) => callback(Boolean(paused)));
  },
});
