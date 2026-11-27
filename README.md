# 2ndDesktop

Your desktop, alive, and quiet about it.

2ndDesktop puts one living scene on the desktop of a Windows or macOS computer: behind the icons like a living wallpaper, or in a small window. A scene is a picture with its own rules and its own saved progress. The app does everything that is the same for every scene (attaching to the desktop, the tray menu, pausing, saving, settings), so that a scene is just a folder anyone can write.

> **Work in progress.** There is no release to download yet. The first public release is planned as version 0.3. Today the repository holds the platform and one scene, the fish tank.

## Scenes

| Scene | State |
| --- | --- |
| Fish tank (`scenes/fishtank/`) | Built. A small tank you feed once a day; the fish grow and lay eggs. Calm and quiet by design. |
| Farm house | Planned for 0.2: a house under a forested mountain that shows the real season and weather. |

More scenes are ideas for later; see [`docs/scenes/`](docs/scenes/) and the roadmap in [`docs/platform/03-distribution-and-roadmap.md`](docs/platform/03-distribution-and-roadmap.md).

## What it does

- **Desktop mode** shows the scene behind your icons and takes no clicks. **Window mode** is a small window you can move and resize. Everything you can do also lives in the tray menu.
- **Polite by default:** it pauses when the desktop is covered or hidden, runs at no more than 30 frames per second on the desktop, and stays within a memory budget.
- **Private:** no account, no telemetry, no server. Your saved progress stays on your computer. The app sends nothing by itself: a bug report is text you copy from the tray menu and post yourself.
- **Offline first.** By design, a scene that wants the network must ask through the app, with your consent (scenes from outside come later; today there is no network use).

## Trying a build that is not signed yet

Until version 0.3 a build that is shared with a few testers is not signed, so each system warns once, the first time it is opened. The warning is expected; it does not mean the file is damaged. Open the file only if you got it from the person who made it.

**Windows 10 or 11.** Run the installer. If it says "Windows protected your PC", click **More info**, then **Run anyway**. The app installs for the current user, adds a Start menu entry and shows an icon in the tray.

**macOS 13 or later, Apple silicon.** Open the disk image and drag 2ndDesktop to Applications, then open it from Applications.

1. macOS says "2ndDesktop" Not Opened (it could not check it for malware). Click **Done**.
2. Open **System Settings**, then **Privacy & Security**, and scroll down to the **Security** section.
3. Next to the line about 2ndDesktop being blocked, click **Open Anyway**, and enter your password or use Touch ID.
4. Open 2ndDesktop again, and click **Open Anyway** in the new question.

This is needed once. Right-clicking the app and choosing Open no longer works on recent versions of macOS. An Intel Mac is not supported.

**Where the saved progress is, and how to remove everything.** The saved tank and the settings are in `%APPDATA%\2ndDesktop` on Windows and `~/Library/Application Support/2ndDesktop` on a Mac. To remove the app, uninstall it from Apps (Windows) or drag it to the Bin (Mac); the folder stays until you delete it yourself. Nothing is sent anywhere: the app has no account and no telemetry.

## Run it from source

You need Node 24 (`.nvmrc`; the repository pins it in `engines`, so on a machine whose default Node is newer, run `fnm use` or `nvm use` first) and npm. On a Mac the app runs on Apple silicon, macOS 13 or later.

```
npm ci
npm run dev
```

`npm run dev` opens the app with live reload, in the saved display mode (window mode on a first run; if the saved mode is desktop, it opens on your desktop). To run a build instead: `npm run build && npm start`.

If `npm ci` finishes but the app says Electron is missing, run `node node_modules/electron/install.js` once.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Builds, then runs the end-to-end tests (Playwright for Electron; real windows open for a minute or two) |
| `npm run lint`, `npm run format:check` | ESLint and Prettier |
| `npm run shot -- <name> <WxH> <window or desktop> <seconds>` | A reproducible picture of the scene, written to `docs/screenshots/` |
| `npm run dist` | Builds an installer (Windows) or a dmg (macOS, Apple silicon) into `release/`; needs the network (it downloads Electron and, on a Mac, a second native package). The Mac build is unsigned: the first open needs Privacy & Security, Open Anyway |

Development runs use their own data folder (`2ndDesktop (dev)`), so they never touch a real save.

## How it is built

Electron and PixiJS 8, plain JavaScript (ES modules), no framework.

```
app/main/    Electron main process: desktop attach, tray, power, saving, settings, diagnostics
app/page/    the page the app shows: the PixiJS app, the loop, art and sound loading
scenes/      one folder per scene (scene.json + index.js), with its own tests
shared/      what every scene may import
scripts/     build, picture, icon and measurement scripts
tests/       host unit tests (tests/host) and end-to-end tests (tests/e2e)
docs/        the design documents
```

The main process is the security boundary, and a scene is never trusted. A scene never reads the clock or uses unseeded random numbers itself, so that tests and pictures run the same simulation every time. (On a Mac the window picture can still come out as one of two nearly identical hashes; see `docs/STATUS.md`.)

## Documents

- [`docs/00-2nddesktop-specs.md`](docs/00-2nddesktop-specs.md): the product on one page.
- [`docs/README.md`](docs/README.md): the index of the design set; [`docs/STATUS.md`](docs/STATUS.md): where the work is now; [`docs/DECISIONS.md`](docs/DECISIONS.md): why things are as they are.
- [`docs/platform/`](docs/platform/): architecture and the scene contract, security, data and network, releases and roadmap.
- [`SECURITY.md`](SECURITY.md): how to report a vulnerability (privately).

## Contributing

Contributions of code are not open yet: the platform and the contract are still changing (open contributions are planned for 0.5). Bug reports and scene ideas are welcome as issues.

## License

MIT, see [`LICENSE`](LICENSE). The art is original: it was drawn by an AI tool (SVG written by Claude Code), the sounds are synthesized in code, and the font is OFL. The code started in the Fish Tank project by the same author; see [`NOTICE`](NOTICE).
