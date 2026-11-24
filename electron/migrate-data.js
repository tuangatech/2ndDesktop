// One-time copy of the saved tank and the settings from the data folder of the old product (BOOTSTRAP Q2).
//
// The app was called Fish Tank and kept its data in a folder named after the package (`fish-tank`); the new product
// has its own folder, which starts empty, and the player's tank would not load. On the first start of the new app,
// when the new folder has no `records/`, the record of each known scene and the settings are copied over. A copy, never
// a move: the old folder stays as it is. Nothing is asked and nothing is overwritten.
import fs from 'node:fs';
import path from 'node:path';

const backupName = (id) => `${id}.backup.json`;

/**
 * @param {object} options
 * @param {string} options.oldDir  the data folder of the old product
 * @param {string} options.newDir  the data folder of this run
 * @param {string[]} [options.sceneIds]  the scenes whose records are copied (their file names are `<id>.json`)
 * @param {(message: string) => void} [options.log]  one line, with no path in it
 * @returns {{status: 'copied'|'skipped'|'failed', reason?: string, copied: string[]}}
 */
export function migrateOldData({ oldDir, newDir, sceneIds = ['fishtank'], log = () => {} }) {
  const copied = [];
  try {
    if (path.resolve(oldDir) === path.resolve(newDir))
      return { status: 'skipped', reason: 'same-folder', copied };
    if (fs.existsSync(path.join(newDir, 'records')))
      return { status: 'skipped', reason: 'has-records', copied };
    const oldRecords = path.join(oldDir, 'records');
    const names = sceneIds
      .flatMap((id) => [`${id}.json`, backupName(id)])
      .filter((name) => fs.existsSync(path.join(oldRecords, name)));
    const settings = path.join(oldDir, 'settings.json');
    const copySettings =
      fs.existsSync(settings) && !fs.existsSync(path.join(newDir, 'settings.json'));
    if (names.length === 0 && !copySettings)
      return { status: 'skipped', reason: 'nothing-to-copy', copied };

    fs.mkdirSync(newDir, { recursive: true });
    // The settings first: the records are the step that makes a later start skip the copy, so it comes last.
    if (copySettings) {
      const target = path.join(newDir, 'settings.json');
      const temp = `${target}.migrating`;
      fs.copyFileSync(settings, temp);
      fs.renameSync(temp, target);
      copied.push('settings.json');
    }
    if (names.length > 0) {
      // Staged in a folder of another name and renamed at the end: a start that dies half-way leaves no `records/`,
      // so the next start tries again instead of finding a partial one.
      const staging = path.join(newDir, 'records.migrating');
      fs.rmSync(staging, { recursive: true, force: true });
      fs.mkdirSync(staging, { recursive: true });
      for (const name of names) {
        fs.copyFileSync(
          path.join(oldRecords, name),
          path.join(staging, name),
          fs.constants.COPYFILE_EXCL,
        );
        copied.push(`records/${name}`);
      }
      fs.renameSync(staging, path.join(newDir, 'records'));
    }
    log(
      `copied ${copied.length} file(s) from the data folder of the old Fish Tank app (the old folder is unchanged)`,
    );
    return { status: 'copied', copied };
  } catch (error) {
    // The error code only: the message holds a path of the user.
    log(
      `copy from the old data folder failed (${error?.code ?? error?.name}); starting without it`,
    );
    return { status: 'failed', reason: String(error?.code ?? error?.name), copied };
  }
}
