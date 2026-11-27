# Platform 3 of 5: Distribution, backend, roadmap and reuse of the old code

Status: Draft v0.1, 2026-11-23, updated after the Mac review. Companion docs: `01-platform-architecture.md`, `02-security-data-and-network.md`.

**Staging (owner, 2026-11-23, fifth round).** Versions 0.1 and 0.2 are the plan: the tank in the new repository, then the platform core and the farm house, fully offline. **Version 0.3 is next**: the signed public release of the two bundled scenes, with the app update check and the error report (`03`, section 6.1). Everything here that belongs to version 0.4 and later (live weather and the network, connectors, secrets, open contributions, session scenes, and the scene store and catalog, which are version 1.2) is **design notes**: written down so that the choices of 0.1 and 0.2 do not block it, and **not backlog** until its version starts and the event that unlocks it has happened. The contract stays v0 until the third scene has been written against it (`03`, section 6.1).

## 1. What the owner wants [owner]

A release that people download and install on Windows and macOS. It contains two scenes, the fish tank and the farm house, and starts with one of them. From the tray menu the player can get more scenes, switch to a new one, and enjoy it. There is a "Send error report" button, so some endpoint exists. Scenes are open source and contributors add their own.

## 2. How players get scenes: the recommendation

**A curated, signed catalog on GitHub, with no backend at first.**

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| A. Static catalog on GitHub (recommended) | A `catalog.json` index (signed) on GitHub Pages or a Release, and each pack as a Release asset. The app downloads the index, shows the list, downloads a pack, checks the hash and the signature, installs it. | No server to run or pay for; free hosting and CDN; the review is a pull request; every change is public and auditable; revocation is one file | GitHub rate limits and terms apply (fine for a small project); no ratings or accounts |
| B. Own backend | An API and storage for scenes, uploads, accounts, ratings | Search, ratings, one-click publishing for authors | Servers, money, moderation, abuse, legal duties (takedowns, privacy), an attack target; the old Postgres design is more than this project needs |
| C. Static catalog behind a CDN | Option A with Cloudflare (or similar) in front of the same files | Lower latency, traffic spikes, no change of workflow | One more account; do it when traffic asks for it |
| D. Open uploads (Workshop style) | Anyone publishes a scene | Most content | The Wallpaper Engine malware case (document 2): not without isolation that does not exist yet |

Start with A, move to C when needed, and build B only for a reason that A cannot serve (ratings, accounts). "Send error report" needs one tiny serverless endpoint (document 2, section 12), not a backend. The full picture and the publishing pipeline (GitHub to store, with a diagram) are in document 1, section 5; this section keeps the summary.

### 2.1 The flow

1. **Contribute.** The author keeps the scene in their own repository (the owner's first-party scenes can stay in a folder of the platform repository, document 1, section 5.4) and sends a pull request to the **catalog repository** (`2nddesktop-catalog`, separate from the platform repository: document 1, section 5.4) with one small entry file (repo, path, exact commit). The two bundled scenes live in the platform repository instead. CI fetches that commit, builds the pack from source with the platform's own pack tool (never the scene's scripts), runs the contract and capability tests on both runners, the lint tripwires, the license, size and thumbnail checks, and shows the capability list and the diff from the last version. A maintainer reviews (document 2, section 8). A second maintainer approves a change of capabilities. Details: document 1, section 5.4.
2. **Publish.** Merging runs the release workflow: it rebuilds the pack from the pinned commit in a clean job with no secrets, computes the SHA-256, and a separate sign job in a protected environment writes and **signs the index** (`catalog.json` with the hash of every pack, a sequence number, an expiry date and the revoked list, plus a signature file). One signature covers the whole store. The signing key is an Ed25519 key (its public half is built into the app; a second public key is built in for rotation).
3. **Browse.** The tray menu has "Scenes": the installed scenes (the active one marked) and "Get more scenes...". That opens the **scene store window** (a trusted host page; every scene has a required thumbnail; the tray menu shows names only) with the catalog: picture, name, one line, author, license, size, version, the capabilities in plain words ("Shows your local weather", "Connects to example.org"), and Install. Opening it is the first network call, so the first time it asks "Look for new scenes online?" (the global network setting applies).
4. **Install.** The app downloads the pack to a temporary folder, checks the size, the SHA-256 and the signature, unpacks it safely (no path outside the folder, no links, a limit on file count and unpacked size, only allowed file types), validates `scene.json`, and moves it into place atomically: `<data>/scenes/<id>/<version>/`. The previous version stays for a rollback. Nothing runs before the checks pass.
5. **Switch.** "Use this scene" asks for consent to its capabilities if it has any, saves `activeScene`, and the main process reloads the scene page (document 1, section 4). Each scene keeps its own record.
6. **Update.** Once a day (a setting, on by default only after the player has opened the store) the app compares versions with the signed index. If a newer pack exists, the tray menu shows a quiet line ("Updates for 2 scenes") and the store card shows an **Update** button; there is no notification. An update that changes capabilities asks again. Automatic updating of scenes is a later setting, off by default (document 1, section 5.6).
7. **Revoke.** A pack listed in `revoked` is disabled at the next check and the app falls back to the default scene.
8. **Remove.** "Remove" deletes the pack and, if the player agrees, the record; it never removes a bundled scene.

### 2.2 The scene package: what the author defines, and the release checklist

A `.scenepack` is a zip with: `scene.json`, `index.js` (one bundled and minified ES module), `assets/`, `LICENSES.md`, `DESIGN.md`, and a `files.json` with the hash of each file. Packs are at most 25 MB. The bundled scenes of the release use the same format, so the app has one loader for both.

```
desk-0.2.0.scenepack  (a zip)
  scene.json        the manifest: id, name, version, capabilities, thumbnail ... (document 1, section 8.2, with the table of every field)
  index.js          built by the pack tool from the source (the source is what is reviewed)
  assets/           thumbnail.webp (required), art/, audio/, data/, fonts/
  LICENSES.md       the license of every asset
  DESIGN.md         the scene's design document
  files.json        SHA-256 of every file above (written by the pack tool)
```

**What the author does to release a scene** (the same for the owner's scenes and outside ones; `CONTRIBUTING.md` carries this list):
1. **Fill `scene.json`.** The id, a version that is higher than the last published one, the `apiVersion` and `minHost` it was written for, the licenses, the capabilities (as few as possible), the memory budget measured with the dev kit, and the thumbnail.
2. **Run `npm run validate` and `npm run pack`.** They are the catalog's own checks on the author's computer: the schema, the file rules, the lint tripwires, the contract and capability tests, and the pack build. The result is a `.scenepack` the author can load with Developer mode, to see the scene in the real app.
3. **Tag the version** in the source repository (`desk-v0.2.0` for a folder in a shared repository, `v0.2.0` for a repository with one scene) and note the commit.
4. **Open the catalog pull request** with the entry file (`repo`, `path`, `commit`, `maintainers`) and fill in the template: rights, capabilities in words, what changed. For an update the entry changes only `commit`.
5. **Answer the review.** After the merge, the release workflow builds and signs; the scene appears in the store within minutes of the workflow finishing. The version number never goes backwards, and a version that was published is never changed: a fix is a new version.

A scene that is **only a JSON description** (the later T2 tier) uses the same package with no `index.js`.

### 2.3 Where to host and what it costs

GitHub Pages or Releases, free for public repositories. The app's own updates use the same place. A CDN is added only if needed.

### 2.4 Registering a scene and approving it, step by step

This section is the same flow as 2.1 and 2.2, told once from each side, with the places to click. It describes the plan; none of it is built yet. The GitHub settings named here (branch protection, `CODEOWNERS`, an environment with required reviewers) are standard GitHub features, but the exact wording of their screens has to be checked when they are set up.

**The contributor registers a scene (about ten minutes once the scene works):**

1. Keeps the scene in a repository of their own (or a folder of one), with `scene.json` filled in (section 2.2).
2. Runs `npm run validate` and `npm run pack` on their computer, and fixes what they report. They can try the pack in the real app with Developer mode.
3. Tags the version and copies the **full commit hash** (40 characters; a branch name is refused).
4. Forks `2nddesktop-catalog` and adds **one file**, `catalog/scenes/<id>.json`, with `id`, `repo`, `path`, `commit`, `maintainers`. (An update changes only `commit`.)
5. Opens the pull request. The template asks for: the rights to the art and sound, the capabilities in plain words, what changed, and a tick for "I read the review checklist".
6. Waits for the checks (a few minutes), reads the report the bot posts, answers the reviewer's questions in the PR, and pushes a new commit hash if a fix is needed.
7. After the merge the scene shows in the store when the release workflow finishes.

**The maintainer reviews and approves (the owner, Tuan Tran, and a second person once named):**

1. **Get the request.** GitHub notifies the maintainers of a new pull request (the template adds the label `new-scene` or `update`, and `capabilities-changed` when the capability list changed). Check the PR's author against the entry's `maintainers`: only they, or a project maintainer, may change an existing entry (`CODEOWNERS`).
2. **Read the bot's report first.** It shows: all checks green or red; the capabilities in words; the size and the change in size; the files that changed between the old and the new commit (a link to the compare view); the license result; whether `scene.json` asks for more than the code uses. A red check is sent back to the author with no further reading.
3. **Read the code at the pinned commit** to the depth that the capabilities ask (document 2, section 8.1: levels A, B, C). A scene with no capabilities gets level A: the compare view, the new files, a look at anything that fetches, builds a string for code, or opens something outside the scene's own folder. A scene with `net` or `secrets` gets level C: every line, run in Developer mode on a clean profile, and the network calls watched.
4. **Run it.** Download the pack the CI built (an artifact of the PR) and load it with Developer mode on one Windows and one Mac machine, or ask for a screenshot from each if there is no second maintainer's machine. Ask: "would I leave this on my desktop?"
5. **Decide in the PR:** *Request changes* (with the points as comments), or *Approve*. A change of capabilities, and every first scene of a new author at depth B or C, needs **two approvals**. The PR template's checklist is copied into the review.
6. **Merge** (squash, so one entry change is one commit). Do not merge a PR whose checks are not green; the branch rules make that impossible.
7. **Approve the signing.** The merge starts the release workflow. Its build job runs by itself; its **sign job waits** in the protected environment `catalog-signing` until a maintainer opens the run in GitHub (Actions, the run, "Review deployments") and approves. The maintainer checks that the run builds the commit that was reviewed, then approves. The environment is set so that the person who started the run cannot approve it, when there are two maintainers.
8. **Look at the result.** Open the store in the app (Developer mode shows the new index at once), install the scene, and use it for a minute. If something is wrong, **revoke** with a PR that adds `{ id, version, reason }` to `revoked` (document 1, section 5.4).

**While there is only one maintainer.** GitHub does not let a person approve their own pull request, and the two-approval rules cannot be met by one person. So at the start: (a) the owner's own scenes are merged by the owner after the checks are green, after a written self-review with the same checklist, and after waiting a day; (b) **no outside scene is merged** until a second maintainer exists; (c) the environment's "required reviewer" is the owner alone, and the sign job still waits for a click, which at least stops an accident. This is a stop-gap, and it is why the second maintainer is on the open list (document 1, section 13).

**Time limits** (borrowed from similar projects, document 1, section 5.4): an author who does not answer a review comment for three weeks has the PR closed (they can reopen it); one author has at most three open PRs.

## 3. Releasing 2ndDesktop: what is in a release, where it is downloaded, how it is installed

### 3.1 What a release is

A release is a **version tag** (`v0.1.0`, semver) on the platform repository and a **GitHub Release** made from it by a workflow. The release contains:

| File | Purpose |
| --- | --- |
| `2ndDesktop-Setup-<version>-x64.exe` | the Windows installer (NSIS, per user, no administrator rights needed) |
| `2ndDesktop-<version>-arm64.dmg` | the macOS disk image for **Apple silicon only** (owner, 2026-11-23: Apple silicon Macs have been sold for six years). The old universal image was 215 MB; the Apple silicon image measured **114.5 MB** (zip 111.1 MB, installed app 254 MB; the universal app is 487 MB installed). An Intel Mac cannot open it (macOS says it cannot be used with this type of Mac), so the download page says "Apple silicon" in words, next to the first-open steps. An Intel image is added only when someone needs it |
| `2ndDesktop-<version>-arm64.zip` | the macOS zip that the automatic updater needs later (below, 3.5) |
| `latest.yml`, `latest-mac.yml` | the update feeds that electron-builder writes; only used once automatic updates exist |
| `SHA256SUMS.txt` | the checksum of every file, so a download can be checked by hand |
| build attestations | a GitHub signature that ties each file to the workflow and the commit (document 1, section 5.4); checked with `gh attestation verify` |
| Release notes | what is new (from `CHANGELOG.md`), the **bundled scenes and their versions**, the known problems, and the oldest operating system supported |

Inside the app package: the host, the bundled scenes (fish tank, farm house) as **packs built by the same pack tool** as the catalog's, the public keys for the catalog (two), `THIRD-PARTY-NOTICES`, and the licenses. Nothing is downloaded at install time.

**What must be defined for a release** (the checklist in `RELEASING.md`):
1. The version (app semver) and the `apiVersion` the app supports (this and the previous one).
2. The bundled scenes and their versions; each passes the contract test.
3. The oldest supported Windows and macOS (the oldest that Electron 45 supports; state the numbers in the README after checking).
4. The catalog's public keys inside the app are the right ones (a test compares them with the repository's).
5. The release notes and the `CHANGELOG.md` entry.
6. The signing identities are valid (Windows certificate or SignPath, Apple Developer ID and notarization).
7. Tests green on both runners, the golden hash unchanged unless the change was intended, the budget numbers of the baseline run (section 7.2 of document 1) not worse.

### 3.2 Where players download it, and how they install it

- **Download:** the release page of the repository (`https://github.com/<owner>/2nddesktop/releases/latest`) and a small **download page** on GitHub Pages that shows two buttons and picks the right one from the system. The workflow regenerates that page at each release with the exact file links, so the buttons never point at an old file. The README links to it. (A fixed link such as `.../releases/latest/download/<name>` needs a file name without a version; the page avoids that.)
- **Windows:** run the installer. It installs for the current user, adds a Start menu entry, and starts the app, which shows in the tray. While the app is new or unsigned, SmartScreen shows "Windows protected your PC": **More info > Run anyway**. The README says this with a screenshot. Uninstall from "Apps" in Settings; the player's data folder stays unless the uninstaller is asked to remove it.
- **macOS:** open the disk image and drag 2ndDesktop to Applications. A signed and notarized app opens normally. An unsigned one needs "Open Anyway" in System Settings > Privacy & Security (on recent versions of macOS right-clicking is no longer enough); the README says which, once the first signed build is tested. To remove: drag it to the Bin; the data folder stays.
- **First run:** the first scene (the fish tank) appears in a window, with a short hint about the tray icon. Nothing asks for a permission, an account or the network.
- **Data folder:** `%APPDATA%\2ndDesktop` on Windows and `~/Library/Application Support/2ndDesktop` on macOS (the exact names are decided with the product name). The README says where it is and how to delete it.

### 3.3 How a release is made

1. A maintainer opens a "release" pull request: version bump, changelog, bundled scene versions. It merges after both runners are green.
2. The maintainer pushes the tag `v0.1.0`. A **release workflow** (in the protected environment `release`, which holds the signing secrets) builds the installers on a Windows and a macOS runner, signs and notarizes them, writes the checksums, attests them, and creates a **draft** GitHub Release with every file.
3. The maintainer installs the draft's files on **clean machines** (a Windows machine or virtual machine, a Mac) and runs the smoke test: install, first start, switch scene, restart, error report window, uninstall.
4. The maintainer presses Publish. A second workflow then regenerates the download page, and the next catalog release carries the new `app` block (`latest`, `url`) so that running copies learn about it (document 1, section 5.6).
5. A broken release is **withdrawn** by marking it a draft or pre-release again and tagging a patch version; the `minSupported` field of the index can ask older copies to update.

There is one channel at version 1. A `-beta.1` tag is published as a GitHub pre-release and is found only by people who follow the link; the updater ignores pre-releases unless the player asks for them (later).

### 3.4 Installers

- **Installers:** electron-builder: an NSIS installer for Windows (x64; arm64 later), a DMG and a zip for macOS **for Apple silicon (arm64) only, first** (owner), so the universal merge, its `x64ArchFiles` setting and the second `koffi` package are not used for now. **English only on both systems** (owner): `electronLanguages: en` in `electron-builder.yml` drops the other Chromium language packs (49 MB in the Windows folder `locales` alone; measured on Windows on 2026-11-23: the unpacked folder went from 361 MB to 313 MB with only `en-GB.pak` and `en-US.pak` left; measured for the Mac on 2026-11-23 too: the Apple silicon image is **114.5 MB** (zip 111.1 MB, installed app 254 MB; the universal app was 487 MB installed; `en.lproj` and `en_GB.lproj` are left, nothing more can be cut). **A machine that once ran the universal build still has the x64 `koffi` package in `node_modules` and would ship it** (256 MB instead of 254): the `dist` script stops calling `koffi-universal.mjs`, or `files` excludes `!node_modules/@koromix/koffi-darwin-x64/**`; a clean machine or CI (`npm ci`) is not affected). An Intel Mac cannot open the Apple silicon build (macOS says it cannot be used with this type of Mac), so the download page says "Apple silicon" in words, next to the first-open steps. Why the size matters and what else was considered (Tauri and others): the fish-tank installer is 117 MB on Windows (361 MB installed) and the universal Mac image was 215 MB; Electron's Chromium is about 200 MB installed per architecture and cannot shrink. Revisit another toolkit only for a measured reason (memory budget, download complaints).

### 3.5 App updates: a link first, the updater later

- **Version 1 (recommended): the app only tells, and the check does not depend on the store** (owner, 2026-11-23; the Mac's E-9). From the first run the main process fetches one small file once a day and on "Help > Check for updates...", from a fixed address built into the app. **The file is the one electron-builder already publishes with each release** (`latest.yml` for Windows, `latest-mac.yml` for the Mac, at `.../releases/latest/download/`), and the app reads only its `version:` line, so there is no separate `latest.json` to keep in step (the Mac's point 11; DEC-38; **checked on both systems, 2026-11-24:** electron-builder 26.18 writes `latest-mac.yml` for an Apple-silicon-only dmg and zip build, and `latest.yml` for a Windows NSIS build, each with `version:` on its first line, even with `--publish never` and a `publish: github` entry in the config). A `minSupported` value, if the store needs it, comes later in its own small file. The check uses **only the version number**; the app writes the notice text itself ("Version 0.2.0 is available") and the item opens the project's fixed release page, never a link taken from the file. So a forged answer can at most show that a newer version exists, and the file needs no signature (if it ever carries text or a link it must be signed with the catalog key). **Network setting (decided with this change):** the setting "Network: ask, allow, never" governs what *scenes* may fetch. The update check is its own setting, "Tell me about updates", and "never" does not stop it; About says so in one line, and a player who wants nothing to leave the machine turns that setting off too. The first-run text and About say that the app asks once a day, that this shows the player's IP address to the host like any web request and sends nothing else, and the setting "Tell me about updates" (on by default) turns it off. A player who only uses the bundled scenes therefore still hears about a security release. It needs no updater library and behaves the same on both systems. The store, when it exists, may read the same file for "Update the app to see new scenes".
- **Later: automatic installation** with `electron-updater` reading GitHub Releases (checked 2026-11-23: [electron-builder auto update](https://www.electron.build/v26/docs/features/auto-update) says macOS apps **must be signed** for auto-update to work; for macOS **the zip target is required** (without it `latest-mac.yml` cannot be created), so the release carries both the dmg and the zip; the updater checks signatures on Windows as well; GitHub as a provider works with public repositories without a token). The app downloads in the background and installs on quit, with no pop-ups. Differential downloads on macOS and the exact behaviour of an unsigned Windows build were not found in the docs read: test with a real release before promising either. The setting "App updates" then gains "install automatically".
- **Electron upgrades.** The threat model's answer to a Chromium bug is "keep Electron up to date". Electron supports only its latest three major versions (check the schedule when planning): upgrade within that window and at once for a security release, and after each upgrade run the golden hash and the desktop-attach hand checks of `05-verified-from-fish-tank.md` on both systems.
- **Scene updates** are separate and are in document 1, section 5.6 (an Update button first, automatic later).

### 3.6 Signing

- **Code signing is required before a public release.** An app that downloads and runs scene code must not itself be unsigned: Windows needs a code-signing certificate (SmartScreen reputation takes time even then); macOS needs an Apple Developer ID (a yearly fee) and notarization, otherwise Gatekeeper shows a warning on every first open. The old project was unsigned (a hand check about the Gatekeeper text was still open). Budget the money and the time. Windows options found on 2026-11-23 ([Microsoft's code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)): **SignPath Foundation** offers free signing for qualifying open-source projects (eligibility and current terms not checked: apply early); **Azure Artifact Signing** (formerly Trusted Signing) is about 10 dollars a month, but for individuals only in the USA and Canada; neither gives instant SmartScreen trust, because reputation builds with downloads, and Microsoft says EV certificates no longer bypass SmartScreen. Reports from April 2026 mention new "Unrecognized App" warnings on newly signed files, so expect some warnings in the first weeks whatever is chosen.
- **Scene signing** (section 2.1) is separate from app signing and uses the project's own key.
- **Order: no public build with the store before the app is signed.** The roadmap puts the catalog (P4) before signing (P5), so P4 is **an internal build only** until P5 is done. The owner's own Mac cannot tell the difference, because a locally built app has no download quarantine.
- **Notarization with `koffi` is where the first signed Mac build is likely to fail** (Mac session's expectation, not tried): a notarized app needs the hardened runtime, Electron needs its JIT entitlements, and loading koffi's separate native binary needs it signed by the same identity or the entitlement `disable-library-validation`. electron-builder usually signs unpacked natives, but test it in P5. (While the first Mac release is Apple silicon only, `scripts/koffi-universal.mjs` is not run; it stays in the repository for a later Intel or universal build.) `scripts/koffi-universal.mjs` fetches the missing `@koromix/koffi-darwin-*` package with `npm pack` at the installed koffi version, so `npm run dist` needs the network and a koffi upgrade means checking that script.
- **Launch at login:** a new bundle id is a new Login Items entry on the Mac, and an unsigned app shows as "from an unidentified developer"; repeat the old W-9 check on the first signed build.
### 3.7 Versions

- **Versions:** the app is semver; `apiVersion` is an integer in manifests; the host supports the current and the previous `apiVersion` for one release cycle, and a scene with `minHost` newer than the app says "needs a newer app" and is not offered. Records have `schemaVersion` and `migrate`; a downgrade of a scene with a newer record shows a message and does not overwrite it.

## 4. Backend pieces, in the order they might appear

| Piece | When | Notes |
| --- | --- | --- |
| Static catalog and packs | at the first catalog release | GitHub only |
| Error reports | version 1: a pre-filled GitHub issue, a mailbox and Copy, no server. Later: one serverless route that files the report as an issue in a private repository | document 2, section 12; the mailbox is a free dedicated address, then Cloudflare Email Routing on the project's domain |
| Privacy page and `SECURITY.md` | before the public release | what leaves the machine, retention, deletion, how to report a vulnerability |
| Takedown and abuse process | before the first outside scene | who, how fast, how a revocation is published |
| Ratings, accounts, search | only if wanted | real backend (option B); not planned |

## 5. Licensing and the rules for contributors

- **Code:** MIT (the old project chose it; the shipped dependencies are permissive: Electron, PixiJS and koffi are MIT, the Nunito font is OFL; `@resvg/resvg-js` is MPL-2.0 and a development dependency only, so it does not affect the license).
- **Art and sound:** CC BY 4.0, or CC0; no share-alike and no non-commercial licenses, because they make scenes hard to combine. Fonts under the SIL Open Font License.
- **Contributions:** inbound equals outbound with a DCO sign-off (`Signed-off-by`), not a CLA, unless the owner may want to change the license later (decide before the first outside contribution; it cannot be added afterwards without asking everyone).
- **Only rights that can be given:** no images, sounds or fonts copied from elsewhere (and a reference photo is used for composition only, never traced). `THIRD-PARTY-NOTICES` is generated from the dependencies.
- **AI-made art:** the old project's art was drawn by an AI tool (SVG written by Claude Code). The README says so and asks contributors to say if their art is AI-made, because its legal status differs between countries. The owner confirms that they own the output under the tool's terms.
- **The name** is not licensed: forks use another name (a note in the README).
- **Each scene declares its license** in `scene.json`, and CI checks it against the allowed list.

## 6. Roadmap

### 6.1 Versions: what the player gets (owner, 2026-11-23: offline and bundled scenes first, a signed public release before any store)

| Version | The player gets | Phases (6.2) | Status, and the event that unlocks it |
| --- | --- | --- | --- |
| **0.1** | The fish tank in the new repository, unchanged | P0 | **Plan.** Exit test: every old test passes and the golden state hash is unchanged on both systems |
| **0.2** | The platform core and the farm house, **fully offline** (season and weather simulated from the date, no network at all); two bundled scenes, "Scenes" in the tray, the power setting. P1 **starts with a loader spike** (document 1, section 8.6) | P1, P2 without the network | **Plan.** After 0.1 passes. **Also in 0.2 (DEC-45, done: DEC-56):** the Windows cover check lists every visible window of the primary display, as the Mac does (review finding 1). Shared with a few people as an unsigned build is acceptable, because it downloads no code, **but the build ships with a README of the exact first-open steps on macOS** (W-4: "Not Opened", Privacy & Security, Open Anyway, Touch ID). **Keep one hook now:** the saved active scene and the reload guard's fallback are written as "the last scene that is not a visit" from the start, even though no scene is a visit yet |
| **0.3** | **A signed public release of the two bundled scenes**: code signing, a notarized Mac build (Apple silicon), the download page, the first-open README, the **app update check, separate from the store** (3.5), the error report (two buttons and a visible address), **and the Electron fuses with the asar integrity check (DEC-46, review finding 4)** | P5 without the store's parts | **Next (owner, 2026-11-23).** After 0.2 passes its exit test. This is the first time strangers use it, and it is what tells us whether a store is worth building |
| **0.4** | Live weather and the place, with a consent dialog | the network part of P2 | Design notes. **Test:** the offline farm house has run 24 hours on both systems with no growth in frame time or memory (the old 8-hour method, longer), and the owner wants live weather |
| **0.5** | **Open contributions without a store:** `CONTRIBUTING.md`, the scene template, the dev kit, DCO, and **Developer mode** ("Load a scene folder...", off by default, with a plain warning; document 1, section 5.4), so a contributor shares a scene as a folder and a player loads it by hand. The maintainers bundle an outside scene only now and then, at the depth-C review level (document 2, section 8.1), never as a way to avoid the catalog's rule that strangers' code stays away from the signing secrets (the Mac's point 10) | P6, and the Developer-mode part of P4 | Design notes. When people outside the project ask to contribute |
| **1.0** | The contract leaves v0 once a third scene has been written against it. **Decided (owner, 2026-11-24): the third scene is the project's own small scene**, loaded from a folder by Developer mode with no change to the host, so 1.0 does not wait for an outsider; the contract is published as a `.d.ts` file | | Design notes |
| **1.1** | **Stretch**, with session scenes (a visit, a new window kind). The owner: not part of 1.0; if it is complicated it waits for 1.1 | the session feature (document 1, section 13, item 5) | Design notes. After the instructor prototype passes (`../scenes/stretch.md`, section 5) |
| **1.2** | **The scene store and what it needs**: the catalog repository, the signed index, install, update, revoke, Developer mode (P4); the **desk** and the data kinds and connectors it needs (P3) | P3, P4 | Design notes, **kept here so it is not forgotten** (owner, 2026-11-24). **Built when there are enough users and developers who want to contribute** (owner, 2026-11-23). Judged from downloads, stars, issues and requests from people who want to write a scene; the bar is set when 0.3 is out (agreed 2026-11-24). If the bar is reached earlier, the store may be pulled forward; if not, it stays in 1.2 |
| **Not scheduled** | Declarative scenes (T2), isolated scripts (T3), Edit mode, one scene per display | | Built only after real requests (T2: at least three) |

Rules: a feature is not built before its version starts; the documents after 0.3 are there so that today's choices do not block them. **Complex features that need a lot of effort go to later versions** (owner, 2026-11-23): the store, connectors and the desk are version 1.2; the declarative language and isolated scripts are not scheduled; the second window kind (sessions) is 1.1. **How success is judged** (the Mac's P-5): no telemetry; release download counts, stars, issues, and a link to a short survey in About (optional). The 0.3 release is public, so those numbers exist before the store decision.

### 6.2 Phases: the work packages

Phases, not dates. Each has an exit test.

| Phase | What | Exit test |
| --- | --- | --- |
| P0 | **Bootstrap the new repository** (section 8): the old host and the fish tank, renamed, with CI, docs, the two-machine workflow | The fish tank runs from the new repository on Windows and macOS, with every old test passing and the golden state hash unchanged |
| P1 | **Platform core**, starting with a **loader spike** (PixiJS provided by the host, the page served from `scene://<id>/`, the CSP, WebRTC; document 1, section 8.6) that decides how scenes are loaded before the registry work: manifest and registry, "Scenes" in the tray, switching by reload with the save handshake, the power policy and the "When the desktop is covered" setting, settings pages as host pages, the sandbox configuration of document 2 section 3, the dev kit (`dev:scene`, `new-scene`), the contract and capability tests, an empty scene for baselines | A second trivial scene can be switched to and back with both records kept; the baselines are measured on both systems; the sandbox spike (WebRTC, CSP with PixiJS) is answered |
| P2 | **Farm house** with `host.time`, `host.place`, `host.safeArea`, the weather connector with consent, simulated weather offline | The scene runs on both systems inside its budget; the weather matches the player's place; the contract needed no change beyond what this document records |
| P3 | **Data kinds, connectors and the desk**: `tasks@1`, `events@1`, the local file and ICS connectors, secrets, `host.ui.prompt`, the "Data sources" settings | The desk shows three tasks from a local file and from an ICS URL; no token is visible in any log, diagnostic or page |
| P4 | **Catalog and distribution**: the pack format and pack tool (the bundled scenes move to them when this phase is built or at the first outside scene, DEC-23), the separate `2nddesktop-catalog` repository with its PR checks and release workflow, index signing from a protected environment, attestations, the scene store window (bundled scenes shown as "Included"), install, update, revoke, Developer mode; the **desk** is the first catalog entry (owner: the first versions focus on the platform and the two bundled scenes; this phase is built only when there are enough users and developers who want to contribute (section 6.1); **an internal build only: no public build with the store before the signing of P5**, section 3.6) | A scene is installed from the catalog on both systems, a tampered pack is refused, an old index is refused, a revoked scene is disabled, and a catalog pull request with a changed commit shows its diff report |
| P5 | **Public release** (version 0.3: everything except the store's parts, which wait for the store): code signing, the release workflow and download page (section 3), the update notice in the tray (automatic app updates after signing works), privacy page, `SECURITY.md`, the error-report window (two buttons and a visible address; the endpoint later), a first notarized Mac build tested with `koffi`, the installer tested on clean machines | A person who has never seen the repository installs, switches scenes and sends an error report |
| P6 | **Open contributions**: `CONTRIBUTING.md`, the scene template, the PR template and checklist, DCO, the third scene (leaves contract v0), a dry run by a fresh session that writes a tiny scene from `CONTRIBUTING.md` alone | What it gets wrong is what the file must explain |
| Later | Declarative scenes (T2), isolated script scenes (T3), Edit mode, one scene per display, more connectors, OAuth | |

The old project's Phase 2 effects (light shafts, depth shading, fish shadows, crabs and snails) are tank-only; the day and night lighting becomes a host service (`host.time`).

## 7. Reusing the fish-tank code

### 7.1 One pushback first: new repository or rename?

The owner plans a new repository and to make the fish-tank repository private. Before that: almost everything that took the old project months is **platform code** that the new repository needs (the desktop attach, the tray, pausing, diagnostics, saving, the scene loading of Step 1b, the tests and CI). Three ways to reuse it:

| Way | What you keep | Cost |
| --- | --- | --- |
| A. Rename the existing repository and make it the platform | Everything: history, issues, PRs, CI, stars, redirects from the old name (GitHub forwards them) | The history has 40 pull requests of two Claude sessions talking through large `TODO-*.md` files; the name of the repository changes once (the app name, 2ndDesktop, is now decided) |
| B. New repository with a snapshot (no history) | A clean start and a clean public identity, with no chatter, no personal commit history beyond the first commit | History is lost to the public (the old repository stays private as the archive); `git blame` starts again; pull request links in docs break |
| C. New repository with the history of selected folders (`git filter-repo --path ...`) | The history of the host and the fish tank, without the mailbox files | More work; history still carries old commit messages and the author's name and email |

**Recommendation: B**, taken from one clear point (after the Step 1b move is merged, and with the open pull requests closed or merged), and keep the old repository private as the archive. Reasons: the history is mostly working notes, the new project has a new name and a new audience, and the old repository stays available for reference. Choose A if the owner wants to keep the issues, the stars and the history in one place and does not mind the name change. Whichever way: do not work on the platform in both repositories at the same time, because the host code would diverge; Step 2 of the old plan (registry, "Choose scene", empty-scene baseline) should be built in the new repository from the snapshot, not finished in the old one.

Copyright is not a problem: the owner holds the copyright of the code and the art (the art is AI-made, see section 5) and the license is MIT. Add a `NOTICE` that says where the code came from.

### 7.2 The reuse map

> **Paths in this map** are those of the fish-tank repository (`electron/`, `renderer/`, `tests/unit`); the move of bootstrap step 4 made them `app/main/`, `app/page/`, `tests/host` and `scenes/fishtank/tests`. The map is the plan, so it was not rewritten.

*A detailed version, with the leaks of the tank into the host, the method of three commits and the icon, is in `04-reuse-from-fish-tank.md`; the tank's own folder structure is in `../scenes/fishtank-migration.md`. Where the two differ, document 4 is newer: for example it copies `docs/01` and `docs/02` to `docs/reference/fishtank-v1/`, because about 250 comments in the code cite their numbers.*

| Old path | New place | What to do |
| --- | --- | --- |
| `electron/main.js`, `desktop.js`, `desktop-win.js`, `desktop-mac.js`, `cover.js`, `placement.js`, `frame-fit.js`, `display-mode.js`, `crash-restart.js` | `app/main/` | Keep. This is the desktop integration. Add the power policy (`powerMonitor`) next to `cover.js`; rename the app id, the data folder, the AUMID |
| `electron/tray.js`, `menu.js` | `app/main/` | Keep; the menu is already built from what the scene reports (Step 1b). Add "Scenes" |
| `electron/store.js`, `settings.js` | `app/main/` | Keep. Extend settings (`whenCovered`, network mode, place, consent) |
| `electron/diagnostics.js`, `usage-log.js`, `sampler.js` | `app/main/` | Keep: `sanitize`, GPU vendor names, the memory basis line, the measurements. Add the scene id, capabilities and hosts called |
| `electron/preload.cjs` | `app/main/` | **Rewrite** to the narrow bridge of document 2 section 4 (today's bridge was written for one trusted page) |
| `renderer/main.js`, `scenes.js`, `art.js`, `host.js`, `drawing.js`, `reloadGuard.js`, `SoundPlayer.js` | `app/page/` | Keep; `host.js` (the typedefs) becomes the contract source of truth. Add the CSP and `pixi.js/unsafe-eval` import, `scene://` loading, the capabilities in `host` |
| `shared/rng.js` | `shared/` | Keep |
| `scenes/fishtank/` | `scenes/fishtank/` | Keep as the first scene; add `DESIGN.md` (done: moved from `docs/scenes/fishtank.md`); the Phase 3 and 4 server ideas are dropped |
| `scripts/` (`build-assets.mjs`, `gen-decor-art.mjs`, `shot.mjs`, `pacing-sim.js`, `measure-alloc.mjs`, `sound-lab.mjs`, `make-icons.mjs`, `koffi-universal.mjs`, `run-electron.mjs`, `seeded-random.mjs`) | `scripts/` | Keep. `build-assets` becomes per scene; `shot` takes a scene id |
| `spikes/edit-mode/` | `spikes/` | Keep as reference |
| `tests/unit`, `tests/e2e` | `tests/` | Keep (the golden test is the proof that the move changed nothing). Add the contract test for every scene, the capability test, the sandbox tests |
| `.github/workflows/ci.yml`, `electron-builder.yml` (**mac target `dmg` and `zip` with `arch: arm64`, `electronLanguages: en`**; document 3, section 3.4), `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitattributes`, `vitest`, `playwright` configs | root | Keep; change the app id and product name |
| `assets/` (tray icons, app icon, species art) | per scene and `app/assets/` | The fish art goes to `scenes/fishtank/art/`; the app and tray icons are replaced when the name is chosen |
| `docs/perf-notes.md`, `desktop-spike.md`, `edit-mode-spike.md`, `gate-g1.md` | `docs/reference/` | Keep: they are measurements and findings that cost real time |
| `docs/03`, `05`, `06` | `docs/reference/fishtank-v1/` | Copied after all (decision Q5 of the bootstrap, `DEC-43`), because comments in the code cite them; `docs/reference/README.md` says what the old numbers mean |
| `docs/01`, `docs/02` | `docs/reference/fishtank-v1/` | Kept as the record of the old requirements and design (document 4, section 4, which is newer and wins) |
| `docs/04-implementation-phase-1.md` | `docs/reference/` (optional) | Decisions D1 to D36 are useful history, not required |
| `CLAUDE.md` | root | Rewrite for the new layout, keep the working rules (the calm tone moves to the tank's DESIGN.md; keep: Node 24, Electron pinned, sandbox on, LF endings, the review rules for PRs, no attribution lines) |
| `TODO-Mac.md`, `TODO-Win.md` | root | Keep the mailbox idea (two sessions, one writer per file); start with empty files and the rules |
| `README.md`, `LICENSE` | root | New README; keep MIT |
| `docs/screenshots`, `release/`, `test-results/` | not copied | Generated |

What must **change** in the copy: the product name, the Windows app id (`com.weekend.fishtank`), the data folder names, the single-instance lock name, the `FISHTANK_*` environment variables (rename to the new prefix; keep a note), the installer name. What must **not** change: the scene id `fishtank` and the record file `records/fishtank.json`, so that the owner's own saved tank loads.

### 7.3 Steps for the bootstrap (P0)

1. Pick the snapshot point: Step 1b merged, no open pull request that matters, the golden hash recorded.
2. Create the new repository; copy the files of the map into the new layout; first commit "Import from fish-tank at `<commit>`" with a `NOTICE`.
3. Rename the product strings; make CI green on both runners; run the golden test and the whole suite.
4. Move the documents of `docs2/` to `docs/`; add `docs/reference/`.
5. Write the new `CLAUDE.md` and the two mailbox files; tag `v0.0.0`.
6. Make the old repository private and put a pointer in its README (if it stays public until then).

## 8. What else to discuss

| Topic | Why it matters now |
| --- | --- |
| The name **2ndDesktop** (chosen by the owner). Spelling: shown as `2ndDesktop`; written in lowercase as `2nddesktop` in repository names, the npm package, the data folder and the bundle id (`com.<owner>.2nddesktop`); never `2ndesktop`, which reads as a typo, loses the word "desktop", and would be mistyped both ways. Names that start with a digit are fine for npm (the name rules exclude uppercase, not digits) and for Apple's bundle ids by their documented character rules (letters, digits, hyphen, period; not tried), but **cannot be the prefix of an environment variable** (`2NDDESKTOP_DEBUG` is not a valid name in a POSIX shell) or a JavaScript identifier: use `DESKTOP2_` for environment variables (the old `FISHTANK_*` ones are renamed to it) and `desktop2` or `nd` in code. Still to do: a domain, the trademark search, the GitHub organization, and a test that people can spell it after hearing it | It decides the repository, the Windows app id, the data folder, the installer, the Mac bundle id and the first public impression. Check that the name is free before printing it anywhere; a name that starts with a digit may need care in some identifiers (not yet checked) |
| Governance and the bus factor | **A risk, written down (the Mac's E-17):** one person plus AI sessions holds every signing key and account. First mitigation: an offline rotation key and a written recovery note. One owner and AI sessions; who may merge, who holds the signing key and the Apple and Windows accounts, who answers security reports |
| Money | Apple Developer ID, a Windows certificate, domain, a Cloudflare account maybe; donations or sponsorship, if any (no paid features, no ads) |
| The privacy page and the legal text | Needed before the diagnostics endpoint, the weather lookup and the catalog go public; GDPR-style rules apply to IP addresses |
| The default scene order | The release has two scenes; which is active at first start, and does the first launch ask? (The old rule: no question, the first scene, a short hint about the tray.) |
| Accessibility and reduced motion | Honour the system setting; the tray and settings are keyboard reachable |
| Localisation | Host menus first; text in scenes later |
| Quality bar for scenes | A review for "would I leave this on my desktop?", not only for budgets |
| Sound policy | Quiet, only after the player's action, host mute; ambient sound is a decision for later |
| Testing on real GPUs | CI has none; keep a list of machines (integrated and discrete) and a measuring script |
| Community | Issues, discussions, a place to show scenes, a code of conduct |
| Linux | A non-goal now; the Electron host could run, but desktop attach differs by desktop environment |
| Multi-display | One scene per display will be the first request from people with two screens; it stays on the later list (the Mac's P-6) |
| The two-machine workflow | Keep it: it works. Tell the new sessions the rules on day one |
