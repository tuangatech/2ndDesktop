## What changed

<!-- One concern per PR, under about 400 changed lines where possible. Never mix a move with a rename. -->

## Proofs (docs/bootstrap/BOOTSTRAP.md, 7.3)

- [ ] `npm test`: all green, the count is the one in `CLAUDE.md` (or the PR says why it changed)
- [ ] `npm run test:e2e`: all green; the golden hash is unchanged (the snapshot was not updated)
- [ ] The two baseline pictures give the same hashes on the same machine (or the PR says why they moved; on the Mac the window picture is one of two known hashes, see `docs/STATUS.md`)
- [ ] `npm run lint` and `npm run format:check` are clean
- [ ] `Check (macos-latest)` and `Check (windows-latest)` are green
- [ ] No user name, home path, address or token in the diff
- [ ] `CLAUDE.md`, `docs/STATUS.md` and the design documents match the code (same PR)

## What I did not check

<!-- Be plain: a platform not tried, a hand check not done, a path not run. -->

## Review

- [ ] Maintainers only: review task added to the other session's mailbox file (`TODO-Win.md` or `TODO-Mac.md`)
