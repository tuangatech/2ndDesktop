// Windows only: ask Windows to start the app again after it crashes (tech design 3.8, "Keeping it attached").
//
// Why: the tank on the desktop is a child window of Explorer's window. When Explorer is killed (Task Manager,
// Restart; or when it crashes), Windows destroys the tank's window from inside Explorer's death and Chromium cannot
// survive that: the app ends at once with exit code 0xC000041D and no chance to log or recover. Measured with a
// throwaway process as the parent (docs/02-tech-design.md 3.8). `RegisterApplicationRestart` makes Windows start the
// app again with the given command line. There is no helper process to keep running, and Windows restarts an app
// only if it ran for at least a minute before it crashed, which also stops a crash loop at startup.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Flags of RegisterApplicationRestart: do not restart after a hang, a patch or a reboot, so only a crash counts.
// (A hang restart would end an app whose window is merely busy.)
const RESTART_NO_HANG = 2;
const RESTART_NO_PATCH = 4;
const RESTART_NO_REBOOT = 8;
export const CRASH_ONLY = RESTART_NO_HANG | RESTART_NO_PATCH | RESTART_NO_REBOOT;
/** Windows accepts a command line of at most 2048 characters. */
export const MAX_COMMAND_LINE = 2000;
/** The argument that tells the new process it was started by Windows after a crash. */
export const RESTARTED_ARG = '--restarted';

/** One argument as the Windows command line parser reads it back (spaces and quotes). */
export function quoteArg(arg) {
  if (arg !== '' && !/[\s"]/.test(arg)) return arg;
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}

/**
 * The command line for the restart, without the program name.
 * @param {{appPath?: string | null, flags?: string[]}} parts
 *   `appPath` is the app folder of a development run (an absolute path: a restarted process does not start in the
 *   same folder); an installed app has none. `flags` are the arguments to keep, such as --login.
 * @returns {string | null} null when it would be too long
 */
export function restartCommandLine({ appPath = null, flags = [] } = {}) {
  const args = [
    ...(appPath ? [appPath] : []),
    ...flags.filter((flag) => flag !== RESTARTED_ARG),
    RESTARTED_ARG,
  ];
  const line = args.map(quoteArg).join(' ');
  return line.length <= MAX_COMMAND_LINE ? line : null;
}

function loadKernel32() {
  const koffi = require('koffi');
  const kernel32 = koffi.load('kernel32.dll');
  return {
    RegisterApplicationRestart: kernel32.func(
      'int32_t __stdcall RegisterApplicationRestart(str16 commandLine, uint32_t flags)',
    ),
    UnregisterApplicationRestart: kernel32.func('int32_t __stdcall UnregisterApplicationRestart()'),
  };
}

/**
 * @param {object} options
 * @param {string} [options.platform]
 * @param {() => string | null} options.commandLine  the command line for a restart, asked for when it is registered
 * @param {() => {RegisterApplicationRestart: Function, UnregisterApplicationRestart: Function}} [options.loadApi]
 * @param {(message: string) => void} [options.log]
 */
export function createCrashRestart({
  platform = process.platform,
  commandLine,
  loadApi = loadKernel32,
  log = () => {},
}) {
  let registered = false;
  let api = null;
  return {
    /**
     * Turns the restart on or off (on while the tank is on the desktop, off in a window: a crashed window should
     * not come back by itself). Returns whether it is on afterwards. Never throws.
     */
    set(enabled) {
      if (platform !== 'win32') return false;
      if (enabled === registered) return registered;
      try {
        api ??= loadApi();
        if (enabled) {
          const line = commandLine();
          if (line === null) {
            log('restart after a crash: command line too long, not registered');
            return registered;
          }
          const result = api.RegisterApplicationRestart(line, CRASH_ONLY);
          if (result !== 0) {
            log(`restart after a crash: not registered (HRESULT 0x${(result >>> 0).toString(16)})`);
            return registered;
          }
        } else {
          api.UnregisterApplicationRestart();
        }
        registered = enabled;
        log(`restart after a crash: ${enabled ? 'on' : 'off'}`);
      } catch (error) {
        log(`restart after a crash: failed (${error?.code ?? error?.name ?? 'error'})`);
      }
      return registered;
    },
    isOn: () => registered,
  };
}
