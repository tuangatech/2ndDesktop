# Security policy

2ndDesktop is a desktop app that runs scenes (small programs written by other people) on your desktop. We take reports about the app's sandbox, its data handling and its network behaviour seriously. The design is in [`docs/platform/02-security-data-and-network.md`](docs/platform/02-security-data-and-network.md).

## Supported versions

The project is a work in progress and has no release yet. Until the first public release (version 0.3), only the latest commit on `main` is supported. After that, the latest release is.

## Report a vulnerability

Please do **not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting: on the repository page, open **Security**, then **Report a vulnerability**. Say what you found, how to reproduce it, which version or commit, and your operating system (Windows or macOS). A short description is enough; we will ask for more if we need it.

You can expect an answer within about a week. This is a small project run by one maintainer in spare time, so we cannot promise a fix date, but we will tell you what we decide and credit you if you wish.

## What counts

- A scene reaching something it was not given: files, the network, other scenes' data, or the page's bridge to the main process.
- A way around the content security policy, the sandbox or the permission prompts.
- A problem in how the app stores, copies or sends the player's data (records, settings, diagnostics, an error report).
- A problem in packaging or updating the app.

A scene that is only unpleasant (for example loud, or heavy on the processor) is a normal bug: open an ordinary issue.

## Please do not

- Test against other people's computers or accounts.
- Include real personal data, tokens or private paths in a report.
