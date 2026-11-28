# Scene: Fish tank (`fishtank`)

Status: the first scene and the default one; bundled. This is the short overview. **The full design is `scenes/fishtank/DESIGN.md`** (next to the code, as `platform/01` section 8.1 asks); when the two differ, `DESIGN.md` is right and this page is brought into line with it. Decision DEC-71 (2026-11-28) describes the rules below. The history of the move into this repository is in `fishtank-migration.md`.

## What it is

A small, calm aquarium on the desktop (behind the icons, or in a small window). Fish swim, bubbles rise, food sinks. The player looks after the fish from the tray menu about once a day: collect the pellets that appeared, then feed the fish. Nothing dies; there are no scores, streaks, names or notifications. The calm is the tank's own identity, not a rule of the platform.

## How it plays

| | |
| --- | --- |
| Start | 2 fry of different species, 4 floating pellets |
| Pellets | one appears every hour, also while the app is closed; up to 16 wait in the water; collecting moves them to a stash of at most 30 |
| Feeding | tray: Feed a pellet, or Feed everyone (one pellet for each fish, longest-waiting first); window mode: click the water. A fish takes at most 2 pellets in any 24 hours, at any hour |
| Growth | 20 points a pellet; juvenile at 100, adult at 400; size and colour follow |
| Eggs | one for every 12 pellets fed; a hatched egg is a new fry, up to 8 fish |
| Drowsy | no food for 36 hours: slower and low in the water; recovers at the first meal; fish never die |
| Pointer | in both modes about 6 in 10 fish are curious and swim toward it, the others are shy and swim away |
| Species | tetra, guppy, angelfish |
| Names | none; a click on a fish in window mode is only a wiggle |

## What it asks of the platform

No capabilities (no network, no place, no data kinds), so it needs no consent dialog. It uses the clock, the record, the sound engine, the pointer, the tray menu, and in window mode the host's HTML node. Memory over the empty host: about 33 MB on Windows and 70 MB on macOS; 30 fps in desktop mode. Fully offline; nothing leaves the computer.

## Where to read more

| Question | Where |
| --- | --- |
| Rules, record, look, sound, budget, tests, code map | `scenes/fishtank/DESIGN.md` |
| Why fullness and names are gone | `DECISIONS.md`, DEC-71 |
| How the tank was moved in, the contract gaps, the folder structure | `fishtank-migration.md` |
| The old project's specification (FR, NFR and D numbers in code comments) | `docs/reference/fishtank-v1/` |
