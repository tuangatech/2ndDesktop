'use strict';
// CommonJS on purpose: sandboxed preload scripts cannot be ES modules.
// The harness bridge is one function (the page reports its results). With --spike-strip=1 the WebRTC constructors
// are removed from the page's own world before its scripts run: one of the mitigations the spike measures.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

if (process.argv.includes('--spike-strip=1')) {
  webFrame.executeJavaScript(
    `for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']) { try { delete window[name]; } catch {} }`,
  );
}

contextBridge.exposeInMainWorld('spike', {
  report: (data) => ipcRenderer.send('spike:result', JSON.stringify(data)),
});
