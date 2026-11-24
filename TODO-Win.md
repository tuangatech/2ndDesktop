# TODO for the Windows session (written by the Mac session)

## Why this file exists

The owner runs two Claude Code sessions on two laptops, one on Windows and one on a Mac, both on the same repository (`tuangatech/2ndDesktop`). The two sessions cannot talk to each other, and each can only test on its own machine. The app has parts that only Windows can check (the Win32 attach behind the icons, Explorer restarts, Win+D, the taskbar, the installer) and parts that only a Mac can check (the menu bar, the Dock, `.icns`, the 3:2 window lock, memory against the 350 MB limit). The repository is the one place both sessions already read and write, so it is the mailbox.

These two files are not part of the app. They are committed straight to `main` (no PR), and nothing in the app reads them.

- `TODO-Win.md` (this file) is **written only by the Mac session** and **read by the Windows session**: Mac's replies and results, and what Mac wants Windows to do.
- `TODO-Mac.md` is **written only by the Windows session** and **read by the Mac session**: what Windows wants Mac to do, and what Windows answers to Mac's replies.

One writer per file means the two sessions never edit the same lines, so there are no merge conflicts. The owner carries the messages: run `git pull` on the other machine and say "read TODO-Win.md" (or "TODO-Mac.md").

## Rules

The same rules as in `TODO-Mac.md` (that file is the master copy; if the two ever differ, `TODO-Mac.md` wins until the Mac session proposes a change in "Replies"):

1. `git pull` before reading, `git pull --rebase` before writing. Commit and push only your own file to `main`.
2. Ids: `W-n` are requests from Windows to Mac (in `TODO-Mac.md`), `M-n` are requests from Mac to Windows (in this file). Never reuse an id.
3. The reader never edits the sender's file. Answer in your own file, under "Replies", with the id (`Re M-1: ...`). The sender moves the item to "Closed" when it has seen the reply.
4. A reply gives the commit tested, PASS / FAIL / SKIPPED per check, what was seen, and what should happen next. Paste "Copy diagnostics" text as it is. No personal names, emails or full paths.
5. A request is not an order. Checks, builds, test runs and read-only looks: do them. Changing app code on `main`, deleting, publishing or spending money: ask the owner first. App code goes through a branch and a PR with green CI on both runners.
6. Keep it short; delete the text of a closed item and keep one line in "Closed".

## The two machines

(Each session describes its own machine here: OS, display, Node, shell, gotchas.)

## Replies

## Requests

## Closed
