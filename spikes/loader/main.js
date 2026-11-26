// The loader spike harness (docs/platform/06-loader-spike.md). A bare Electron app, separate from the product: it serves
// a throwaway pack and the host's PixiJS from `scene://spike/` under the CSP of docs/platform/02 section 3, runs the
// checks inside the page, and then tries WebRTC under four mitigations against a UDP listener in this process.
// Start it with `npm run spike:loader` (spikes/loader/run.mjs builds PixiJS first and passes --bundle=<folder>).
import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const bundleDir = process.argv
  .find((arg) => arg.startsWith('--bundle='))
  ?.slice('--bundle='.length);
if (!bundleDir) throw new Error('missing --bundle=<folder with pixi.js>');
// Never touch a real data folder: run.mjs makes a temporary one and removes it when this app has ended.
const dataDir = process.argv.find((arg) => arg.startsWith('--data='))?.slice('--data='.length);
app.setPath(
  'userData',
  dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-spike-data-')),
);

// Privileged before the app is ready (docs/platform/01 section 8.6): `standard` and `secure` give the page a real
// origin (scene://spike) and let `script-src 'self'` match it; `supportFetchAPI` lets the page fetch its own files.
protocol.registerSchemesAsPrivileged([
  { scheme: 'scene', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// The host page. The import map is inline, so its SHA-256 goes into script-src.
const importMap = JSON.stringify({ imports: { 'pixi.js': 'scene://spike/_host/pixi.js' } });
const mapHash = crypto.createHash('sha256').update(importMap).digest('base64');
const page = `<!doctype html><html><head><meta charset="utf-8"><title>spike</title><script type="importmap">${importMap}</script></head><body><div id="stage"></div><script type="module" src="/_host/runtime.js"></script></body></html>`;
const CSP = [
  "default-src 'none'",
  `script-src 'self' 'sha256-${mapHash}'`,
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const packDir = path.join(here, 'pack');
const answer = (body, type) =>
  new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
    },
  });
const refuse = () => new Response('not found', { status: 404 });

/** The scene protocol: the host page, the host's files under /_host/, and the pack folder. Nothing outside them. */
function serve(request) {
  const url = new URL(request.url);
  if (url.host !== 'spike') return refuse();
  const rel = decodeURIComponent(url.pathname);
  if (rel === '/') return answer(page, 'text/html');
  const [dir, name] = rel.startsWith('/_host/')
    ? [rel === '/_host/runtime.js' ? here : bundleDir, rel.slice('/_host/'.length)]
    : [packDir, rel.slice(1)];
  const target = path.resolve(dir, name);
  const type = TYPES[path.extname(target)];
  if (!type || !target.startsWith(dir + path.sep) || !fs.existsSync(target)) return refuse();
  return answer(fs.readFileSync(target), type);
}

// A UDP listener: a datagram that reaches it came out of a page's WebRTC.
let datagrams = 0;
let pageCount = 0;
const listener = dgram.createSocket('udp4');
listener.on('message', () => datagrams++);
await new Promise((resolve) => listener.bind(0, '0.0.0.0', resolve));
const port = listener.address().port;
const lan = Object.values(os.networkInterfaces())
  .flat()
  .find((entry) => entry && entry.family === 'IPv4' && !entry.internal)?.address;
const stunServers = [`127.0.0.1:${port}`, ...(lan ? [`${lan}:${port}`] : [])];

/** Opens a page in its own session, waits for what it reports (or 20 s), closes it. */
async function runPage(name, query, { strip = false, policy = false, proxy = false } = {}) {
  const ses = session.fromPartition(`spike${++pageCount}`);
  ses.protocol.handle('scene', serve);
  if (proxy) {
    // A proxy that refuses every connection: the scene's session needs no network at all.
    await ses.setProxy({ proxyRules: 'socks5://127.0.0.1:9', proxyBypassRules: '<-loopback>' });
  }
  const win = new BrowserWindow({
    width: 360,
    height: 240,
    title: `spike ${name}`,
    webPreferences: {
      session: ses,
      preload: path.join(here, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--spike-strip=${strip ? 1 : 0}`],
    },
  });
  if (policy) win.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  const before = datagrams;
  const reported = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ failed: 'no report within 20 s' }), 20_000);
    const onResult = (event, text) => {
      if (event.sender !== win.webContents) return;
      clearTimeout(timer);
      ipcMain.removeListener('spike:result', onResult);
      resolve(JSON.parse(text));
    };
    ipcMain.on('spike:result', onResult);
  });
  // A page that reports and is gone before the load call returns can reject it; the report is what counts.
  win
    .loadURL(`scene://spike/?${query}`)
    .catch((error) => console.log(`(load ${name}: ${error.message})`));
  const result = await reported;
  // Datagrams can arrive a moment after the page has reported.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const sent = datagrams - before;
  win.destroy();
  return { result, sent };
}

// Windows are closed between the pages; the harness ends itself (app.exit below).
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const lines = [];
  let failed = false;
  const say = (text) => {
    lines.push(text);
    console.log(text);
  };

  say('== Loader checks (page from scene://spike/, host PixiJS, strict CSP)');
  const structural = await runPage('structural', 'case=structural');
  if (structural.result.failed) {
    failed = true;
    say(`FAIL the page did not report: ${structural.result.failed}`);
  }
  for (const check of structural.result.checks ?? []) {
    const label = check.ok ? 'ok  ' : check.required ? 'FAIL' : 'info';
    if (!check.ok && check.required) failed = true;
    say(`${label} ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  }

  say('');
  say(
    `== WebRTC: a page opens an RTCPeerConnection with STUN servers at ${stunServers.join(', ')} (this process listens)`,
  );
  const cases = [
    ['a_no_mitigation', {}],
    ['b_constructors_removed', { strip: true }],
    ['c_policy_disable_non_proxied_udp', { policy: true }],
    ['d_policy_and_refusing_proxy', { policy: true, proxy: true }],
  ];
  let baselineLeaks = false;
  for (const [name, options] of cases) {
    const { result, sent } = await runPage(name, `stun=${stunServers.join(',')}`, options);
    if (name.startsWith('a_') && sent > 0) baselineLeaks = true;
    const verdict = sent > 0 ? 'LEAK (datagrams arrived)' : 'blocked (no datagram)';
    const detail = result.failed
      ? result.failed
      : `constructor ${result.exists ? 'present' : 'removed'}, gathering ${result.gathering ?? 'n/a'}, candidates ${(result.candidates ?? []).join('/') || 'none'}${result.error ? `, error ${result.error}` : ''}`;
    say(`${verdict.padEnd(26)} ${name}: ${detail}; ${sent} datagram(s)`);
  }
  say(
    baselineLeaks
      ? 'The baseline leaks, so "blocked" in the other cases is a real result.'
      : 'NOTE: the baseline sent nothing either, so this test cannot show that a mitigation works.',
  );
  say('');
  say(failed ? 'RESULT: a required check failed' : 'RESULT: all required checks passed');
  const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
  if (out) fs.writeFileSync(out, `${lines.join('\n')}\n`);
  listener.close();
  app.exit(failed ? 1 : 0);
});
