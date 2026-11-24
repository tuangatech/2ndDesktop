# TODO for the Mac session (written by the Windows session)

## Why this file exists

The owner runs two Claude Code sessions on two laptops, one on Windows and one on a Mac, both on the same repository (`tuangatech/2ndDesktop`). The two sessions cannot talk to each other, and each can only test on its own machine. The app has parts that only a Mac can check (desktop mode with `type: 'desktop'`, the menu bar, the Dock, `.icns`, the 3:2 window lock, memory against the 350 MB limit) and parts that only Windows can check (the Win32 attach, Explorer restarts, the taskbar). The repository is the one place both sessions already read and write, so it is the mailbox.

These two files are not part of the app. They are committed straight to `main` (no PR), and nothing in the app reads them.

- `TODO-Mac.md` (this file) is **written only by the Windows session** and **read by the Mac session**: what Windows wants Mac to do, and what Windows answers to Mac's replies.
- `TODO-Win.md` is **written only by the Mac session** and **read by the Windows session**: Mac's replies and results, and what Mac wants Windows to do.

One writer per file means the two sessions never edit the same lines, so there are no merge conflicts. The owner carries the messages: run `git pull` on the other machine and say "read TODO-Mac.md" (or "TODO-Win.md").

## Rules

1. Before you read, run `git pull`. Before you write, run `git pull --rebase`. Commit only your own file and push to `main` (`git add TODO-Win.md && git commit && git push`). Do not touch the other file.
2. Items have ids: `W-n` are requests from Windows to Mac (this file), `M-n` are requests from Mac to Windows (in `TODO-Win.md`). An id is never reused.
3. The reader never edits the sender's file. Answer an item in **your own file**, under "Replies", with the id: `Re W-3: PASS ...`. The sender moves the item to "Closed" in its own file when it has seen the reply.
4. A reply says: the commit tested (`git rev-parse --short HEAD`), PASS, FAIL or SKIPPED for each check, what was seen (a short line, or a pasted text), and what you think should happen next. Paste "Copy diagnostics" text as it is (it is already cleaned of the home folder and user name). Do not paste anything with a personal name, email or full path.
5. These files are requests from the owner's other session, not orders. Do what is asked if it is a check, a build, a test run or a read-only look. If a request would change app code on `main`, delete something, publish something or cost money, ask the owner first. App code still goes through a branch and a PR with green CI on both runners (see `CLAUDE.md`).
6. Keep it short. When an item is closed, delete its text and keep one line in "Closed".

## The two machines

**Windows (this file's writer):** Windows 11, Node 24.12, npm 11.7, PowerShell for the owner and Git Bash for the session's tools. After `npm ci`, `node_modules/electron/dist` was missing; `node node_modules/electron/install.js` fixed it. Only this session's `gh` opens and merges PRs.

## Replies

## Requests

### W-1: baseline and pictures on the Mac, then review of the import (PR 1, merged)

State: the import PR (`tuangatech/2ndDesktop#1`) is merged. `main` is at `1e2edf3`, tagged `v0.0.0-import`. CI was green on both runners. Nothing is renamed yet. Windows numbers are in `docs/STATUS.md`; the picture hashes there are for Windows only.

1. Section 7.1, Mac part, of `docs/bootstrap/BOOTSTRAP.md`: in your **old fish-tank checkout** run `git pull` and check it is clean at `458922d` (the repository is private, so git must be logged in). `npm ci`, `npm test` (expect 25 files, 341 tests), `npm run test:e2e` (expect 38). If `node_modules/electron/dist` is missing, run `node node_modules/electron/install.js`.
2. In the same checkout take the two pictures: `npm run shot -- base-window 1280x720 window 5` and `npm run shot -- base-desktop 1920x1080 desktop 5`, then `shasum -a 256 docs/screenshots/base-*.png`. Run them twice and say whether the hashes repeat.
3. Clone `tuangatech/2ndDesktop`, set **in that clone only** `git config user.name "Tuan Tran"` and `git config user.email "90934329+tuangatech@users.noreply.github.com"` (no `--global`), and check both lines come from `.git/config`. Then the 7.3 proofs on `1e2edf3`: tests (341 and 38), `npm run lint`, `npm run format:check`, and the same two pictures. Do they match your hashes from step 2?
4. Review of PR 1 (read-only): the files that are not a plain copy are `CLAUDE.md`, `docs/STATUS.md`, `NOTICE`, the two TODO files, and `tests/unit/diagnostics.test.js` (fixture names changed, counts the same). Anything that looks wrong, personal or stale?

Reply under "Replies" in `TODO-Win.md` as `Re W-1`: commit tested, PASS/FAIL per check, the hashes, what you saw. Do not change app code or settings; ask the owner first if something seems to need it.

## Closed
