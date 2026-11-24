# Reference: what the old names mean

2ndDesktop started as a snapshot of the private fish-tank repository (see `../bootstrap/BOOTSTRAP.md`). The code still carries comments written there. This page says where an old name, number or path leads. The files in `fishtank-v1/` are an archive: they describe the Fish Tank app as it was, in its own words, and are not kept current. The design set one folder up (`docs/platform/`, `docs/scenes/`) is the live one, and `../DECISIONS.md` wins where they differ.

## Old paths in a comment

A comment that names `docs/<file>.md` means the same file in `fishtank-v1/`:

| In a comment | File here |
| --- | --- |
| `docs/01-functional-spec.md` | `fishtank-v1/01-functional-spec.md` |
| `docs/02-tech-design.md` | `fishtank-v1/02-tech-design.md` |
| `docs/03-platform-design.md` | `fishtank-v1/03-platform-design.md` |
| `docs/04-implementation-phase-1.md` | `fishtank-v1/04-implementation-phase-1.md` |
| `docs/05-implementation-phase-2.md` | `fishtank-v1/05-implementation-phase-2.md` |
| `docs/06-implementation-platform.md` | `fishtank-v1/06-implementation-platform.md` |
| `docs/desktop-spike.md` | `fishtank-v1/desktop-spike.md` (the desktop attach test) |
| `docs/edit-mode-spike.md` | `fishtank-v1/edit-mode-spike.md` |
| `docs/gate-g1.md` | `fishtank-v1/gate-g1.md` |
| `docs/perf-notes.md` | `fishtank-v1/perf-notes.md` |

Code paths changed twice since: `electron/` is now `app/main/`, `renderer/` is now `app/page/`, and the tests moved to `tests/host/` and `scenes/fishtank/tests/`. `assets/art/STYLE.md` is now `docs/art-style.md`. A scene's design is `docs/scenes/<id>.md`.

## Old numbers in a comment

| Number | Means | Defined in |
| --- | --- | --- |
| `FR-1` to `FR-64` | functional requirement of the Fish Tank | `fishtank-v1/01-functional-spec.md` |
| `NFR-1` to `NFR-7` | non-functional requirement (frame rate, memory, quiet when covered, diagnostics) | `fishtank-v1/01-functional-spec.md`, measured in `fishtank-v1/perf-notes.md` |
| `D1` to `D36` | decision of the first implementation plan (the tank core) | the decisions table of `fishtank-v1/04-implementation-phase-1.md` |
| `D37` to `D51` | decision of the platform slice (the tank becomes the first scene) | the decisions table of `fishtank-v1/06-implementation-platform.md` |
| `tech design 3.8`, `14.4` | section of the old technical design | `fishtank-v1/02-tech-design.md` |
| `spec section 8` | section of the old functional spec | `fishtank-v1/01-functional-spec.md` |
| `Step 6` and similar | step of the first implementation plan | `fishtank-v1/04-implementation-phase-1.md` (a few in `05-` and `06-`) |
| `Step 1b` | the platform slice, step 1b (the scene registry) | `fishtank-v1/06-implementation-platform.md` |
| `DEC-n` | a decision of 2ndDesktop (new, dated) | `../DECISIONS.md` |

A number from the old set does not carry over to new work: a new decision gets a `DEC-n` line, and a new requirement goes into the design set.

## Old names in the app

- The scene id `fishtank` and its record file `records/fishtank.json` stay (the tank is the scene; the product is 2ndDesktop). The data folder of the old app was `fish-tank` (development: `Fish Tank (dev)`); the first start of 2ndDesktop copies the saved tank from there (`app/main/migrate-data.js`).
- The environment variables `FISHTANK_*` are `DESKTOP2_*` now, `window.fishtank` is `window.desktop2`, and `window.__tank` is `window.__scene` (rename PR, `../STATUS.md`).
