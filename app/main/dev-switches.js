// The development and test switches (environment variables that start with DESKTOP2_, and VITE_DEV_SERVER_URL) are
// for a run from source and for the test build. An installed release ignores them: one of them adds any Chromium
// switch (for example one that turns the sandbox off) and another makes the window load any address.
// Plain Node (no Electron), so it is unit-tested.

/** True for a run from source (not packaged) and for the test build (`dist:test`, channel "test"). */
export function devSwitchesAllowed({ packaged, channel }) {
  return !packaged || channel === 'test';
}

/** Removes every development and test switch from `env` (`process.env` in the app). */
export function removeDevSwitches(env) {
  for (const key of Object.keys(env)) {
    if (key.startsWith('DESKTOP2_') || key === 'VITE_DEV_SERVER_URL') delete env[key];
  }
}
