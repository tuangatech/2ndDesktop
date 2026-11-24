# Platform 2 of 5: Security, data sources and the network

Status: Draft v0.1, 2026-11-23, updated after the Mac review. Companion docs: `01-platform-architecture.md`, `03-distribution-and-roadmap.md`.

**Staging (owner, 2026-11-23, fifth round).** Versions 0.1 and 0.2 are the plan: the tank in the new repository, then the platform core and the farm house, fully offline. **Version 0.3 is next**: the signed public release of the two bundled scenes, with the app update check and the error report (`03`, section 6.1). Everything here that belongs to version 0.4 and later (live weather and the network, connectors, secrets, open contributions, session scenes, and the scene store and catalog, which are version 1.2) is **design notes**: written down so that the choices of 0.1 and 0.2 do not block it, and **not backlog** until its version starts and the event that unlocks it has happened. The contract stays v0 until the third scene has been written against it (`03`, section 6.1).

This document answers four questions: how a scene is kept from harming the computer, how scenes get data from the internet, where the player's secrets live, and what leaves the machine. The owner's wish **[owner]**: the platform has the network, so that scenes can show the real weather and season, the approximate place, and data from other services, and contributors can add more.

## 1. Threat model

What we protect: the computer and its files, the player's accounts and tokens, the player's private data (tasks, calendar), the player's privacy, the computer's resources (CPU, GPU, memory, battery), and the player's trust in what is drawn on their desktop.

Who we defend against:

| Who | What they might do |
| --- | --- |
| A scene author with bad intent | read files, call the operating system, send data out, run a miner, draw something misleading, crash the app |
| A good author with a bad dependency | the same, by accident or by a compromised package |
| A catalog publisher who is not who they say | replace a pack with a bad one after it was reviewed |
| Someone on the network | change a download or the catalog on the way |
| A scene that is allowed some data | pass it to a place it should not go |

Not defended against (stated plainly): a vulnerability in Chromium itself (we keep Electron up to date, with a daily update check that does not depend on the store, and keep the sandbox on, which is the defence; document 3, section 3.5); the player installing something that is not from the catalog by hand; a malicious operating system.

**A real example.** In 2026 attackers put malware into Wallpaper Engine's Steam Workshop: the "application wallpapers" were ordinary Windows programs, and the Workshop's open uploads gave them an audience; the developer removed that wallpaper type from the Workshop on 29 June 2026 ([BleepingComputer](https://www.bleepingcomputer.com/news/security/steam-workshop-abused-to-spread-malware-via-wallpaper-engine-app/), [PCGuide](https://www.pcguide.com/news/wallpaper-engine-puts-an-end-to-exe-wallpapers-after-malware-spreads-on-the-steam-workshop/)). Two lessons for us: a scene is **never** an executable, and the catalog is **curated**, not an open upload box.

## 2. Principles

1. **The main process is the security boundary.** It is the only trusted code that touches the operating system. Everything in the scene page, including the host's own loop, is untrusted. This is why scene code and host code can share one page: the page has no power that the main process does not hand out call by call.
2. **Deny by default.** A scene gets only the capabilities in its manifest, and the main process takes them from the verified manifest of the active scene, never from what the page says.
3. **A bridge that is harmless when abused.** Every call a page can make must be safe if a malicious scene makes it a thousand times with any arguments: validated, size-capped, rate-limited, scoped to the active scene. Anything privileged (quit, switch scene, change settings, open a link, download, install) is started only by the main process from the tray or a host UI page, never by a call from a scene page.
4. **Trusted and untrusted pages are different pages.** Settings, About, consent and the scene store are host pages with their own bridge; they never load scene code.
5. **Reviewed code, built by us.** What the player installs is built by the project's CI from reviewed source, signed, and checked by the app before it runs (document 3). Contributors never upload binaries.
6. **Defence in depth.** Each layer assumes the one before it failed.

## 3. The sandbox, concretely

The Electron security checklist says to enable the sandbox in every renderer, not to expose Electron APIs to untrusted content, to avoid `file://` in favour of custom protocols, to set a restrictive Content-Security-Policy, and to set the permission handlers ([Electron security guide](https://www.electronjs.org/docs/latest/tutorial/security)). The scene page follows all of it:

| Layer | Setting |
| --- | --- |
| Process | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, no `webview`, `webSecurity` on, no remote module, DevTools only in development builds |
| Bridge | `contextBridge` exposes one object, `host`, built from the list in section 4; no `ipcRenderer`, no raw channel names, no Node module |
| Files | **Proposed (the Mac's E-2; proven by the P1 loader spike, document 1, section 8.6):** the whole page is served from `scene://<id>/` (the active scene's pack folder), with the host's runtime at a reserved path (`scene://<id>/_host/`), so `script-src 'self'` allows the scene's module and the per-scene origin below is real; `app://` serves the host's own windows (settings, the store, consent). Both schemes are registered as privileged (`standard`, `secure`) before the app is ready. The handler resolves the path, refuses `..`, links and anything outside the folder, serves only allowed types with a fixed MIME type, no directory listing. No `file://` |
| CSP (response header on both protocols) | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'none'; worker-src 'self'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`. No `unsafe-eval`, no `unsafe-inline`, no `wasm-unsafe-eval` |
| PixiJS under a strict CSP | PixiJS 8 normally builds shader code with `new Function`; under a CSP without `unsafe-eval` the app imports `pixi.js/unsafe-eval` before the renderer starts (the polyfill). **Confirmed:** the fish-tank app already imports it first in `app/page/main.js`, with a CSP without `unsafe-eval`, and its end-to-end suite runs on both systems. The spike has only to check the new `style-src 'self'` (the old page allows `'unsafe-inline'`; the tank's HUD sets styles through the DOM and has no `style=` attributes, so it should pass) |
| Navigation | `will-navigate` cancels everything except the same URL; `setWindowOpenHandler` denies; no new windows from a page |
| Permissions | `setPermissionRequestHandler` and `setPermissionCheckHandler` deny everything (camera, microphone, location, clipboard, notifications, fullscreen, ...) for every session that loads a scene |
| Requests | `session.webRequest.onBeforeRequest` cancels any request that is not `app://` or `scene://` (and the dev server in development). All real network traffic is made by the main process, outside the page's session |
| Storage | Each scene has its own origin (`scene://<id>`), so `localStorage` and IndexedDB are separate; the host does not rely on them (records go through `host.record`); no service workers; downloads denied |
| Downloads and external links | Denied in the scene page; only a host page can open a link in the browser, after the player clicks |
| Extra | A scene bundle is one ES module plus assets; it cannot import from a URL (CSP) or from another scene |

Known gap, stated plainly: **a CSP does not govern WebRTC data channels**. A page with `connect-src 'none'` can still open an `RTCPeerConnection`, and attackers have used this to send data out ([Sansec](https://sansec.io/research/webrtc-skimmer); the W3C CSP discussion is [here](https://github.com/w3c/webappsec-csp/issues/92)). Candidate mitigations, each to be verified in a spike before we claim anything: remove `RTCPeerConnection` and friends in the main world before page scripts run (from the preload through `webFrame`), set `webrtcIPHandlingPolicy` to `disable_non_proxied_udp` together with a proxy for the scene session that refuses every connection (the scene session needs no network at all, because the main process makes the real requests), and a lint tripwire that refuses the names in scene source. Until the spike passes, the control for this hole is review (section 8), which is acceptable for the bundled and catalog tiers and not for open uploads.

What a scene can still do inside its sandbox, and the answer to each:

| Abuse | Answer |
| --- | --- |
| Burn CPU or GPU, leak memory | The watchdog (section 7); the contract test; the frame-rate cap; removal from the catalog |
| Draw a fake dialog on the desktop | In desktop mode the scene takes no clicks, so nothing can be typed or clicked; in window mode it is inside its own window; the host's real dialogs are separate windows with the app's frame |
| Read other scenes' data | Only the active scene is loaded; records are scoped by the main process; a switch reloads the page |
| Fingerprint the machine | No network, so nowhere to send it |
| Spend the player's time | Politeness rules are host-enforced: no focus, no notifications, no sound on its own |

## 4. What the bridge exposes

All of it lives behind `host` in the scene page (document 1, section 8). Each call is checked by the main process.

| Call | Check | Capability |
| --- | --- | --- |
| `ready()`, `log(level, text)` | log rate-limited (20 lines per second), 300 characters, control characters removed | none |
| `record.load()`, `record.save(state)` | the path is chosen by the main process from the active scene id; JSON only; at most 1 MB; at most one write per second | none |
| `status()` and `menuItems()`, answered when the host asks as the menu opens (nothing is pushed; document 1, section 10.1) | plain text, at most 60 characters per label, at most 12 items, ids are opaque strings; the main process remembers the ids it offered | none |
| `assets.load(path)` | inside the scene's own folder only | none |
| `data.get(kind)` and updates | only kinds in the manifest | `data` |
| `place.get()` | only coarse values | `place` |
| `net.request(name, params)` | only a name declared in the manifest, only its declared host, document section 6 | `net` |
| `ui.prompt(text)` | a host dialog; the answer is one line of text | `ui` |
| `sound.play(name)` | only a sound from the scene's assets, only after a player action the host saw (enforced by the main process, section 7) | `sound` |
| Inbound events | pause, resume, resize, pointer, menu id, data, option | none |

Nothing in the bridge reaches the operating system, a file outside the scene's folder, or a token.

## 5. Capabilities and consent

The manifest lists capabilities (document 1, section 8.2). Rules:

- **The exfiltration rule.** A scene may not hold both a **private data kind** (`tasks`, `events`, anything from a source with a token, and **`place`** with anything derived from it: a `net` host could send the player's location to the author's server; the Mac's E-6) and a free `net` capability. Manifest validation refuses the pair. Private data can reach only the scene, and the scene can reach only the host.
- **Consent is per scene and in plain words.** The first time a scene is activated, a host dialog lists what it asks for ("Show the weather for your area", "Use the approximate place you chose", "Show the first three tasks from your task source") and what leaves the computer. The answer is saved per scene. If an update changes the capabilities, the player is asked again. A scene with no capabilities (the fish tank) needs no dialog.
- **The global network setting** (ask, allow, never): with "never", every scene works with simulated data; with "ask", each new capability asks once.
- **Review looks at the manifest first.** A change to `capabilities` in a pull request needs the approval of a named maintainer (CODEOWNERS), and the review checks that the declared hosts and data match the stated purpose.

## 6. Data kinds, connectors and sources

### 6.1 Data kinds

A data kind is a named, versioned shape, `name@major`. A scene asks for a kind, not for a service, so the player can choose where the data comes from and a contributor can write a connector once for every scene. Shapes (JSON, v1, to be refined by the first scenes):

```
weather@1  { updatedAt, source: "live"|"simulated", kind: "clear"|"partly"|"cloudy"|"fog"|"drizzle"|"rain"|"snow"|"storm",
             cloud: 0..1, precipMmH, tempC, windMs, windDeg, isDay, sunrise, sunset }
tasks@1    { updatedAt, items: [{ id, title, due?: iso, done: bool, priority?: 1..3 }] }          (private)
events@1   { updatedAt, items: [{ id, title, start: iso, end?: iso, allDay?: bool }] }            (private)
feed@1     { updatedAt, items: [{ id, title, link?, publishedAt? }] }
place@1    { country, region?, timeZone, lat, lon (rounded), source: "player"|"timezone"|"ip" }
```

`updatedAt` is always there, so a scene can show how old the data is. Text fields are plain text, trimmed (200 characters) and stripped of control characters by the host.

### 6.2 Connectors

A connector turns one service into one or more data kinds. It runs in the main process, so it is trusted code and gets the strictest review. To keep contributed code out of the main process, connectors come in three kinds:

1. **Built-in connectors** written by the maintainers: the weather service, the local file, an ICS calendar URL, and later services with real authentication (a calendar, an issue tracker, a to-do service).
2. **Declarative connectors (deferred, the Mac's E-14 and the owner's rule that complex features wait: built only after at least three real requests; the built-in connectors come first)**: a JSON descriptor that the host's own code interprets: the URL template, the auth header or query name, the pagination rule, and a mapping from the response to the data kind (a small path language, no code). A contributor can write one without any code running in the main process. The player supplies the URL and token.
3. **Scripted connectors** (later, only after a stronger isolation exists): code in a separate utility process with no file access and only its declared host. Not in v1.

A connector descriptor says: `id`, `kinds`, `hosts` (https only), `auth` (`none`, `token`, `oauth-pkce`, `url`), `config` (the fields the player fills in), `ttlSeconds`, `minIntervalSeconds`, and optional `activeHours` (local hours in which the host may fetch, for a connector that needs it; the weather connector does not use it).

### 6.3 Sources

A source is a connector plus the player's configuration plus a reference to a secret, bound to a data kind. The player manages sources in Settings: add, test (the host fetches once and shows the first lines), remove. A scene that asks for `tasks@1` receives the data of the source the player bound to it; with none, the scene shows its empty or sample state. The same source can feed several scenes.

### 6.4 Scene-owned requests

For data that no connector provides, a scene may declare `net: { hosts: [...], reason, requests: { name: { url, method, response: "json" } } }`. The scene calls `host.net.request(name, params)`; the main process makes the request to the declared host only, https only, and returns parsed JSON of at most 256 KB. The exfiltration rule applies: such a scene gets no private data kind. It is the highest review level, and the catalog marks it ("This scene connects to: example.org").

### 6.5 Fetching rules (all connectors and scene requests)

- Made by the **main process** with the app's own network stack, never by a page. https only; no IP addresses; a redirect to another host is refused; a time limit (10 s) and a size limit; no cookies; a generic user agent (`<AppName>/<version>`) and no install id.
- **Polling belongs to the host.** Each source has a time to live (weather 60 minutes, tasks 5 to 15 minutes), a minimum interval and optional **active hours**; errors back off. The host refreshes on its own schedule, not on the scene's frame loop (one small request an hour costs far less than drawing), but never while the computer sleeps or is locked, never on battery saver, never outside the source's active hours (except the one first fetch described for the weather in section 11), and at most once per interval on resume. A request never delays drawing or the start (B-5).
- **Offline is normal.** The last good answer is cached in the data folder and shown with its age; a failed request is silent (no dialog, no notification, no flashing); a scene without any data shows its simulated or empty state.
- **After sleep and wake the network is not there for a few seconds** (Wi-Fi reconnects, DNS is cold; seen on the Mac). On `powerMonitor` `resume` and unlock, the host waits for `net.isOnline()` plus a few seconds with some jitter, uses a timeout, and a failure in that window does not count towards the back-off. Requests are keyed to the app's pause state (no requests while locked or asleep), not to a timer alone, because a "dark wake" can fire timers with the screen off.
- **Refuse private targets.** A declared host that resolves to a loopback or private address (a name pointed at 127.0.0.1 or the local network) is refused. Requests use a session with no cookies and no credentials. They follow the system proxy; one request behind a proxy or VPN is part of the hand checks, and a refusal is silent.
- **A consent dialog is shown only after the player's own action** (choosing a scene, a menu item), never at launch or on a timer, because desktop mode has no HTML and the dialog would take focus.
- **The allowlist** at any moment is the union of the declared hosts of the active scene and of the enabled sources. Nothing else can be reached.
- **Tests** mock the network with a fake provider; a test runs every scene with the network off.

## 7. Resource limits and the watchdog

The host cannot stop a scene from asking for too much in-process, but it can notice and act:

- Frame time and frames per second are measured every second (the ticker); a scene whose frames exceed the cap for a minute is slowed (the host lowers its frame rate) and logged.
- Process memory is read from `app.getAppMetrics()`; a scene above twice its declared `budget.memoryMB` plus the empty host for 3 minutes is reloaded once, then disabled.
- `render-process-gone` and `unresponsive` load the default scene (document 1, section 4).
- The graphics-context reload guard (3 reloads in a minute) stops reloading.
- The contract test checks object counts, textures and update time before a scene is accepted.

### 7.1 What the main process enforces, and what only review enforces (the Mac's E-5)

The scene shares one JavaScript realm with the host loop (section 3), so a rule that is code inside the page can be walked around. Said plainly:

- **Enforced by the main process:** the network (the page has `connect-src 'none'`; requests only through connectors; **except WebRTC until the P1 spike passes**, section 3), data by capability, the files the protocol handler serves, and **sound**: the scene's page is muted with `webContents.setAudioMuted(true)` and unmuted for a few seconds after a real player action that the main process saw, so a scene cannot make its own `AudioContext` sound unprompted. `before-input-event` fires only for keys, not for clicks, and in window mode a click is the player's action (a pellet, the splash), so there are three signals: **a tray or menu action** (the main process already knows these), **a mouse-down** from the `input-event` event of `webContents` (in Electron's documentation as far as we know; check it in the loader spike), and **a key** from `before-input-event` (the Mac's correction of its own E-5). The **CPU and frame watchdog** is the backstop for drawing.
- **Only by review:** the frame cap inside the page (a scene can run its own `requestAnimationFrame` within the watchdog's limit), `pointer(null)`, and the politeness rules that live in scene code.

**Smaller points from the review (E-10):** the bridge rewrite (document 4, leak 3) lands **before a second scene runs**, not later in P1; check that Vite does not inline a small fontsource file as a `data:` URL before dropping `data:` from `font-src`; refuse private addresses by connecting to the address that was checked, not to a second lookup (DNS rebinding); parsers of remote content (the calendar connector) run in a **utility process from the start**; the catalog index expires after **90 days**, not 30, with a scheduled re-sign, so a quiet month of the only maintainer does not stop installs.

## 8. Review and supply chain

- **Source only.** A pull request adds source and assets, never a built bundle. CI builds the pack from source in a clean environment, so what the player installs is what was reviewed.
- **Dependencies.** In the first catalog a scene uses **no third-party runtime packages**, only the host's PixiJS (document 1, section 8.6) and `shared/`: many npm packages ship minified code, which the rule below refuses (the Mac's E-8); revisit when a scene needs one. Later a scene may bundle small libraries; the lockfile is committed; every new dependency is listed in the PR and reviewed (license, size, maintainers, install scripts: none are run, the build uses `--ignore-scripts`). The scene bundle is minified by CI, never by the contributor, so reviewers read real code.
- **Static tripwires** in lint for `scenes/`: no `eval`, `Function`, `import()` of URLs, `fetch`, `XMLHttpRequest`, `WebSocket`, `RTCPeerConnection`, `EventSource`, `navigator.sendBeacon`, `Worker`, `Date.now()`, `window.open`, `document.cookie`. Tripwires catch honest mistakes and lazy attacks; they are **not** a boundary, the sandbox is.
- **Checks in CI:** the manifest against a schema; the capability rules (the exfiltration rule); allowed licenses; asset types and sizes; the contract and capability tests on both runners; a secret scan; a dependency audit.
- **Human review checklist:** does the code do what the DESIGN says? any obfuscation, large opaque data, unexplained timers or loops? do the capabilities match the purpose? is every asset's license real?
- **Two people** for anything in the catalog: an author and a maintainer; capability changes need a maintainer from the security list.
- **Signing and revocation.** The catalog index is signed with the project's key; it lists each pack's SHA-256, so the packs are covered (document 1, section 5.4). The index carries a `revoked` list of `{id, version}`; the app checks it when the player opens the scene store and once a day when allowed, disables a revoked scene at once and falls back to the default scene.
- **Reporting.** A `SECURITY.md` with a contact; a fix for a bad scene is: revoke, remove, publish a notice.

### 8.1 Reviewing scenes from other repositories (recommended)

**The question:** a scene lives in someone else's repository. How do we control compliance, security and quality before it reaches players? **The answer is layers, and the first rule is that the sandbox, not the review, is what protects the player.** A review finds what a person can see; the sandbox limits what a scene can do even when the review missed something. The review decides what is worth publishing and what is honest.

**Layer 1: what is reviewed is one pinned commit, built by us.** Section 5.4 of document 1 already fixes this: the catalog entry names a commit, CI builds the pack from that source with the platform's tool and never runs the scene's own scripts, and an update is a new pull request with a diff between two commits. "If it cannot be read, it is not published": the pack tool refuses a scene whose source is minified or obfuscated (lines over 500 characters, large base64 blobs, hex-escaped strings, files that are not text), and the code of a scene is limited in size (for example 500 KB of source, 25 MB for everything) so that a person can really read it.

**Layer 2: the automatic gate (every pull request, no secrets).** All must pass before a human looks:

| Check | What it catches |
| --- | --- |
| Manifest schema, id rules, version higher than the published one | wrong or sloppy metadata, id squatting |
| Capability rules: the exfiltration rule, declared hosts are `https` names, no private address | a scene that could send private data out |
| **Capability against code**: the tripwire lint (document 2, section 8) and a scan that every API the code uses is covered by a capability | a scene that uses `fetch` or reads the place without asking for it; also lazy attacks |
| File types and sizes, no executable, no WebAssembly, no HTML | binaries and hidden code |
| Dependencies: lockfile present, `npm ci --ignore-scripts`, licenses from the allowed list, an audit, and a list of every new dependency in the report | supply-chain surprises |
| Licenses: code and assets declared and allowed; `LICENSES.md` for every asset; the DCO sign-off on the commits | unusable or unlawful content |
| Thumbnail, `DESIGN.md` and the scene's own tests exist | unfinished scenes |
| Contract test, capability test and the budget test on a Windows and a Mac runner; the run with `reducedMotion` | crashes, leaks, a scene that is too heavy, motion rules |
| Secret scan | a token committed by mistake |
| An advisory **AI pre-review** that comments on the pull request (what the code does, anything odd, mismatch with `DESIGN.md`) | helps the reviewer read faster. **Advisory only:** it never approves, and its output is treated as untrusted text, because the code it reads can try to talk to it |

**Layer 3: the human review, with a written checklist** (a pull request template; the reviewer ticks each line):

- *Security:* does the code do what `DESIGN.md` says and nothing more? Timers, loops or large opaque data that nobody can explain? Do the capabilities match the purpose, and are the hosts the ones a service of that kind would use?
- *Compliance:* are the assets original or under an allowed license, with the attribution written? No copied characters, logos or brand names; no use of a trademark in the name or the picture; nothing that tracks, advertises or collects; the privacy line in the store card is true.
- *Content and honesty:* nothing hateful, sexual or shocking; no scene that imitates a system dialog, a payment or a warning; it does not claim to be something it is not.
- *Quality:* the "would I leave this on my desktop?" question; the measured memory and frame time are inside the budget; the empty and offline states look intended; reduce motion is honoured; the thumbnail shows the scene as it is.

**Layer 4: how deep the review goes depends on what the scene asks for.**

| Level | Scene | Review |
| --- | --- | --- |
| A | No capabilities (art and logic only) | One maintainer, light: checks, a read of the diff, a look at the scene running |
| B | Data kinds or the place | One maintainer, and the capability list is read word by word |
| C | A declared `net` host | Two maintainers, one of them on the security list; the host's purpose and terms are checked |
| any | The **first** scene of a new author, or a change of capabilities | Treated as level B at least, with a second maintainer for any change of capabilities (CODEOWNERS) |

**Layer 5: after publishing.** Every store card has a **"Report this scene"** link (an issue in the catalog repository), the index can **revoke** a version at once (section 8, signing and revocation), the source tarball of every release is kept, and a maintainer who finds a problem later revokes first and discusses afterwards. A scene whose author does not answer a report within a set time can be unlisted.

**Who and how fast.** At the start the maintainers are the owner (Tuan Tran) and a second person still to be named; the project promises a first answer within about a week, because a reviewer who is overloaded approves too fast. The first catalog entry is the owner's own desk scene (owner: when the store is built, version 1.2, after the platform and the two bundled scenes; `03`, section 6.1), so that the checklist is tested on a first-party scene before a stranger relies on it. Similar projects add a limit on open submissions per author and a time limit for unanswered comments (document 1, section 5.4). Whether outside authors may become maintainers is a governance question (document 3, section 8).

**What this does not do:** it does not make a scene safe against a vulnerability in Chromium or in the sandbox configuration; it does not stop a scene from being boring or ugly (only the quality review does); and it is not a legal review of an author's rights, which is why the pull request template asks the author to state that they hold them.

## 9. Tiers of trust

> **Deferred** (the Mac's E-14; owner, 2026-11-23): T2 declarative scenes and the declarative connector language are built only after at least three real requests. T3 stays "not before an isolated runtime".

| Tier | What | Who reviews | Runs as |
| --- | --- | --- | --- |
| T0 | Bundled scenes (fish tank, farm house) | maintainers | in the page, sandbox |
| T1 | Catalog scenes: reviewed, built by CI, signed | maintainers plus the author | in the page, sandbox, consent for capabilities |
| T2 | Declarative scenes: JSON only, using behaviours that already exist in the host | CI schema check | no scene code at all; safe by construction |
| T3 | Open submissions with code | automatic limits only | **not before** an isolated runtime exists: a scene in a worker with an offscreen canvas, or in a WebAssembly JavaScript interpreter that returns draw commands, with a memory and time limit and no network. Research item |
| never | Executables, native modules, installers, shell scripts | | |

T2 is worth building early, because it lets people make scenes (a few layers, a palette, a weather behaviour, some animals walking) with no risk and no review beyond the schema.

## 10. Secrets

- Tokens and passwords are stored by the **main process** with Electron's `safeStorage` (the macOS Keychain, Windows DPAPI); the app checks `isEncryptionAvailable()` and refuses to store a secret when it is false. A secret is keyed by source id.
- A secret is **never** in `settings.json`, the logs, the diagnostics, an error message, a page, or an argument to a scene. The host adds the header to the request.
- v1 uses **tokens pasted by the player** (a personal access token or an app password), with a test button. Real sign-in with **OAuth** needs a client id registered by the project for each service and a PKCE flow with a loopback redirect or a custom protocol; an open-source app cannot keep a client secret, so only public-client flows are used. OAuth connectors come later, one service at a time.
- "Remove source" deletes its secret and its cached data. Unsigned apps may get more Keychain prompts on the Mac: the Keychain item's access list is tied to the app's code signature, and an unsigned or ad-hoc signed build has a different signature after every build, so the first use after an update can show a system password dialog that takes focus. So `safeStorage` is called **only when the player enters or removes a token** (their own action), never at launch or login; the secret store returns "no secret" without touching the Keychain when none is saved; the first-run text of a scene that needs a token says that macOS may ask for the password; and `isEncryptionAvailable()` is checked after `ready`, falling back to "no secrets" (simulated data), never to plain text. A signed and notarized app avoids most of this. A cheap spike (store and read one string in a test build) settles what the Mac shows.

## 11. Place, weather and privacy

**Place.** Three ways, in this order of preference:
1. The player types a city once; a geocoding lookup returns coordinates, which are rounded to 0.1 degree and saved. The most private and the most accurate.
2. The time zone gives a country and a rough place, with no request.
3. A lookup by IP address, only on consent; the lookup service sees the address (and so does every service we call). Wrong behind a VPN.

Scenes get a coarse `place@1`, never the IP address. The host **never uses the operating system's location service** (CoreLocation on the Mac, the Windows location API): it shows a system permission dialog and is not needed.

**Weather.** A built-in connector for `weather@1`. A provider with no key and a free tier suits an open-source app; Open-Meteo is the example. Checked on 2026-11-23 on its [terms page](https://open-meteo.com/en/terms): the **free API is for non-commercial use only**, with limits of 10,000 calls a day, 5,000 an hour and 600 a minute (the page does not say per what; if they count per address, each player is far below them, to confirm), and the data licence (CC BY 4.0) **requires attribution**, so the About window and the weather scenes' store text credit it. A free, open-source app with no payments fits "non-commercial", but the owner should read the live terms before release and again if the app ever charges or carries ads. A commercial plan exists. The provider sits behind the connector interface, and a second one can be a fallback. Only rounded coordinates are sent. With no network, no consent or no place, the weather is **simulated** from the seed, the date and the place's climate by month (the same on two machines), flagged `source: "simulated"`.

**When the weather is fetched [owner, 2026-11-24, replaces the 7:00 to 19:00 window of 2026-11-23]: once an hour, while the computer is awake and a scene that uses weather is the active scene.** That is at most 24 requests a day for each computer (usually far fewer: a laptop sleeps, and the scene may not be active), against a free limit of 10,000 a day (if the limit were counted for all players together, that would still allow about 400 computers a day; the page does not say per what, to confirm). In detail:
- **One request carries the next 24 hours.** The request asks for the current conditions and the hourly values for the next 24 hours (Open-Meteo has `current`, `hourly` and `forecast_hours` parameters; check the exact names against the live API docs when writing the connector), plus sunrise and sunset. The host keeps that table in the cache and hands the scene the entry for the *current* hour, so `weather@1` stays "the weather now" and a scene needs no change. Why 24 hours and not only "now": a request is a forecast table, and one table keeps the scene right when the next request is late or never comes (a sleeping laptop, a lost connection, a covered desktop that is drawn again at 9 in the evening). Without it the scene would show the last answer frozen until the next success.
- **When a request is made.** While the computer is awake and a weather scene is active (the scene is selected, whether or not the desktop is covered; the request is one small download, not drawing), the host fetches when the newest table is older than an hour (minus the offset below). On wake, on unlock, on a network change and when a weather scene is selected, the host checks the same rule at once, so a laptop opened in the morning gets fresh data in seconds, not at some fixed hour. If no weather scene is active, there are no requests at all. With no cached table at all (a new install), the first request is made at once, so the first minute is not simulated.
- **Spread the load.** Each install picks a random offset of 0 to 10 minutes once, so a thousand computers do not call on the hour; a minimum of 50 minutes between two requests; errors back off (1, 2, 4, 8 minutes, up to the hour) and do not count as the hour's request.
- **Local time.** The host reads the place's local time through `host.time` (the computer's clock for a time zone place, the typed city's zone otherwise) to pick the current hour from the table. There is no "active window" for weather any more; the connector descriptor's optional `activeHours` stays for other connectors that need it (for example a business-hours service), and `ttlSeconds: 3600` is the weather default.
- **Old data is shown as old.** `updatedAt` is always there; the data of a table that is more than 24 hours old is marked `source: "simulated"` again, so a scene never presents a day-old forecast as live.

**What leaves the machine** (listed in About and in the error report):

| What | To whom | When |
| --- | --- | --- |
| Rounded coordinates | the weather provider | once an hour while the computer is awake and a weather scene is active (at most 24 a day), if the player allowed it |
| Requests of a source the player added | that service | at its interval |
| The app update check (the release's `latest.yml` or `latest-mac.yml`, only the version line is read) | the project's GitHub Pages or release host | once a day from the first run, and on "Check for updates"; the setting "Tell me about updates" turns it off |
| The catalog index and packs | the catalog host (GitHub) | when the player opens the scene store (the store is not scheduled; document 3, section 6.1), and a daily scene-update check if allowed |
| An error report | GitHub (a pre-filled issue, public), the project's mailbox, or later the project's endpoint | only when the player presses one of the buttons in "Send error report..."; the app itself makes no request in version 1 |
| Nothing else | | no telemetry, no analytics, no crash upload |

Every one of those servers sees the player's IP address, like any web server; the privacy page says so.

## 12. "Send error report" and the backend it needs

**Two buttons, two readers [owner, with one change].** The owner's idea: "Copy diagnostics" for developers and "Send error logs" for users. It makes sense, with these changes: the player's button is named **"Send error report..."** (it carries a short description and system facts as well as log lines, and "diagnostics" means nothing to a player), and the developer's items are **"Copy diagnostics"** and **"Open log folder"**. Both use the same sanitizer; the player's report is smaller (a summary and the last 200 log lines, at most 64 KB) and the developer's text is longer (more lines, the measurements). The window shows exactly what would be sent, with an optional "What happened?" box, and the buttons of section 12.1.

### 12.1 Version 1: two buttons and an address, no server [owner: start with the GitHub issue]

**In short (accepted by the owner, 2026-11-23, fourth round).** Build version 1 with **two buttons and one line of text**, and nothing else:

1. **"Open GitHub issue"**: the main button, for players with a GitHub account. It gives the status the owner wants.
2. **"Copy report"**: copies the whole text.
3. One line under them: **"No GitHub account? Paste the report into an e-mail to `<address>`"**, with the address shown as plain text (and a small "Copy address" link).

What changes from the table below: the **"Send by e-mail" button is dropped** from version 1. A `mailto:` link does nothing for people who use only webmail, and its length limit cuts the log anyway; "Copy report" plus a visible address works for everybody. The mailbox is **a new, free, dedicated Gmail address** made only for this (no domain needed, nothing to pay, the owner's own address never appears). **No mail service is needed in version 1.** Cloudflare Email Routing comes only when the project has a domain, and Resend only if a server must send mail; both are optional later steps. The real fix for players without an account is the **one-click "Send" button of section 12.2** (a small endpoint files a private issue): build it after the first public release, when there are real players.

**Scene log lines stay out of the public issue by default** (the Mac's E-7): a scene granted a private data kind (`tasks`) can write task text through `host.log`, and the sanitizer cannot recognise it. The issue body carries the host's own lines; the scene's lines are in the text that "Copy report" puts on the clipboard, with a note to read it before pasting.

The owner chose to start with a **pre-filled GitHub issue**, because an issue has a status (open, labelled, closed, linked to a fix). It needs no server and no storage, and the player sees exactly what goes where. Two facts change the plan a little:

1. **Creating an issue needs a GitHub account.** The pre-filled link opens GitHub's form, and GitHub asks a signed-out person to sign in or sign up first. Many players have no account, so an issue cannot be the only way.
2. **An issue in a public repository is public.** The text is sanitized and shown in full first, but the window says so in plain words: "This will be visible to everyone on GitHub."

The options that were considered (version 1 uses only the first and the third; the e-mail row is dropped, see above):

| Button | What it does | Needs | Weak point |
| --- | --- | --- | --- |
| **Open GitHub issue** | Opens `https://github.com/<owner>/2nddesktop/issues/new` in the browser with the title, the labels and a short body filled in; the full log is put on the clipboard and the form says "paste the log here" | a GitHub account | public; the URL has a length limit (GitHub documents a "414 URI too long" error for long query strings but I found no number: keep the whole URL under about 2,000 characters, to test) |
| **Copy** | Puts the full text on the clipboard | nothing | the player must find a place to paste it |

The issue uses a **GitHub issue form** (`.github/ISSUE_TEMPLATE/error-report.yml`) with fields for version, system, scene, what happened and the log, plus a label `error-report` that the template adds. GitHub's documents describe pre-filling an issue form from the URL by field id (to verify with a real form before relying on it). The repository's `SECURITY.md` says that real vulnerabilities do not go to a public issue.

**Which e-mail service?** Receiving needs no service at all, only an address. My recommendation, in two steps:
1. **Now (no domain yet): a dedicated free mailbox** for the project (a new Gmail address used only for reports), so the owner's own address is never in the app. Filters and labels sort the reports. It is free and works today; the downsides are spam once the address is in a public app, and an address that does not look like the project's.
2. **When the domain exists: [Cloudflare Email Routing](https://www.cloudflare.com/developer-platform/email-routing/)** for `support@<domain>`: free, forwards to the owner's mailbox, and the project can change the destination later without touching the app (routing rules map one address to one destination; messages up to 25 MiB; forward only, checked 2026-11-23 on Cloudflare's [limits page](https://developers.cloudflare.com/email-routing/limits/)). It needs the domain's DNS at Cloudflare.
3. A **sending** service is only needed if a server mails someone (a reply to a reporter, a notification); then **Resend** has a free plan of 100 e-mails a day and 3,000 a month ([Resend limits](https://resend.com/docs/knowledge-base/resend-sending-limits), checked 2026-11-23), plenty for this. Not needed in version 1.

### 12.2 Later: one "Send" button, with the GitHub issue as the database

**Do we need a backend and a database for reports? A backend, yes, in the small sense; a database, no.** The app cannot post straight to a place that stores reports, because anything the app can write to with a key inside it, a stranger can write to as well. So one small endpoint stands in between. It is the only way for a player **with no GitHub account and no mail program** to report a problem with one click, so it is the better experience once the app has players. And since the owner likes the status an issue has, the endpoint need not store files at all: **the function creates an issue in a private repository** (`2nddesktop-reports`, visible to the maintainers only), using a token that can create issues in that one repository and nothing else, kept as a secret of the function. The player gets the issue number as the report id. Labels give the status, closing the issue ends it, and a scheduled workflow deletes closed issues after 30 days. The alternative is a bucket of text files named by a random id, with a lifecycle rule that deletes them after 30 days (check that the chosen storage supports it). Either way there is no database. On Cloudflare's free Workers plan the limit is 100,000 requests a day ([limits](https://developers.cloudflare.com/workers/platform/limits)), far above a hobby app's reports; a different provider works as well. GitHub's API limits for the token and the issue-deletion rules for a private repository are not checked here; check them when building it.

If and when the endpoint is built:

- **Consent each time, with a preview.** The button shows the exact text first. Nothing is sent automatically, no crash upload, no install id unless the player ticks "include an install id so we can ask you questions".
- **Payload** is the report text above (the same sanitizer as "Copy diagnostics"), at most 64 KB, plain text or JSON, made by the host. The text never contains tokens, task text, event titles, home folder or user name.
- **Endpoint:** one HTTPS route, posted by the main process (not a page). A serverless function (for example a Cloudflare Worker) validates size and shape, rate-limits per address (the address itself is not stored), creates the issue in the private repository (or writes the file under a random id), and returns the report id, which the player can quote and use to ask for deletion.
- **Retention:** 30 days, then deleted; a person reads the reports in a private place; access is limited to the maintainers.
- **The two buttons and the visible address stay** (issue, copy, address) as the fallback when the endpoint is down or the player prefers them.
- **Legal:** a short privacy page (what, why, how long, how to delete); no personal data by design; check the rules of the regions the app is offered in.
- **Abuse:** reject spam by size, shape and rate; no feedback channel to the sender except the id.

## 13. Sources used (checked 2026-11-23)

- Electron `powerMonitor` (battery events on Windows and macOS): <https://electronjs.org/docs/latest/api/power-monitor>
- Electron security checklist: <https://www.electronjs.org/docs/latest/tutorial/security>
- PixiJS and strict CSP (`pixi.js/unsafe-eval`), secondary source, to confirm: <https://claudeskills.info/skills/pixijs/pixijs-skills/pixijs-environments/>
- WebRTC and CSP: <https://sansec.io/research/webrtc-skimmer>, <https://github.com/w3c/webappsec-csp/issues/92>
- Open-Meteo terms: <https://open-meteo.com/en/terms>
- Cloudflare Workers limits (free plan): <https://developers.cloudflare.com/workers/platform/limits>
- Cloudflare Email Routing (free, forward only, limits): <https://developers.cloudflare.com/email-routing/limits/>
- Resend sending limits (free plan 100 a day): <https://resend.com/docs/knowledge-base/resend-sending-limits>
- GitHub query parameters for new issues and pull requests (the "414 URI Too Long" note is on the pull-request page): <https://docs.github.com/en/pull-requests/reference/using-query-parameters-to-create-a-pull-request>
- The Wallpaper Engine Workshop malware: <https://www.bleepingcomputer.com/news/security/steam-workshop-abused-to-spread-malware-via-wallpaper-engine-app/>, <https://www.windowscentral.com/gaming/pc-gaming/wallpaper-engine-malware-steam-workshop-kaspersky>

## 14. Open questions

1. The WebRTC spike (section 3): can a scene page open a peer connection after our mitigations? Until it passes, T1 relies on review.
2. Declarative connectors: how small can the mapping language stay (a path language only)? Which ten services first?
3. Does an unsigned macOS app get repeated Keychain prompts for `safeStorage`? (Check with the first secret.)
4. Open-Meteo's terms are checked (non-commercial, attribution; section 11); is a second provider needed as a fallback, and does the free limit count per address? (The hourly schedule of section 11 keeps the use to at most 24 requests a day for each computer.)
5. Is T2 (declarative scenes) enough for most contributors, so that T3 never has to be built?
6. Where to run connectors that need a library (a calendar parser): **decided (the Mac's E-10): in a utility process from the start.**
7. Does a pre-filled GitHub issue form accept values for its fields from the URL, and how long may the URL be (section 12.1)? Try it with a real form.
8. Which reviewers are named in the first review rota (section 8.1)?
