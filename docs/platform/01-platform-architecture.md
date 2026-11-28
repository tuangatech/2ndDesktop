# Platform 1 of 5: Architecture and the scene contract

Status: Draft v0.2, 2026-11-23, updated after the Mac review. Written from the Fish Tank project (Windows and macOS, Electron 45, PixiJS 8) as the starting point of a new repository. The app is called **2ndDesktop** **[owner]** (the repository has the same name); this document says "the platform" or "the app".
Companion docs: `02-security-data-and-network.md` (what a scene may do, data sources, network, secrets), `03-distribution-and-roadmap.md` (packs, catalog, backend, release, roadmap, reuse of the old code). Scene designs are in `../scenes/`.

**Staging (owner, 2026-11-23, fifth round).** Versions 0.1 and 0.2 are the plan: the tank in the new repository, then the platform core and the farm house, fully offline. **Version 0.3 is next**: the signed public release of the two bundled scenes, with the app update check and the error report (`03`, section 6.1). Everything here that belongs to version 0.4 and later (live weather and the network, connectors, secrets, open contributions, session scenes, and the scene store and catalog, which are version 1.2) is **design notes**: written down so that the choices of 0.1 and 0.2 do not block it, and **not backlog** until its version starts and the event that unlocks it has happened. The contract stays v0 until the third scene has been written against it (`03`, section 6.1).

Words like "v0" and "proposed" mean not yet built or not yet decided. Decisions the owner has made are marked **[owner]**.

## 1. Idea

The app puts one living scene on the desktop of a Windows or macOS computer, behind the icons like a living wallpaper, or in a small window. The player has one scene on screen at a time and each scene keeps its own saved progress. The first scenes are a fish tank, a farm house on a mountain, and a desk. Anyone can write more scenes and share them as open source.

Goals

- The platform is small and solid: it does everything that is the same for every scene (the desktop, the tray, pausing, power, saving, settings, network, secrets, logging, updates) so that a scene author writes only the scene.
- A scene is a folder that a contributor can write without touching the platform code, and the player can add scenes from a catalog.
- A scene cannot harm the computer or the player's data (document 2).
- The app is a polite citizen of the desktop: light on CPU, GPU, memory and battery, quiet, and never in the way.
- It works offline. The network is a service of the platform that a scene may ask for, with the player's consent.

Not goals now: accounts, social features, running unreviewed code from strangers, a store with payments, Linux and mobile.

**Tone belongs to the scene [owner].** The fish tank is calm and quiet by design. The platform does not promise calm for every scene: a desk may show information. What the platform does promise, for every scene, is the politeness rules of section 7.

## 2. The words

| Word | Meaning |
| --- | --- |
| Host | The app itself: the desktop window, tray, pausing, power policy, saving, settings, network, secrets, logging, scene loading. |
| Scene | One living picture with its own rules and saved progress. A folder with a manifest, code and assets. |
| Record | The saved progress of one scene (one file per scene). |
| Capability | A thing a scene must ask for in its manifest to use it: network hosts, a data kind, the place, a text dialog. Without it the call fails. |
| Data kind | A named, versioned shape of data that scenes can ask for: `weather@1`, `tasks@1`, `events@1`, `feed@1`. |
| Connector | Host-side code that fetches data from one service (a calendar, an issue tracker, a weather service) and turns it into a data kind. |
| Source | A connector configured by the player (with a secret if needed) and bound to a data kind. |
| Pack | A scene packaged as one signed file for download. |
| Catalog | The signed list of packs that the player can install. |

In the code a scene's class is `<Name>Scene`; the PixiJS drawing tree inside it is the "stage" or the "layers", never "the scene".

## 3. What is host and what is scene

| Host (shared by every scene) | Scene |
| --- | --- |
| Desktop attach on Windows and macOS, window mode, recovery after Win+D, Explorer restart, display changes | The drawing and behaviour: what is on screen and how it moves |
| Tray menu and menu bar, single instance, launch at login, quit | The items it adds to the tray (`menuItems`), what they do |
| Pausing, power policy, frame-rate cap, budgets, watchdog | Its own frame-rate hint, its own state over time |
| Settings, settings screens, consent dialogs | Its own options, declared in the manifest |
| Records on disk (atomic writes, backup) | What is in the record and how old records are migrated |
| Time, place, weather and other data kinds, network, secrets | How to draw and use them |
| Logging, "Send error report" (users), "Copy diagnostics" (developers) | Its own log lines through `host.log` |
| Catalog, download, install, update, revoke | Nothing |
| PixiJS app, resolution cap, asset loading, atlas release | Art, sound, data files |

## 4. Process architecture

```
main process (Node, trusted)           host UI pages (trusted)        scene page (untrusted)
  window and desktop attach              settings, About,               host loop + PixiJS app
  tray and menu bar                      consent dialogs,               the scene's code
  power and pause policy                 scene store ("Get scenes")     (sandboxed, no Node)
  records, settings, secrets
  network, connectors, catalog
  scene registry, packs
        ^  IPC, every call validated                 ^  narrow bridge: `host`
        +--------------------------------------------+
```

- **The main process is the only trusted code** that touches the operating system. Everything that runs in a page is untrusted, including the host's own drawing loop, because the scene's code shares the page with it.
- **The scene page** is one sandboxed web page (no Node, context isolation on) that holds the host's loop and the one active scene. It loads its files from a custom protocol (`scene://<id>/`), never from `file://`. It gets a narrow bridge, `host`, whose calls the main process checks against the scene's manifest (document 2, section 5).
- **Host UI pages** (settings, About, consent, the scene store) are separate windows with their own pages and never run scene code. A scene cannot draw over them or call their bridge.
- **Switching scenes reloads the scene page.** The main process asks the old page to confirm that every save it sent has arrived (with a timeout; DEC-49: the host does **not** call `serialize()` at a switch), flushes the writers, and loads the page again with the new scene. A reload frees all graphics memory for sure and cannot leak between scenes. It costs a blink of about 0.3 s, which the host hides with a fade. The page never navigates itself. After a reload the host sends its state again (the pause, the power policy), because a reloaded page knows nothing.
- **A lost graphics context** reloads the page; after 3 reloads in a minute the host stops, keeps the scene paused and logs the error (the reload guard).
- **A crash or a hung page** (`render-process-gone`, `unresponsive`) loads the default scene, and a scene that fails 3 times is disabled until the player enables it again.

## 5. The whole picture: the computer, the scene store and the outside services

Section 4 shows the processes inside the app. This section shows the app inside its world: what is installed on the player's computer, where scenes come from, which outside servers exist, and how a scene gets from a contributor's GitHub repository into the store. 
### 5.1 The picture

```
 THE PLAYER'S COMPUTER
+--------------------------------------------------------------------------------------+
| 2ndDesktop app                                                                       |
|                                                                                      |
|  +-- main process (trusted) ---------------+      +-- scene page (sandbox) -------+   |
|  | desktop attach, tray, power, pausing    |      | host loop + PixiJS            |   |
|  | scene registry and loader               | IPC  | exactly ONE active scene      |   |
|  | store client: index, install, update    |<---->| (bundled or downloaded)       |   |
|  | connectors: weather, calendar, tasks .. |      +-------------------------------+   |
|  | network, secrets, records, logs         |                                          |
|  +-----------------------------------------+      +-- host windows (trusted) -----+   |
|        |                  |                        | settings, consent dialogs,    |   |
|        |                  |                        | the SCENE STORE window        |   |
|        v                  v                        +-------------------------------+   |
|  Installed scenes      Data folder (local only)                                      |
|   bundled, read-only    settings.json   records/<scene>.json   cache/   logs/        |
|    fishtank, farmhouse  secrets (encrypted by the system: Keychain / DPAPI)          |
|   downloaded            scenes/<id>/<version>/   (verified packs, one folder each)   |
+--------------------------------------------------------------------------------------+
        |                          |                               |
        |  https, main process only, never the scene page          |
        v                          v                               v
 SCENE STORE                 THIRD-PARTY APIS                ERROR REPORT ENDPOINT
 (static files, GitHub)      weather, geocoding              (optional, one tiny route)
  catalog.json + signature   calendar (ICS link, later       only when the player presses
  packs  *.scenepack          Google), issue trackers,       "Send error report"
  thumbnails                  feeds, a player's own URL
```

Rules that the picture shows:

- **Only the main process talks to the outside.** The scene page has no network (document 2, section 3). A scene gets data only as a data kind, through `host.data`, after a connector has fetched, checked and mapped it.
- **Three outside parties and no more** at the start: the store (static files), the third-party APIs the player chose (or the weather and geocoding built-ins), and the optional error-report route. The project runs **no server** in version 1.
- **Exactly one scene is active.** Installed scenes are only files on disk. Switching reloads the scene page (section 4).
- **Bundled scenes** (fish tank, farm house) are inside the app package, read-only, and use the same pack format as downloaded ones (in 0.2 they are bundled by Vite and the loader is proven by a spike, section 8.6). A downloaded scene with the same id as a bundled one replaces it only if its version is newer and it is signed in the index; "Remove" brings the bundled one back. **The fallback scene (the reload guard, the crash handler) is always the bundled copy from the app package**, whatever version is installed, so a broken update can never be its own fallback (the Mac's E-4).

### 5.2 Where the player's data lives

Everything about the player stays on the computer, in the app's data folder (`app.getPath('userData')`). The project's servers hold nothing about players.

| What | Where | Leaves the machine? |
| --- | --- | --- |
| Settings (`settings.json`) | local file | no |
| Scene records (`records/<scene>.json`) | local file, one per scene | no |
| Secrets (tokens) | local, encrypted by the system (`safeStorage`) | only to the one service they belong to |
| Cached data (weather, tasks) | local, with its age; removed with its source | no |
| Logs | local, rotated | only inside an error report the player sends |
| Installed scenes | local | no |

**Should anything from users be saved at a backend? Not in version 1.** A backend for settings and records means accounts, sync conflicts, a privacy policy for stored personal data, deletion requests, and a server that is a target; and the app has one player on one computer. What the player would gain (the same tank on a second computer) is served more cheaply by **Export and Import** in the settings: one zip with `settings.json` and the records, never the secrets. That is a later, small feature, and it keeps the promise "your data is yours and local". The only data that reaches a project server is an **error report that the player chose to send** (document 2, section 12).

### 5.3 The scene store (the window)

- **A host window, not part of the scene page.** It is a trusted page that the tray item "Scenes > Get more scenes..." opens. It never runs scene code and it never receives a URL: it shows what the main process gives it and sends back only `{ id, version }` ("install", "use", "remove", "update").
- **Every scene has a picture.** `assets/thumbnail.webp` is **required** (16:9, 640 x 360, at most 150 KB), and CI refuses a scene without it. The store window shows the pictures; the tray menu shows names only **[owner]**. The bundled scenes have one too, so the window looks the same for every scene.
- **What a card shows:** picture, name, one line, author, license, size, version, and the capabilities in plain words ("Shows your local weather", "Reads your tasks", "Connects to example.org"), then **Install**, **Use**, **Update** or **Remove**.
- **Tabs:** "Installed" (with **Update** where a newer version exists, section 5.6) and "Get more". The bundled scenes appear in "Installed" as "Included".
- **Text is text.** Names and descriptions come from the signed index, are length-capped, and are drawn as plain text (never as HTML).
- **Offline:** the window shows the installed scenes and "Cannot reach the store", with no error pop-up. The first time it opens, it asks "Look for new scenes online?" (the network setting, document 2).

### 5.4 Publishing a scene from GitHub to the store

**What we need:** a contributor writes a scene in a Git repository, and some days later players can install it from the store, with nobody able to slip different code into the store than the code that was reviewed.

Where can the scene's source live?

| Option | How | For | Against |
| --- | --- | --- | --- |
| A. In the platform repository (`scenes/<id>`) | A pull request to the platform repo | Simplest; the right place for the **bundled** scenes | Every scene change goes through the platform's CI and release; the platform repo fills with art; the scene's history is not the author's |
| B. One shared scenes repository | A pull request to a `scenes` repo with all sources | One place to review, one CI | The repo grows with art; authors do not own their history or issues |
| **C. A catalog repository that holds only pointers (recommended for outside scenes)** | The author keeps the scene in **their own** repo; a pull request to the catalog repo adds or updates one small entry file with the repo URL, a path and an exact commit | Authors own their code, issues and history; the reviewer reads exactly one pinned commit; the repo stays tiny; scales to many authors (Homebrew and winget work this way) | The reviewer must fetch from outside; the author's repo may disappear (so the catalog's CI also archives the source it built from) |

**Recommendation:** A for the two bundled scenes (they are built into the app and released with it), **C for everything else**, with one pack builder used by both. **Pack builds are reproducible** (esbuild pinned by the platform's lockfile, zip entries with fixed timestamps and order), so a second maintainer can rebuild a pack and get the same SHA-256 (the Mac's E-15). The catalog repository can start with no entries. **Owner (2026-11-23): the first versions focus on the platform and the two bundled scenes; the store and the full catalog pipeline are built only when there are enough users and contributors (`03`, section 6.1).** The desk stays a good first entry later, because it tests the whole pipeline with a first-party scene before any stranger uses it.

**Decided by the owner (2026-11-23, fourth round):** yes to the separate `2nddesktop-catalog` repository; the bundled scenes stay in the platform repository while the contract is v0, and the owner decides later whether and when to move them out.

#### What similar projects do (searched 2026-11-23)

| Project | What a contributor does | Kind |
| --- | --- | --- |
| [Raycast extensions](https://developers.raycast.com/basics/publish-an-extension) | A pull request to the one shared repository `raycast/extensions` holds the extension's code; reviewers can check out the fork; a bot says to expect a first review in about five business days; on merge it is published to the store | B |
| [Zed extensions](https://zed.dev/docs/extensions/publishing/publishing-guide) | A pull request to `zed-industries/extensions` adds the author's repository as a **git submodule** (a pointer to one commit, HTTPS URL, on a branch); one extension per PR, at most three open PRs per person, a valid license or CI fails, closed after three weeks without an answer | C |
| [Decky plugin store](https://wiki.deckbrew.xyz/en/plugin-dev/submitting-plugins) | A pull request to the plugin database adds the author's repository as a submodule; approved plugins go to a **testing store** first, where testers comment; stalled reviews are escalated and can be closed after about two weeks | C |
| [HACS](https://hacs.xyz/docs/publish/include) (Home Assistant add-ons) | The author keeps the repository; a pull request to `hacs/default` adds it; GitHub Actions check the manifest, that the repository is not archived and that a release exists | C |
| [Obsidian plugins](https://docs.obsidian.md/plugins/releasing/submit-plugin) | First a pull request to `obsidian-releases` with an entry pointing to the author's repository, reviewed by people. The current docs describe a newer directory with a developer dashboard, where **every new version is scanned automatically** (the team's blog says the review queue grew too long) | C, moving to automatic scans |
| [Flathub](https://docs.flathub.org/docs/for-app-authors/submission) | A pull request with a build manifest to a `new-pr` branch; once approved, **the app gets its own repository** under the Flathub organisation; reviewers check names, icons, trademarks and the app id's domain | pointers plus a repository per app |
| [winget](https://learn.microsoft.com/windows/package-manager/package/repository) | A manifest with the installer URL and its hash in one shared repository; an automated pipeline downloads and tests the installer; a hash mismatch fails | C (a pointer plus a hash) |

I did not check Home Assistant's own integrations repository, and I read only the summaries of these pages, not every rule.

**What it shows.** B is the exception (Raycast, a company with a paid review team). The projects that rely on volunteers or small teams (Zed, Decky, HACS, Obsidian, winget) all use pointers, and they add the same helpers: **an automated check on every submission, a license check, a pinned or tagged version, a time limit for authors who do not answer, and (Decky) a test stage before the public store.** The trend (Obsidian) is toward more automation, because people cannot read every update.

**B against C for 2ndDesktop**

| Question | B. One shared scenes repository | C. A catalog of pointers |
| --- | --- | --- |
| Work for a maintainer per scene update | A pull request that carries the code | A pull request with one small entry file; the CI posts the diff between the old and the new pinned commit. **The human step is the same.** |
| What the reviewer reads | The pull request diff, in place | The compare view of the pinned commits (the CI links it and lists changed files, sizes and capabilities) |
| Who owns history, issues, stars | The platform project | The author |
| Repository size | Grows with every atlas and texture; a clone gets slower (a scene pack may be 25 MB, so ten scenes with several versions are hundreds of MB in history) | Stays tiny |
| If an author disappears | The code is already here | The CI keeps a copy of the source it built from (section 5.4 table above) |
| Same license and rules for all | Easy to enforce | The entry check reads the license from the author's repository |
| Blast radius | Strangers' code in the repository that builds and signs | Strangers' code is only built from a pinned commit in the catalog's CI; the signing key stays in a protected environment |
| Fit for first-party scenes | Good: one CI, shared tools, easy refactors | Works (an entry points at a folder), but less direct |
| Fit for a stranger with their own project | Poor: must give up their repository | Good |

**Recommendation (unchanged, now with evidence).** Keep **A for the bundled scenes** (platform repository, while the contract is v0), **C for outside scenes** (the catalog), and keep B only as the **optional later home of the owner's own first-party scenes** (`2nddesktop-scenes`, when the contract is v1; table below). Do not choose B for outsiders: it costs the same review time as C, grows without limit and takes ownership from authors. What the similar projects teach us to add to C: the PR limits (one scene per PR, at most three open per author), a time limit for unanswered review comments (three weeks as in Zed), and, at depth level B or C of section 8.1 in document 2, a **testing channel** before a new scene reaches everyone.

**Do we need a separate repository for the catalog? Yes, a small one.** There are three kinds of repository, and only the first two are ours:

| Repository | Holds | Who writes | Secrets it has |
| --- | --- | --- | --- |
| `2nddesktop` (the platform) | The app, the host, the dev kit, the pack tool, the bundled scenes, the docs | Maintainers; contributors by PR | The app's code-signing certificates and the updater's release token |
| `2nddesktop-catalog` | The entry files, the PR checks, the release workflow, the signed `catalog.json`, the packs as Release assets | Anyone by PR (an entry file); maintainers merge | The catalog signing key only |
| An author's own repository | One scene's source and history | The author | None of ours |

Why the catalog is **not** a folder in the platform repository:
- **Blast radius.** The catalog's CI builds code that strangers wrote. The platform repo holds the certificates that sign the app for every player. Keeping them apart means a mistake in a scene workflow cannot reach the app's signing secrets.
- **Different people.** More people may review scene entries than should have write access to the app.
- **Different rhythm.** A scene release (minutes, any day) does not touch an app release.
- **One Pages site per repository.** The store's `catalog.json` can live at its own address, and the platform repo can still have a docs site.
- The cost is one more repository, and it is small: a folder of JSON files and two workflows.

**Should the bundled scenes also live in the catalog repository, with the player choosing which to download at install?** Not for now, for four reasons:
1. **The default and fallback scene must be local and trusted.** The reload guard, a crash or a revoked scene all fall back to a bundled scene (section 4); that cannot depend on a download.
2. **First run offline.** The app promises to work offline, and the first minute should show a scene with no network and no choice to make. A "pick your scenes" step at install adds a decision before the player has seen anything.
3. **The contract is still v0** (section 8). While it changes, a scene and the host must change in the same commit and be tested together by the golden hash and the contract test in the platform repo. Moving first-party scenes out would put every contract change across two repositories.
4. **Size.** The two scenes are a few megabytes (the pack limit is 25 MB each); a thin installer saves little.

What we do instead: the bundled scenes **use the same pack format and pack tool**, are listed in the store as "Included", and can be **updated from the catalog without an app release** (a newer signed version replaces the bundled one; Remove brings the bundled one back). When the contract reaches v1, moving the first-party scenes to their own repositories and catalog entries is a mechanical step, and the app can still bundle the pinned versions at release time. The "pick your scenes at install" idea is kept as a possible later installer variant, not a first-release feature.

**Do I need more repositories for my later scenes? No.** The entry file names a repository, a folder in it and a commit, so the catalog does not care where a scene lives. For the owner's own scenes:

| Where | When | Note |
| --- | --- | --- |
| **A folder of the platform repository** (`scenes/desk`), released through the catalog | **Now, recommended**, while the contract is v0 | Scene and host change in the same commit and meet the same tests. The entry file is `{ "repo": "<platform repo>", "path": "scenes/desk", "commit": "..." }`; CI builds only that folder. A scene release is a tag such as `desk-v0.2.0`. No new repository. |
| One shared repository, `2nddesktop-scenes`, a folder per scene | When the contract is v1 and the first-party scenes should not ride on the app's release rhythm | One more repository, not one per scene; the entry files change only their `repo` and `commit`. |
| A repository per scene | Never needed for the owner's scenes; this is how **outside authors** work | Their repository, their issues and history. |

Not in the catalog repository itself: it holds the signing workflow and the signing key's environment, and mixing scene code in would put that code next to the key.

**The entry file** (`catalog/scenes/desk.json`) is the only thing an author writes in the catalog repo:

```json
{
  "id": "desk",
  "repo": "https://github.com/<owner>/<repo>",
  "path": "scenes/desk",
  "commit": "<40-character commit hash>",
  "maintainers": ["github-login"]
}
```

Everything else (name, version, capabilities, license) is read from `scene.json` at that commit, so there is one source of truth. CI checks that the version is higher than the one in the store.

**The pipeline:**

```
 AUTHOR                    CATALOG REPOSITORY                                      PLAYERS
 scene repo                (GitHub, public)
 v0.2.0 = commit abc123
      |
      | 1. pull request: entry file with repo, path, commit
      v
 +--------------------------------------------------------------+
 | 2. PR CHECKS (no secrets, read-only token)                   |
 |    fetch commit abc123 -> npm ci --ignore-scripts            |
 |    build the pack with the PLATFORM's pack tool              |
 |    manifest schema, license, size, file types, thumbnail     |
 |    contract + capability tests on a Windows and a Mac runner |
 |    lint tripwires, secret scan, dependency audit             |
 |    REPORT in the PR: capabilities in words, diff between     |
 |    the old and the new commit, size change                   |
 +--------------------------------------------------------------+
      |
      | 3. human review: a maintainer reads the diff and the report;
      |    a capability change needs a second maintainer (CODEOWNERS)
      v
   merge to main
      |
      v
 +--------------------------------------------------------------+
 | 4. RELEASE WORKFLOW (only on main)                           |
 |    a. build job (no secrets): rebuild the pack from the      |
 |       pinned commit; also archive the source tarball         |
 |    b. sign job (protected environment, needs approval):      |
 |       takes the hashes, writes catalog.json (sequence + 1,   |
 |       expiry date, revoked list), signs it (Ed25519)         |
 |    c. publish: catalog.json + .sig + thumbnails to GitHub    |
 |       Pages; packs and source tarballs as Release assets     |
 +--------------------------------------------------------------+
      |
      v
 5. THE APP: opens the store (or the daily check) -> downloads catalog.json
    -> verifies signature, sequence, expiry -> shows cards
    -> Install: download pack -> check size and SHA-256 -> safe unzip
    -> validate scene.json -> move into <data>/scenes/<id>/<version>/
    -> consent for capabilities on first "Use" -> switch (document 1, section 4)
```

Why this shape:

1. **The pinned commit is the review.** A reviewer approves one commit; a later force-push in the author's repo changes nothing in the store. An update is a new pull request with the new commit, and the report shows the diff between the two commits, which is what the reviewer reads.
2. **CI never runs the scene's own scripts.** The build job runs the platform's pack tool (esbuild with the platform's config) on the scene's source, with `npm ci --ignore-scripts`. Generator scripts such as `gen-decor-art.mjs` are for the author's own computer: the generated art is committed, and the catalog packs what is committed. Otherwise a pull request could run any code in our CI.
3. **Secrets never meet untrusted code.** PR checks have a read-only token and no secrets, and the workflows never use `pull_request_target` to check out a pull request. The signing key exists only in the sign job, which runs after a merge, in a protected environment that needs an approval, and that job reads hashes and does not execute anything from a pack.
4. **Only the index is signed.** `catalog.json` lists each pack's SHA-256, so one signature (Ed25519, the public key built into the app, a second key built in for rotation) covers the whole store. A pack file that is swapped on the host fails the hash check; the host of the packs does not need to be trusted.
5. **Replay and freeze protection.** The index has a `sequence` number and an `expiresAt` date. The app remembers the highest sequence it has seen and refuses an older index (an old index would lack a later revocation), and it refuses to install from an expired index (it keeps what is installed).
6. **The source stays available.** Each release also stores the source tarball it was built from, so a review or a rollback works even if the author deletes their repo.
7. **Who may update an entry.** `CODEOWNERS` lets only the entry's `maintainers` (and the project's maintainers) change an entry file. Scene ids are first come, first served, lowercase-dash, with a reserved list (`fishtank`, `farmhouse`, `desk`, `default`, `none`).
8. **Revoking** is a pull request that adds `{ id, version, reason }` to `revoked`; the next index carries it, and the app disables the scene and falls back to the default scene at its next check (document 2, section 8).

**The index (`catalog.json`), shortened:**

```json
{
  "format": 1,
  "sequence": 42,
  "generatedAt": "2026-12-01T10:00:00Z",
  "expiresAt": "2027-03-01T10:00:00Z",
  "app": { "latest": "0.2.0", "minSupported": "0.1.0", "url": "https://github.com/<owner>/2nddesktop/releases/tag/v0.2.0" },
  "scenes": [
    {
      "id": "desk", "name": "Desk", "version": "0.2.0",
      "summary": "A cozy desk that shows your next tasks.",
      "authors": ["Name"], "license": { "code": "MIT", "assets": "CC-BY-4.0" },
      "apiVersion": 0, "minHost": "0.1.0",
      "capabilities": { "data": ["tasks@1", "weather@1"], "place": "coarse", "net": null },
      "size": 4200000,
      "pack": { "url": "https://.../desk-0.2.0.scenepack", "sha256": "..." },
      "thumbnail": { "url": "https://.../desk-0.2.0.webp", "sha256": "..." },
      "source": { "repo": "https://github.com/<owner>/<repo>", "commit": "abc123..." }
    }
  ],
  "revoked": [ { "id": "bad-scene", "version": "1.0.0", "reason": "malicious code" } ]
}
```

**What the app checks before it installs anything:** the signature of the index; `sequence` and `expiresAt`; that the pack URL is `https` (a redirect, as GitHub uses, is followed only to `https`; the hash does the real checking); the size limit while downloading; the SHA-256; the unzip (no path outside the folder, no links, limits on file count and unpacked size, allowed file types only); the manifest schema and `minHost` and `apiVersion`; and that the id and version in the pack match the index. The `app.url` is only ever opened in the browser after a click, and only if it is an `https` address on `github.com`.

**For the author:**
- `npm run validate` and `npm run pack` run the same checks and the same pack builder as CI, so a pull request does not fail on surprises.
- **Developer mode** (a setting, off by default, with a plain warning): "Load a scene folder..." runs an unsigned scene from a folder, in the same sandbox, marked "local" in the menu. This is how a contributor tries a scene in the real app. It adds no new power: the sandbox and the capability checks are the same.
- **Later:** a small GitHub Action that an author copies into their repo, which opens the catalog pull request when they push a version tag. Do it by hand first.

**GitHub or a backend package?** The two ideas are the same thing if the "backend" is only static files, which is what this design uses. A real backend (uploads, accounts, ratings) is option B in document 3 and is not needed to publish, install, update or revoke.

**Open points for this design:**
**Decided [owner]: the index signing key starts as a secret of a protected GitHub environment** (needs an approval to use). Rules around it: the second public key built into the app belongs to a different private key, kept offline (a password manager vault or a USB stick) and used only to rotate if the first leaks or is lost, so it must exist before the first release; the key is generated once on a clean machine, never in CI logs; moving to a hardware or cloud key is a later hardening step, not a redesign.

**Artifact attestations (checked 2026-11-23 against GitHub's [docs](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) and the [action's README](https://github.com/actions/attest-build-provenance)).** A workflow with the `id-token: write` and `attestations: write` permissions can attest a file; the signature uses a short-lived Sigstore certificate and is stored by GitHub, tied to the repository and the workflow; anyone can check it with `gh attestation verify <file> --repo <owner>/<repo>`. The README says that from v4 the action wraps `actions/attest` and new work should use that; the docs examples still show an older version, so check the current release before pinning. Attestations in **private** repositories need GitHub Enterprise Cloud; ours are public. Our use: **an extra, not the trust root.** The app verifies the Ed25519 index signature with a built-in key (it works offline from the store and needs no GitHub tooling inside the app; the app does not run `gh`). The attestation on each pack and on the app installer lets a **reviewer or a curious player** prove that a file came from our workflow and commit, and a second maintainer can use it to check a release. Cost: one workflow step. Do it for the catalog packs and the app installers; do not make the app depend on it.

**Other things this design relies on, and what was checked** (2026-11-23):
- **GitHub Pages** limits: sites at most 1 GB, a soft bandwidth limit of 100 GB a month, deployments time out after 10 minutes, and rate limits may apply ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). The index and thumbnails are small; packs go as Release assets. I found no page on Release download limits: unchecked. Re-check before a launch with many players (document 3, option C).
- **Mac updates need a signed app.** electron-builder's docs say a macOS application must be signed for auto-update to work ([electron-builder auto update](https://www.electron.build/v26/docs/features/auto-update)); the updater also verifies signatures on Windows. So app updates on the Mac wait for the Apple Developer ID (document 3, section 3).
- **Windows signing** options and SmartScreen: see document 3, section 3.
- **Open-Meteo** terms: document 2, section 11.

### 5.5 The third-party APIs

Third-party services (weather, geocoding, a calendar, an issue tracker, a feed) reach scenes in one way only:

```
 service  --https-->  CONNECTOR (main process)  -->  data kind  -->  host.data  -->  scene.onData
 (weather,            fetch, validate, map,          weather@1,      checked by the     draws it
  calendar ...)       cache, rate limit,             tasks@1,        capability list
                      add the secret                 events@1 ...
```

- **Weather and geocoding:** built-in connectors, no key, nothing about the player but rounded coordinates (document 2, section 11).
- **Calendar:** version 1 is an **ICS link**. Google Calendar offers a private "secret address in iCal format" that a player can paste; it is a secret and is stored as one. Reading Google Calendar through its API needs OAuth, and a public app that asks for calendar access has to pass Google's app verification (to confirm against Google's current rules); that is a later, separate project.
- **Tasks and issues:** a local file connector first (no network); then connectors for services with a personal access token pasted by the player (document 2, section 10).
- **A scene never names a URL for private data.** Only a scene with no private data kinds may hold a declared `net` host (the exfiltration rule, document 2, section 5).
- The connectors that ship with the app are code in the app. Connectors from contributors are **declarative** (JSON mapping) and go through the same catalog pipeline (document 2, section 6.2).
- **Weather is fetched once an hour, while the computer is awake and a weather scene is active** **[owner, 2026-11-24]**; one request carries the following 24 hours too, so a late or missed request never freezes the scene (document 2, section 11).

### 5.6 Updates: scenes and the app

**Recommendation: a button first, automatic later.** An update replaces something that is running on the player's desktop, so version 1 never changes it without a click. Both kinds of update are cheap to add later, because the signed index already carries every version.

**Scenes**
- **Version 1: a quiet check and an "Update" button.** Once a day (after the player has opened the store once, and only if the network setting allows) the app downloads the index. For each installed scene with a newer version, the tray menu shows one line, "Scenes > Updates for 2 scenes", and the store window shows **Update** on the card with the old and new version, the size, and a line such as "Asks for the same things as before" or "**Now also asks for: your place**". A click runs the same install steps as a new install (section 5.4), keeps the old version folder for a rollback, and, if the scene is active, reloads the page with the save handshake (section 4). A change of capabilities asks for consent again (document 2, section 5). No notification, no badge on the tray icon.
- **Later: "Update scenes automatically".** A setting, off by default. It updates only scenes that are not the active one, or the active one at the next start, and **never** an update that changes the capabilities (that one waits for a click). Nothing else is needed: the signed index, the safe install and the rollback exist from version 1.
- **Bundled scenes** are updated like the others: a newer signed pack in the catalog replaces the one in the app, and an app release brings a new bundled version. The higher version wins.

**The app**
- **Version 1: tell me, and a link, with a check that does not depend on the store** (owner, 2026-11-23, the Mac's E-9). From the first run the app reads the `version:` line of electron-builder's `latest.yml` or `latest-mac.yml` (the release's own update file) once a day; the app writes the notice itself and the item opens the project's fixed release page (document 3, section 3.5, where the details and the reasons are). "Help > Check for updates..." does the check on demand. When the store exists, a `minSupported` value (in the signed index's `app` block, not in the update file) lets the project say "this version is too old for the catalog": the store window then shows "Update the app to see new scenes". That `app` block is only for the store window; the app's own check never waits for the store.
- **Later: install automatically** (electron-updater reading GitHub Releases): the app downloads in the background and installs on quit. Windows can start before the Mac, but the Mac needs a signed application and both a `dmg` and a `zip` build (document 3, section 3.5). The setting then has the value "install automatically".
- **Never:** a restart in the middle of the player's day, a pop-up, a progress bar on the desktop.

## 6. Desktop integration

Learned in the Fish Tank project and written down in `docs/reference/` (desktop-spike, edit-mode-spike, perf-notes) of the old repository.

- **Desktop mode.** A borderless window drawn on the desktop itself: on Windows it is attached as a child of the desktop window behind the icons (through `koffi` calls to Win32; it re-attaches after Win+D, an Explorer restart or a wallpaper change); on macOS it is a window at desktop level, shown on all Spaces, with no Dock icon. It never takes keyboard focus, never covers a window and **receives no clicks**: the system gives the clicks to the icons and windows. It shows on the main display only for now.
- **Window mode.** A normal small window that the player can move and resize, optional "Always on top" (it stays below full-screen apps on macOS). The scene may mount HTML in a node the host gives it (`host.ui`), in window mode only.
- **Fallback.** If desktop mode cannot attach at launch or keeps failing, the app switches to window mode and the tray menu shows a one-line note. No pop-ups, no notifications.
- **Tray and menu bar.** One small monochrome icon in the notification area or the menu bar, in both modes. The menu is built from what the scene reports (`status`, `menuItems`) plus the host's own items: Show on desktop or in a window, Scenes, Settings items, Quit (the full layout and who owns each item: section 10.1). On the Mac the app menu carries the same items (a menu named after the scene). The icon never flashes or shows a badge.
- **Everything the player does in desktop mode is a tray item.** Anything that needs a click on the scene exists only in window mode, or in Edit mode.
- **Edit mode** (a later feature, spiked on both systems): a scene can ask for a normal full-screen window over the desktop that takes clicks, with a toolbar (Done, Cancel). The recommended way is to re-create the attached window (about 0.3 to 0.6 s). On macOS a window of ours that takes clicks needs `app.focus({ steal: true })` and "Done" must give the focus back.
- **Safe area.** The icons (left on Windows, right on the Mac), the taskbar, the menu bar and the Dock sit on top of the scene. `host.safeArea` gives the insets and the icon strip, and scenes keep faces and focal points out of them. The layout adapts to any shape (16:9, 16:10, ultrawide, 4K, the 3:2 window); sizes are relative to the height of the scene, never fixed pixels.
- **Host windows** (settings, the scene store, consent, the error report, About). On macOS the app has no Dock icon in desktop mode. The Edit mode measurement (`edit-mode-spike.md`, Mac part) found that `show()` plus `focus()` gives such a window the keyboard but makes the app the front app, and that **closing it does not give the focus back** to the program that was in front (the menu bar stays the app's). So one helper in the main process opens every host window (focus on open) and closes it (`app.hide()` with the Dock-icon retry, so the icon does not flash). Every such window opens only after a player action, never at launch or on a timer. The macOS menu also needs an **Edit menu** (`{ role: 'editMenu' }`; today's menu has none), or Cmd+C, Cmd+V and Cmd+A do nothing in any text field (a typed city, "What happened?", a token): test paste in each window. (From the Mac session's review of PR 42, checked against `electron/menu.js`.)
- **Resolution.** The scene is drawn at no more than 1600 x 900 pixels (1.44 million) and scaled up on bigger displays. Art is made for the drawing size, never for the display size: a full-screen layer at the cap is 5.8 MB as a texture, one at 4K is 33 MB. The cap is part of the host and must be on when measuring.
- **Several displays.** One scene on the main display for now (the owner: always one). On the Mac the desktop window shows on every Space and replaces the player's wallpaper everywhere, and a second display stays plain; the first-run text says so.
- **Notes from the Mac session** (review of the earlier proposal, 2026-11-22, not all tried on a real machine):
  - Safe area is a hint, not a rule. On the Mac the icons start at the top right but can be anywhere or hidden (Stage Manager, "Show items on desktop" off); the Dock can be bottom, left, right or hidden; the work area changes when the menu bar hides, so `host.safeArea` is read again when the screen changes, never once. The notch is not reported: keep the top centre free of anything that matters.
  - The menu bar's text colour follows the system wallpaper, not our window, so a bright sky under a bar tinted for a dark wallpaper can make the clock hard to read. Not tried; if it matters, keep the top 40 points or so dark or low in contrast. Also not tried: whether macOS desktop widgets sit above our desktop window.
  - Retina: at the drawing cap a 3024 x 1964 pixel screen is drawn at about half its native density and scaled up, so small text is soft on every Retina Mac. A scene with text (the desk's laptop) draws it larger and renders it at twice its size.
  - A laptop that travels changes time zone: `host.time` reads the time zone again when it changes.
- **Most of the time the desktop is covered** (the Mac's P-3). With the default "Always pause" and most people working in maximised windows, a scene is seen in glances: after unlock, after Win+D, after closing a window. Design for those moments (`resume(gapMs)` is the tool, and the first second after a resume is what the player sees), and treat **window mode**, a small corner window, as a first-class mode, not only a fallback. Each scene's design document says what the player sees in those moments.
- **On Windows 11 a new tray icon goes into the overflow (^) by default** (the Mac's P-4), and in desktop mode the tray is the only control. So the first-run hint says where the icon is; starting the app a second time (the second instance) opens the window or Settings instead of doing nothing; window mode keeps its own menu button.
- **Launch at login** is off by default.

## 7. Power, pausing and politeness

### 7.1 The rule about covered desktops [owner]

**In short.** When a window covers the desktop, nobody can see the scene. The setting **"When the desktop is covered"** says what happens then:

- **Always pause** (the default **[owner, 2026-11-23]**): it stops drawing whenever covered, plugged in or not. Less heat and less fan noise, and nobody sees the scene anyway.
- **Pause on battery only**: on battery the scene stops drawing, to save power; plugged in, it keeps drawing.
- **Never pause**: it keeps drawing.

"Pause" only ever means "stop drawing". The scene's world keeps living: its state follows the clock, so when drawing starts again the scene catches up as if it never stopped. So the default costs the player nothing they can see.

The owner wants things to live on in the background, but not at the price of noise and heat. So the policy is a setting, the default is the quiet one, and the host decides when drawing runs.

Two different things can stop or go on:

- **Drawing** (the PixiJS ticker, `update(dt)` calls): costs CPU, GPU and battery.
- **Living** (the scene's state, the host's timers, data refresh): a scene's state is computed from the wall clock (rule in section 8), so nothing is lost while drawing is stopped. When drawing starts again the host calls `resume(gapMs)` and the scene settles what happened meanwhile. A scene may ask for a slow background tick (`background.tickMs` in the manifest) when it needs one, for example to keep a weather state fresh.

| Situation | Drawing |
| --- | --- |
| Screen locked, display asleep, system asleep | Always stopped |
| A full-screen app or game is in front | Always stopped. (On the Mac this is not a separate detector: Chromium reports the desktop window hidden when a full-screen app takes over the Space. A window that only fills the screen is caught by the cover check instead.) |
| The window is hidden or minimised (window mode) | Always stopped |
| Desktop covered by a maximised window (desktop mode) or the window fully covered (window mode) | Setting "When the desktop is covered" (below) |
| Battery saver on, or (macOS) thermal state serious or critical | Stopped. (Unchecked: Electron has `powerMonitor.getCurrentThermalState()` for macOS; I know of no Electron API for Windows battery saver or macOS Low Power Mode. Check before the table promises them.) |

The setting is saved in `settings.json`. Its three values and the words the settings screen shows:

| Value | Shown as | Meaning |
| --- | --- | --- |
| `always` (**default**, chosen by the owner on 2026-11-23) | "Always pause" | Covered: stop drawing, whatever the power. |
| `auto` | "Pause on battery only" | Covered and on battery power (or the power state cannot be read): stop drawing. Covered and on AC power: keep drawing. |
| `never` | "Never pause" | Covered: keep drawing (the always-stopped rows still apply). |

The settings screen adds one line under the choice: "Drawing a scene nobody can see uses power and can make the fans louder."

"Pause" here means "stop drawing". The scene keeps living in all three cases (below).

The power state comes from the main process: Electron's `powerMonitor.isOnBatteryPower()` and the `on-battery` and `on-ac` events work on Windows and macOS (checked in the Electron docs on 2026-11-23). The power state only matters for `auto`. A desktop computer with no battery reports AC, so `auto` keeps it drawing. If the call fails, the state is "unknown" and `auto` stops drawing.

**How the default came about.** The owner first chose `auto` (keep drawing on AC), then changed the default to `always` to have less fan noise. That matches the first recommendation: drawing a covered scene on AC still costs heat, fan noise and GPU time that the foreground app may need (a game, a video call), and nobody can see the result; the living part is carried by the clock-based state, `resume(gapMs)` and `background.tickMs`. This closes the open question about measuring a covered scene on AC with an integrated GPU: with the default nothing is drawn when covered, so there is nothing to measure. A player who picks `auto` or `never` chooses the cost. The budget B-1 (at most 0.5% of one core when covered, the old project's NFR-1) applies by default and with `auto` on battery; where drawing stays on, the visible-scene budget applies.

### 7.2 Budgets [proposed, from the measured old project]

| ID | Budget |
| --- | --- |
| B-1 | Drawing stopped: at most 0.5% of one core, nothing drawn, the host wakes at most once a minute (plus the scene's `background.tickMs` and data refresh). |
| B-2 | Desktop mode with drawing on: at most 30 frames per second, at most 3% of one core, for a scene with all its effects. A scene may ask for fewer frames (`fps` in the manifest); the host uses the lower number. |
| B-3 | Window mode, visible and active: at most 60 frames per second and 8% of one core. |
| B-4 | Memory after one hour: at most 250 MB on Windows and 375 MB on macOS (DEC-63; it was 350) for the whole app, growth under 20 MB over 8 hours. A scene's share is the limit minus the empty host. This is the steady state with **no host window open**: each host window (settings, the store, consent) is another renderer process (an estimate of tens of MB, not measured), so host windows are destroyed when closed, never kept hidden, and one open settings window is measured once on both systems (the Mac's E-11). |
| B-5 | The scene is visible within 3 seconds of launch. |
| B-6 | GPU and battery are measured as well (the old project only measured the CPU): a full-screen scene redraws many more pixels than a small one. |

Memory numbers from the old project (private bytes on Windows, `phys_footprint` of all processes on the Mac; never the working set that Electron reports on the Mac, which counts shared pages and reads about 190 MB higher):

| | Empty host | Tank on top | A second scene has |
| --- | --- | --- | --- |
| Windows, desktop mode | 196 MB | +33 MB (229 MB) | about 54 MB |
| Windows, window mode | 172 MB | +48 MB (220 MB) | about 78 MB |
| macOS, desktop mode | 258 to 264 MB | +70 MB (328 to 339 MB) | about 88 MB |
| macOS, window mode | 242 to 249 MB | +55 MB (294 to 303 MB) | about 100 MB |

An empty WebGL page on the Mac already costs about 245 MB because Chromium runs WebGL through ANGLE over Metal, which is why the Mac limit is higher than the Windows one (350 MB, raised to 375 MB by DEC-63 when the finished farm house measured 345 to 347 MB). Windows is what sizes a scene. CI runners have no real GPU, so a CI memory check compares a scene with an empty scene in the same run; the real numbers come from real machines.

### 7.3 Frame rate per scene [owner]

A scene asks for the frame rate it needs (`fps` in the manifest); the host uses the lower of that and the mode's cap (B-2, B-3). The frame rate is a cost, so each scene pays only for the motion it has.

| Scene | `fps` hint | Why |
| --- | --- | --- |
| Fish tank | 30 | Fish are always moving; below about 25 the swimming looks jerky |
| Farm house | 15 to start (measure 12 to 20) | Clouds, grass, a few animals walking; slow motion reads fine at a low rate |
| Desk | 10 | Steam, rain streaks, a cursor blink |

### 7.4 Reduce motion (accessibility) [owner]

- **Source.** A host setting "Reduce motion": follow the system (default), on, or off. The system value is the Windows "Show animations" setting and the macOS "Reduce motion" setting; in the page it is the CSS media feature `prefers-reduced-motion`, which Chromium takes from the system (to verify on both systems, with a hand check).
- **What the host does when it is on:** lowers the frame cap to two thirds of the scene's `fps` (never below 10), and tells the scene through `host.settings.reducedMotion` and `onSettings`.
- **What a scene does:** the same picture, calmer. Fewer particles (bubbles, rain, leaves), slower and smaller sway and drift, no shimmer or fast-moving light, no parallax, and nothing that flashes (a rule for every scene, on or off). Reduced motion never makes a scene blank.
- **Tests:** the contract test runs every scene a second time with `reducedMotion` on.

### 7.5 Politeness, for every scene

The app never takes keyboard focus or moves above other windows by itself (except "Always on top"), never receives or blocks a click meant for an icon or a window in desktop mode, never flashes or badges the tray icon, never shows a notification, and plays sound only as a reaction to something the player did. These are host rules; a scene cannot opt out of them.

## 8. The scene contract (v0)

The contract is **v0 until a third scene exists**, and nothing is promised to contributors until then. It is extracted from what the fish tank needed, not designed ahead; it grows only when a scene needs something, and every change is written down in this section.

### 8.1 A scene folder

```
scenes/<id>/
  scene.json        the manifest (section 8.2)
  index.js          ES module, default export: async function create(host)
  DESIGN.md         the design document of the scene (appendix A)
  assets/           everything the scene loads (section 9)
  tests/            the scene's own unit tests
```

### 8.2 The manifest `scene.json`

```json
{
  "id": "farmhouse",
  "name": "Farm house",
  "version": "0.1.0",
  "apiVersion": 0,
  "minHost": "0.1.0",
  "authors": ["Name"],
  "license": { "code": "MIT", "assets": "CC-BY-4.0" },
  "schema": 1,
  "fps": 15,
  "background": { "tickMs": 0 },
  "capabilities": {
    "data": ["weather@1"],
    "place": "coarse",
    "net": null,
    "secrets": [],
    "ui": [],
    "sound": false
  },
  "options": [
    { "id": "season", "type": "choice", "values": ["auto", "spring", "summer", "autumn", "winter"], "default": "auto" }
  ],
  "budget": { "memoryMB": 45 },
  "thumbnail": "assets/thumbnail.webp"
}
```

The host reads manifests without loading any scene code (the registry). `schema` is the version of the scene's record format. `options` are shown by the host in its own menus and settings, so a scene never builds settings screens.

**What an author defines in `scene.json`** (the pack builder and the catalog's CI check every row; document 3, section 2.2 is the release checklist):

| Field | Required | Rule |
| --- | --- | --- |
| `id` | yes | lowercase-dash, 3 to 32 characters, same as the folder name, unique in the catalog, not on the reserved list |
| `name` | yes | plain text, at most 40 characters, no `&` (a menu label drops it on macOS and turns it into an access key on Windows) |
| `summary` | yes | one line, at most 100 characters, shown on the store card |
| `version` | yes | semver; a catalog update must be higher than the published one |
| `apiVersion`, `minHost` | yes | the contract version the scene was written for, and the oldest app that runs it |
| `authors`, `license` | yes | at least one author; `code` and `assets` licenses from the allowed list (document 3, section 5) |
| `schema` | yes | version of the scene's record format (`migrate` handles older ones) |
| `fps` | no | frame-rate hint (section 7.3), 5 to 30; default 30 |
| `background.tickMs` | no | slow tick while drawing is stopped; default none |
| `capabilities` | yes, may be empty | what the scene asks for (document 2, section 5); shown to the player in words |
| `options` | no | choices the host shows in its menu and settings |
| `budget.memoryMB` | yes | **advisory:** the scene's share over the empty host, which CI measures against the empty scene on each system (the tank is 33 MB on Windows and 70 on the Mac, so `{ "win": 33, "mac": 70 }` is allowed); the watchdog at twice the budget stays (the Mac's E-12) |
| `thumbnail` | yes | `assets/thumbnail.webp`, 16:9, 640 x 360, at most 150 KB |
| `homepage`, `issues` | no | `https` links shown in the store card's "More" line, opened in the browser only after a click |

### 8.3 The factory and the scene object

```js
export default async function create(host) {
  return {
    resize(width, height, unit) {},   // layout changed (any size); unit = height / reference height
    update(dt) {},                    // from the host loop; not called while drawing is stopped
    setVisible(visible) {},           // drawing started or stopped
    resume(gapMs) {},                 // optional: drawing starts again after a gap; settle what happened
    pointer(x, y) {},                 // optional: the pointer (x, y), or null when there is none or nobody looks
    click(x, y) {},                   // optional: window mode only
    status() { return ''; },          // one line for the tray menu, or empty
    menuItems() { return []; },       // [{ id, label, enabled? } | 'separator']
    onMenu(id) {},                    // an item was chosen (the host sent back an id from the last menu)
    onData(kind, data) {},            // optional: a data kind has new data
    onOption(id, value) {},           // optional: a player option changed
    onSettings(settings) {},          // optional: a host setting changed (reducedMotion, power state)
    enterEdit(editor) {}, exitEdit() {},   // optional, later
    serialize() { return {}; },       // the state to save; the host adds schemaVersion and the time
    migrate(record) { return record; },    // exported next to create: older record to the current schema
    dispose() {},                     // free textures, tickers, listeners
  };
}
```

What `host` gives a scene, and nothing else: `host.app` (the PixiJS application and stage), `host.assets` (loads files from the scene's own `assets/`), `host.record` (`load()`, `save(state)` for its own record), `host.clock`, `host.time`, `host.place`, `host.data` (granted data kinds), `host.settings` (read-only view of what is relevant, for example reduced effects), `host.safeArea`, `host.layout`, `host.ui` (a node, window mode only), `host.sound`, `host.net` (only with a declared host, document 2), `host.log`, `host.seed`. There is no Node, no file access, no window control, no `fetch`.

### 8.4 Rules every scene keeps

1. **Time.** A scene never reads `Date.now()` or `new Date()` itself; `host.clock` is the only source (a lint rule for `scenes/` enforces it). State that changes over time (hunger, weather, growth) is computed from `host.clock` (wall time), not by adding up `dt`, because `update(dt)` is not called while drawing is stopped. The host caps `dt` after a pause. This also makes the manual clock and the seed work for tests and screenshots.
2. **Randomness** comes from `host.seed` through the shared seeded generator; the same seed gives the same layout. `Math.random` is for effects only.
3. **Saving.** The scene calls `host.record.save(state)` when its state changes (the host throttles writes); **a scene must send every change of its record as it happens**, because the host does not ask for the state at a switch, on quit or before sleep (DEC-49): a switch and a quit write the saves that are waiting (`before-quit` and the switch flush the waiting records), and before sleep nothing is flushed: a waiting record is written by its own timer, as always. `serialize()` is for tests and tools (the golden hash, the contract test). Records are JSON, at most 2 MB, one write a second (`02` section 4).
4. **Draw only through `host.app`**; stay inside the budgets; free everything in `dispose()`. Textures made at run time (gradients, canvases) are made once and freed in `dispose()`; a gradient texture made again on every resize leaked memory in the fish tank and is the example the contributor guide gives.
5. **Sizes are relative** to the height of the scene (`unit`), never fixed pixels.
6. **Desktop mode input.** The scene must work with `pointer(null)`, no `click` and no `host.ui`: desktop mode never gives them. (The fish tank's pointer reactions use the pointer position that the host reads from the system about 10 times a second while drawing; that is `pointer(x, y)` too.)
7. **Layer order** of a scene is part of its design and does not change between versions without a note.
8. **Messages to the player** are drawn by the scene. A host-level `host.notify` is added only if a scene needs one (and politeness still applies).

### 8.5 Records and settings

- One file per scene: `records/<scene-id>.json`, written by the host's store: atomic write, one backup, a corrupt file moved aside. Shape `{ "schemaVersion": 1, "savedAt": <epoch ms>, "state": { ... } }`. The scene owns `state` and provides `migrate`.
- `settings.json` holds the host's settings: `activeScene`, display mode, always on top, launch at login, sound, `whenCovered`, network mode (ask, allow, never), place, per-scene options and consent. Secrets are not in it (document 2).
- The save-and-switch handshake is in section 4. A page that reloads (a lost context) saves its pending state first.

### 8.6 PixiJS and the page are part of the contract (the Mac's review, E-1 to E-3; to be proven by the P1 loader spike)

- **PixiJS is provided by the host.** Today Vite bundles the tank together with the host, so there is one copy of PixiJS. A pack built on its own would bundle a second copy, and two copies do not work together (PixiJS's extension registry and `instanceof` checks). The host provides PixiJS to scenes through an import map (an inline map needs a CSP hash) or as `host.pixi`, and the pack tool marks `pixi.js` as **external**. Recommended: the import map, so authors write ordinary imports. **The PixiJS major version is part of `apiVersion`**: PixiJS 9 would break every pack, so it is a new `apiVersion`.
- **The host's own page uses the same copy.** The host page imports PixiJS through the same import-map address (Vite marks `pixi.js` as external for the host build too), otherwise the host's bundled copy and the scene's copy are two copies again (the Mac's point 11).
- **The page is served from `scene://<id>/`**, with the host's runtime at a reserved path (`scene://<id>/_host/`), so `script-src 'self'` allows the scene's module and the per-scene origin for storage is real (document 2, section 3). The scheme is registered as privileged (`standard`, `secure`) before the app is ready. A cross-origin module would need CORS headers from the protocol handler, which this avoids.
- **The loader spike, not a migration, in P1 (the loader itself comes after the farm house: DEC-57).** The Mac asked (E-3) to load the bundled scenes from `scene://` as packs from P1, so that the sandbox, the CSP and the pack format are tested from the first scene switch. Taken in part: P1 **starts with a spike** that loads a throwaway pack through `scene://` with the host's PixiJS, the real CSP and the WebRTC check, which removes the surprise. The two bundled scenes stay bundled by Vite in 0.2 (a simpler and safer 0.2, and the store is no longer scheduled); they move to the real loader when the store or the first outside scene is decided.
- **No third-party runtime packages in a scene** in the first catalog: only the host's PixiJS and `shared/` (document 2, section 8; the Mac's E-8). The contract is published as a `.d.ts` file generated from `app/page/host.js` (the Mac's E-17), so authors get editor help without the project moving to TypeScript.

## 9. Assets and the scene folder

A scene's files live in `assets/`. Three ways to make art are supported, and a scene can mix them:

1. **Hand-made images** (PNG or WebP, and spritesheets in PixiJS format: `atlas.webp` plus `atlas.json`). A contributor can draw in any tool and put the files in `assets/art/`.
2. **Source SVG** in `assets/art-src/` that the build renders and packs into one atlas per scene (`npm run assets`; the fish tank works this way, with `resvg`). The SVG is a source, not shipped.
3. **Procedural**: everything drawn in code at run time (gradients, polygons, particles), no art files. Good for backdrops, skies and weather; costs CPU once and a few MB of textures.

```
assets/
  thumbnail.webp        the store picture (required): 16:9, 640 x 360, at most 150 KB
  art/                  PNG, WebP, atlas.json (shipped)
  art-src/              SVG sources and generator scripts (not shipped)
  audio/                OGG or WAV, short
  data/                 JSON the scene reads
  fonts/                OFL fonts only
```

Rules for assets (proposed): allowed types are PNG, WebP, JSON, OGG, WAV and WOFF2 (fonts under the SIL Open Font License); no HTML, no executable, no WebAssembly, no scripts besides the scene's own bundled module; a pack is at most 25 MB; each asset has its license in `scene.json` or a `LICENSES.md` (all art and sound must be original or under an allowed license; no copied images, sounds or fonts); textures are made for the drawing size; the host loads the atlas of the active scene only and releases the decoded image once it is on the graphics card (this and the reload guard apply to every scene, because the host owns loading). A scene loads files through `host.assets.load(path)`, which is limited to its own folder.

Sound: short, quiet, synthesized or recorded by the author; plays only as a reaction to the player's action (host rule); can be switched off in the host settings.

## 10. Services the host provides (v0)

"Extract, do not design" still holds: none of these is built before a scene needs it. The first user is named.

| Service | What a scene gets | First scene | Network |
| --- | --- | --- | --- |
| `host.clock` | the only time source; a manual clock for tests | fishtank | no |
| `host.time` | **built in P2 (`app/page/time.js`):** the date and time on the computer's own wall (`parts()`), sunrise, solar noon and sunset (`sun()`: noon from the computer's zone at its standard offset, the length of the day from the place's latitude) and `nightness()` (0 to 1, smooth). The season as a curve over the day of the year is the scene's (`scenes/farmhouse/game/season.js`), not the host's | farmhouse | no |
| `host.place` | **built in P2 (`app/page/place.js`), 0.2: the default place only:** `get()` gives name, latitude and longitude rounded to 0.1 degree, and the source (`default` or `player`); "Atlanta, GA" until a city is typed (0.4, DEC-60). Country, region and an IP lookup are not built | farmhouse | optional |
| `host.data` | granted data kinds (`weather@1`, `tasks@1`, ...) with `updatedAt` and `source: live or simulated` | farmhouse, desk | yes |
| `host.safeArea` | **built in P2 (`app/page/safeArea.js`):** `get()` gives the insets of the taskbar, menu bar and Dock (the screen minus its work area) and the strip where icons sit (left on Windows, right on the Mac), in the scene's CSS pixels; all zero in a window | farmhouse, desk | no |
| `host.ui` | a node for HTML (window mode); `prompt(text)` a small host dialog for one line | fishtank, desk | no |
| `host.sound` | define named short sounds as recipes (`define(name, recipe)`) and play them (`play(name)`, only after a player action); built in 0.1, DEC-51 | fishtank | no |
| `host.net` | a named request to a declared host (document 2) | none yet | yes |
| per-scene options | declared in `scene.json`, shown in the host's menu and settings | farmhouse, desk | no |

### 10.1 The tray menu: host items and scene items

The menu has two parts with one separator between them. The **scene part comes first** because it holds what the player does most (feeding, refreshing); the **host part is fixed** and the same for every scene, so the player always finds Scenes, Settings and Quit in the same place. A scene cannot add to the host part, reorder it or hide it, and the host never edits the scene's items.

```
  Fed 3 hours ago                     scene   status()  (grey text, not a button)
  Feed the fish                       scene   menuItems(): at most 12 items, plain text
  Species >                           scene
  ----------
  Options for Fish tank >             host    built from the manifest `options`
  ----------
  Scenes >                            host    Fish tank (checked), Farm house, Desk ...
                                              ----
                                              Get more scenes...        (opens the store window)
                                              Updates for 2 scenes      (only when there are updates)
  Show in a window / Show on desktop  host
  Always on top                       host    (window mode only)
  Sound                               host    (checkbox)
  ----------
  Settings...                         host    covered-desktop, reduce motion, network, place, sources, ...
  Help >                              host    Check for updates..., Send error report...,
                                              Copy diagnostics, Open log folder, About
  Version 0.2.0 is available          host    (only when the index says so, section 5.6)
  Quit                                host
```

| Part | Who builds it | What is in it | Limits |
| --- | --- | --- | --- |
| Status line and scene items | the scene, through `status()` and `menuItems()` | its own actions and choices: feed, refresh, species, "Mark done" | plain text, at most 60 characters a label, at most 12 items, ids are opaque; the main process only accepts an id from the last menu it built |
| "Options for <scene>" | the host, from `options` in `scene.json` | the scene's declared choices (season, theme), as radio items or checkboxes | what the manifest declares; the scene hears `onOption` |
| Scenes, display mode, Always on top, Sound | the host | switching, getting scenes, showing in a window or on the desktop | the same for every scene |
| Settings, Help, update line, Quit | the host | settings window, the error report and diagnostics, About, quit | the same for every scene |

How it works: the main process asks the scene for `status()` and `menuItems()` when the menu opens (300 ms limit, last answer if the scene is late) and builds the whole menu itself. Host notes appear as a disabled grey line at the top of the host part when they matter ("Could not attach to the desktop, using a window"; "Drawing paused: desktop covered" is not shown, it is normal). A scene that is disabled or still loading shows only the host part. On the Mac the same items form the app menu (named after the scene), plus the menu bar icon's menu. In desktop mode every action of a scene exists as an item here, because the desktop takes no clicks.

The tray menu is built from `status()` and `menuItems()`. The menu data keeps one rule from the old project: the main process asks the scene when the menu opens (300 ms limit) and uses the last answer if the page is late, so nothing is pushed in the background and a paused scene still answers. The main process caches the answer, trims labels to plain text of at most 60 characters, and accepts only an id from the last menu it built; there is no fixed set of actions in the main process.

## 11. Settings screens, logging and diagnostics

- **Settings** are host pages (never scene pages): display mode, always on top, launch at login, sound, "When the desktop is covered", network (ask, allow, never), place, data sources (document 2), scenes (installed, get more, remove), the options of the active scene, About, and a **Help** group with "Check for updates...", "Send error report..." (for players) and "Copy diagnostics" and "Open log folder" (for developers). The tray menu carries the frequent items.

**The host settings, all in one list** (`settings.json`; a scene never reads or writes them, it only sees what `host.settings` shows):

| Setting | Values | Default |
| --- | --- | --- |
| Active scene | a scene id | `fishtank` |
| Display mode | desktop, window | window on the first run, then the player's last choice |
| Always on top (window mode) | on, off | off |
| Launch at login | on, off | off |
| Sound | on, off | on (sound only ever follows the player's own action) |
| When the desktop is covered | always pause, pause on battery only, never pause | always pause (`always`) |
| Reduce motion | follow the system, on, off | follow the system |
| Network | ask, allow, never | ask the first time a feature needs it |
| Place | a typed city, the time zone, IP lookup | the time zone (no request); IP lookup only with consent |
| Scene updates | check once a day (an "Update" button does the install), update automatically (later, section 5.6), off | check once a day, after the player has opened the store once |
| App updates | tell me (a line in the menu and a link), install automatically (later, once the app is signed), off | tell me |
| Developer mode | on, off | off (section 5.4) |
| Data sources | a list the player builds | empty |
| Options of the active scene | declared in its `scene.json` | the scene's defaults |

Not settings, but in the same window: the scenes list (installed, get more, remove), About, and the Help group below. Candidates for later, not built: a "quality" choice that lowers the drawing cap, and choosing which display the scene uses.
- **Logging** is local: a log file with a size cap and rotation in the data folder, `host.log(level, message)` for scenes (rate-limited and length-capped), and the host's own events (attach, errors, power changes, network calls by host name only). No telemetry.
- **"Copy diagnostics"** is for developers (a contributor testing a scene, or a person helping on an issue): text to paste into a message, with more detail than the player's report. It holds: version, system, GPU (vendor named), display, mode, scene id and version, power state and the covered setting, the measurements of the last hours (CPU, memory with the basis named, frames), the start times, the last desktop attach, the capabilities granted, the hosts called, and the last log lines. It is sanitized: the home folder and the user name never appear, and tokens and the text of data kinds never appear. 
- **"Send error report..."** is for players: a small window with an optional "What happened?" box and the exact text that would be sent (a short, sanitized summary and the last 200 log lines), with **Open GitHub issue**, **Copy report** and **Cancel**, and a visible support address (version 1; a single **Send** is added when the endpoint exists). Nothing leaves the computer without the player pressing one of them. It uses the same sanitizer as "Copy diagnostics" and a smaller size. The window offers **two buttons and a visible address** (a GitHub issue, copy, and an e-mail written by hand), and a direct "Send" later; the ways, the endpoint and the rules are in document 2, section 12. A player never needs the word "diagnostics".

## 12. Developing and testing a scene

The scene dev kit is how contributors really work, so it is part of the platform.

- **`npm run dev:scene -- <id>`** (built, work package 8.4, part 1; DEC-53) is `npm run dev` for one scene: its own data folder (`<temp>/2nddesktop-dev-scene/<id>`, so the player's tank and records are never touched), window mode, `DESKTOP2_DEV=1`. The **dev kit** (`app/page/devKit.js`, a panel at the top right of the page, window mode only, never in the product) works for any scene and has: the **clock** (`app/page/clock.js`: a date and time, jumps of -1 day, +1 hour, +6 hours, +1 day, +7 days, +30 days, a speed of x1, x60, x600 or x3600 that does not jump, "now"; after a jump forward the scene gets `resume(gap)` and an update, as after a pause), the **shape of the stage** (the window, 3:2, 4:3, 16:9, 21:9, a square, a portrait: the stage is cut to the shape and `resize()` is called with it) and a **pause** (as if the desktop were covered). **Not built yet** (they need the things they control): weather, place, wind and the data kinds (0.4), the power state, desktop-mode input in a window (use `DESKTOP2_TEST=1 DESKTOP2_TEST_RENDER_MODE=desktop`), a 4K stage bigger than the window.
- **`npm run new-scene -- <id> ["Name"]`** (built, work package 8.3) copies `templates/scene/` to `scenes/<id>/`: a `scene.json` (`"dev": true`, so a release never lists it until its author takes the line out), an `index.js` that implements the whole contract and its rules in comments (a box that follows the pointer, a record of starts and taps, tray items for every click, `dispose`), a `state.js` with the record logic and a unit test for it. It refuses a bad id or name and a folder that exists. The template is outside `scenes/` (DEC-52), so the app does not bundle it or list it; the contract test runs on the scene it makes.
- **`npm run shot -- <scene> <size> <mode> <seconds>`** takes a screenshot without touching the real screen. It is reproducible (fixed seed, manual clock, seeded `Math.random`, the scene stepped by simulated seconds), so two runs of the same code give the same picture on one machine. Screenshots are a human check, valid on one machine and graphics card only.
- **The golden state hash** is the gate for any change that must not change behaviour: a test runs a scripted session and a fixed number of `update` steps with the seed and the manual clock, and hashes `serialize()` and the scene graph (nodes typed by `renderPipeId`, because minified class names change). GPU output differs between machines; the state does not.
- **The contract test** runs for every folder in `scenes/`, in the Electron end-to-end suite (it needs WebGL): create; resize to three sizes; 600 updates; serialize; dispose; the number of PixiJS objects, textures and listeners returns to the start; a record saved and loaded gives the same state. It also measures the time of `update()` per frame (p95), the garbage per frame, and the number of graphics textures after 30 resizes; it runs every scene a second time as desktop mode gives input (`pointer(null)`, no `click`, no `host.ui`); and it checks that a scene paused for an hour and then resumed has the same state as one that ran the whole hour.
- **Contract test, as built (`tests/e2e/contract.spec.js`, work package 8.2):** for every folder in `scenes/`, in the real page, a second instance of the scene with a host of the test's own: create; four sizes (320 x 240 to 3440 x 1440); 600 updates with the pointer moving; a click (window mode); `status`, `menuItems` and an unknown menu id; a pause and a resume after an hour; `serialize()` is plain data; a record saved through `host.record.save` loads in a second instance that then runs; `dispose()` destroys the root and leaves the stage and the ticker as they were; five more cycles of create and dispose add no textures after the first; 30 more resizes add none; `update()` is under a frame (the 95th percentile is printed); all of it again in desktop mode (no click, no HTML area). **Not built yet:** "paused for an hour has the same state as one that ran the hour" (the tank and the empty scene do not change with the clock; the farm house will, and gets this check with it) and the garbage per frame (`npm run measure:alloc`). `window.__scene.host` and `.create` (debug and dev only) give the test the page's host and the scene's `create`. PixiJS lists a hole for each destroyed texture in `renderer.texture.managedTextures`, so only live entries are counted.
- **The capability test** runs each scene with no capabilities granted and checks that it still starts and draws (an empty state), and that denied calls fail quietly.
- **Switching 20 times** between two scenes must not grow memory (a script, not a CI test): `npm run measure:switch` (also the frame-time and memory baselines of one scene); the numbers are in `05` section 3.1. Read the result after a forced collection (`--gc 1`): the page of an old scene is freed by the garbage collector when Chromium needs the memory, so a reading right after a burst of switches is high.
- **CI** runs lint, format, unit tests and the end-to-end suite on both a Windows and a macOS runner; a PR needs both green. Windows builds; a macOS session or machine runs the Mac-only checks (menu bar, Dock, `.icns`, memory in `phys_footprint`).

## 13. Open questions

**Decided by the owner on 2026-11-23**

1. The covered-desktop default is `always` ("Always pause", section 7.1): first `auto`, changed later the same day for less fan noise. The question about measuring a covered scene on AC is closed.
2. The name is **2ndDesktop**, and the repository has the same name.
3. One scene at a time, on the main display, for now.
4. The player never sees two scenes at once.
5. English only. No localisation. (Cheap habit, optional: keep the host's menu strings in one file.)
6. Reduce motion is honoured (section 7.4); frame rates per scene are in section 7.3.
7. Scene pictures are shown in the scene store window, not in the tray menu; every scene has a thumbnail (section 5.3).

**Still open**

1. Check the name: the domain, the trademark, the GitHub organization, and a spelling test (document 3, section 8). Written `2ndDesktop` for people and `2nddesktop` for identifiers. **The owner agrees to do the check; it is not done yet.** The domain also decides the support e-mail address (document 2, section 12).
2. The review rules of document 2, section 8.1: the first maintainer is the owner, **Tuan Tran**. A second named maintainer, and the promised review speed, are still to choose before the first outside scene.
3. Where the owner's own scenes live after the contract is v1 (stay in the platform repository, or move to `2nddesktop-scenes`): decided at 1.0. **The owner leans to `2nddesktop-scenes` (option B) for the desk and Stretch.** Recommended: keep the code in the platform repository until then, because while the contract is v0 a contract change and the scenes that follow it should be one commit and one review, not two repositories kept in step; the move is cheap later (a history-keeping split of the folder, and each catalog entry changes only its `repo` and `path`).
4. **Gaps between the old contract and sections 8.2 and 8.3, found while planning the move of the tank** (`../scenes/fishtank-migration.md`, section 4): (a) how a scene gets its atlas: the manifest has no `atlas` field and `host` has no `art`; proposal: keep `"atlas": "assets/art/atlas.json"` in the manifest and give the scene `host.art = { textures, scale }`, because the host owns uploading it and closing the decoded image; (b) where a scene's diagnostics line goes now that `status()` returns one line; (c) `host.seed` must give the same sequence as the old `host.rng` for a test seed, or the golden hash moves; (d) how a scene brings its own sounds (proposal: `host.sound.define(name, recipe)`); (e) `budget.memoryMB` is one number but the tank costs 33 MB on Windows and 70 on macOS.
5. **Session scenes** (needed by `../scenes/stretch.md`; **deferred to version 1.1** by the owner on 2026-11-23, not part of 1.0): a scene that is not a wallpaper, is started by the player and ends itself. Proposal: manifest fields `kind: "session"`, `modes: ["window"]`, a `window` request (always on top, size) and a `sessions` list so the host can put "Start ..." in the tray without loading the scene; a **visit** (the host remembers the current scene and mode, switches to the session scene in window mode with the usual save handshake, and switches back when it ends); `start(sessionId)` and `host.session.end()` for the scene. A second page running at once is rejected because of the memory budget (an estimate: a spike should measure a second small window on both systems first). Three rules for a visit: a second Start while one runs is ignored; quitting during a visit saves the earlier scene as the active one; a crash or failed load during a visit returns to the earlier scene (`../scenes/stretch.md`, section 6). Keep one hook from 0.2: the saved active scene and the reload guard's fallback mean "the last scene that is not a visit" from the start (the Mac's Re W-27). Waiting for the owner's yes, then it goes into section 8.

6. **The status line of a scene that is not loaded** (needed by `../scenes/stretch.md`: "Done today at 14:10" in the tray while Stretch is not running). Today a scene reads only its own record from inside the scene. Proposal (the Mac's second option): the scene hands the host a ready line when something happens, `host.statusLine.set(text, { day })` with `day` the local date from `host.clock`; the host keeps it per scene and shows it **only when `day` is the local today at the moment the menu opens** (pull-on-open, FR-61), so a line from yesterday stops showing at midnight with no timer, and the host never needs to know a record's format. Waiting for the owner's yes.

**Decided by the owner (2026-11-23, the Mac's design review):** Stretch and session scenes are not part of 1.0 (1.1 if complicated); a signed public release of the two bundled scenes (0.3) comes before any store; the store is built when there are enough users and developers who want to contribute; the app update check is separate from the store; complex features that need a lot of effort go to later versions (`03`, section 6.1).

**Decided by the owner (2026-11-23, second round):** the catalog signing key starts as a secret of a protected GitHub environment (section 5.4). **Confirmed in the fourth round:** a separate `2nddesktop-catalog` repository, and the two bundled scenes in the platform repository while the contract is v0 (when to move them out is decided later). **Scope of the first versions (owner):** the platform and the two bundled scenes; the store comes only when there are enough users and contributors (`03`, section 6.1).

**Decided by the owner (2026-11-23, third round):** the covered-desktop default is `always`; the error report starts as a pre-filled GitHub issue (document 2, section 12); the weather is fetched once an hour from 7:00 to 19:00 (document 2, section 11; **replaced on 2026-11-24** by "once an hour while the computer is awake and a weather scene is active"). **Accepted by the owner in the same round ("accept all"):** the release and update plan (document 3, section 3), scene updates by a button first and automatic later (section 5.6), app updates as a notice with a link first, the tray menu layout (section 10.1), first-party scenes kept in the platform repository with no extra repository (section 5.4), and the layered review rules for outside scenes (document 2, section 8.1). The names of the maintainers are still to be chosen (section 13, "Still open", item 2).

## Appendix A: the scene design document (template)

Each scene has `DESIGN.md` next to its code, one or two pages, with these headings. A scene that is only an idea keeps it in `docs/scenes/<id>.md` until the folder exists.

1. Summary and vibe (two sentences and the tone).
2. The player's experience (first minute, a normal day, after a week away).
3. Interaction: what the scene does with no input (desktop mode), the tray items, window-mode clicks, Edit mode if any.
4. Rules and state: the record fields, the clock rules, the numbers (in one config file).
5. Look and sound: layers back to front, art sources and how they are made, sizes, the style guide, sounds.
6. What it needs from the platform: capabilities, data kinds, services, options (this is the manifest in words).
7. Budget and performance: the measured memory over the empty host, frames, GPU, the frame-rate hint.
8. Offline behaviour and privacy: what it shows without a network, what data leaves the machine and to whom.
9. Tests: the golden hash, the contract test, hand checks.
10. Open questions and what is out of scope.
