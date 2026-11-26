# The loader spike (P1, BOOTSTRAP step 7)

Measured on **Windows 11, Electron 45.4.1, PixiJS 8.23.0, 2026-11-26** with `npm run spike:loader` (`spikes/loader/`). The Mac run is asked in `TODO-Mac.md` (W-11). The spike is a separate throwaway Electron app: it touches nothing in `app/`, and it is not part of `npm test` or CI (it opens a few small windows and a UDP socket).

It answers the two questions that `01` section 8.6 and `02` section 3 left open before the registry work: can the host serve a scene's page from `scene://<id>/` with **its own copy of PixiJS** under the **real CSP**, and can a scene page still open **WebRTC** after our mitigations.

## What the harness does

- Registers `scene` as a privileged scheme (`standard`, `secure`, `supportFetchAPI`) before the app is ready, and serves three things from `scene://spike/`: the host page (with an inline import map), the host's files under `/_host/` (the runtime and one PixiJS file), and a throwaway pack folder. The handler refuses `..`, unknown types and anything outside those folders.
- The host's PixiJS is one ES file built with Vite from `pixi.js/unsafe-eval` plus `export * from 'pixi.js'` (`spikes/loader/pixi-entry.js`). The import map points `pixi.js` at it, so the host's runtime and the pack's `import { Container, Graphics } from 'pixi.js'` get the same module.
- The CSP is the header of `02` section 3, with one addition: the SHA-256 of the inline import map in `script-src`.
- WebRTC: a UDP socket in the main process; a page creates an `RTCPeerConnection` with STUN servers at the loopback address and at the computer's LAN address (this socket), a data channel and an offer. A datagram at the socket means the page can send data out through WebRTC.

## Results

### The loader and the CSP (all pass)

| Check | Result |
| --- | --- |
| The page's origin is `scene://spike`, and `script-src 'self'` matches it | pass |
| The pack's module (`import('/index.js')`) loads from the scheme | pass |
| An inline import map allowed by a hash in `script-src` | pass |
| **One copy of PixiJS**: the pack's `Container` is the host's `Container`, and `instanceof` holds across | pass |
| The pack's scene draws with the host's PixiJS (WebGL, a red pixel read back) under `pixi.js/unsafe-eval` | pass |
| `new Function(...)` is blocked (no `unsafe-eval`) | pass |
| No `style-src 'self'` violation (PixiJS sets the canvas size through the DOM, not through `style=` attributes) | pass |
| A `fetch` to another origin and an `import()` from a URL are refused | pass |
| `localStorage` works in the per-scene origin | info: works |

### One thing the CSP of `02` gets wrong

**`connect-src 'none'` also stops the page loading its own files with `fetch`** (information check: the fetch of the pack's `asset.json` was refused). PixiJS loads textures and JSON through `fetch`, so a scene's art would not load. The page today uses `connect-src 'self'` (`app/page/index.html`), which is what the loader needs: only the scene's own origin is allowed, every other origin is still refused (the check above). Recommendation: change `02` section 3 to `connect-src 'self'` and keep the rest.

### WebRTC (the hole is real, and three mitigations close it here)

A CSP does not govern WebRTC, and the baseline shows it: **5 datagrams arrived** at the listener from a page with `connect-src` limited and no mitigation.

| Case | Mitigation | Datagrams | What the page saw |
| --- | --- | --- | --- |
| a | none | **5 (leak)** | constructor present, host candidates gathered |
| b | `RTCPeerConnection`, `webkitRTCPeerConnection` and `RTCDataChannel` removed from the page's world by the preload (`webFrame.executeJavaScript`) before its scripts run | 0 | constructor removed |
| c | `webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')` | 0 | constructor present, gathering completes with **no candidate at all** |
| d | c plus a session proxy that refuses every connection (`socks5://127.0.0.1:9`, loopback not bypassed) | 0 | same as c |

Because the baseline leaks, the zeros are real results and not a test that cannot see anything.

## What it means for the design (recommendations; the owner decides)

1. **Load scenes from `scene://<id>/` with a host-provided PixiJS through an import map.** It works as `01` section 8.6 recommends; authors write ordinary imports and the pack tool marks `pixi.js` external. The `host.pixi` alternative is not needed. The PixiJS major version stays part of `apiVersion`.
2. **The import map must be inline, so the page's `script-src` carries its hash.** The host builds the page, so it computes the hash when it builds the map. A scene cannot add its own inline script.
3. **Change the CSP to `connect-src 'self'`** (see above).
4. **Use two WebRTC mitigations together:** `disable_non_proxied_udp` on every scene web contents (case c: no ICE candidates, so no peer can be reached) **and** the constructors removed in the preload (case b), plus the session proxy that refuses everything (case d) where it costs nothing. Each alone closed the hole in this run; together they do not rely on one Chromium behaviour. The lint tripwire for the names (`02` section 3) stays a cheap third layer.
5. **`02` section 3 can drop "except WebRTC until the P1 spike passes"** once the Mac run agrees; the control for bundled and catalog scenes is then the three layers, not review alone.

## What this spike did not show

- It ran on Windows only. The Mac needs its own run: `protocol.registerSchemesAsPrivileged` with a desktop-type window (`type: 'desktop'`) and WebGL on Apple silicon were not measured.
- The removal in case b relies on the preload's `webFrame.executeJavaScript` finishing before the page's scripts. It did here on both full runs; it is not a documented guarantee, which is one reason to keep case c as well.
- Only UDP to a STUN server on this computer was tried. A real peer on the network was not (it needs a second computer); the policy of case c is documented by Chromium to stop all non-proxied UDP, and no candidate was produced.
- The page was not served by the real app: the app still loads a `file://` page built by Vite. Moving the bundled scenes to `scene://` is a later decision (`01` section 8.6: the store or the first outside scene); the harness only proves the loader works.
- Not measured: the cost in memory of an extra session or of the custom scheme.

## How to run it

```
npm run spike:loader
npm run spike:loader -- --out=report.txt
```

It builds PixiJS into a temporary folder, opens five small windows one after another (one for the loader checks, four for WebRTC), prints the table above, and exits 0 when every required check passed. The WebRTC lines are findings, not pass or fail: the line "The baseline leaks" must be present, otherwise the test cannot show that a mitigation works.
