// Makes a new scene from the template (`templates/scene/`): a folder `scenes/<id>/` with a `scene.json`, an `index.js`
// that implements the whole contract and a record with a unit test. The scene is a development scene (`"dev": true`):
// it shows in `npm run dev` and in tests, never in a release, until its author takes that line out.
// Usage: npm run new-scene -- <id> ["Name shown in the menu"]
//   npm run new-scene -- my-garden "My garden"
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_ID_PATTERN } from '../app/main/scene-id.js';

// The name goes into strings of the generated code, so it is plain: letters, digits, spaces and a few marks.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .,&-]{0,39}$/;

/** "my-garden" becomes "My garden". */
export const nameFromId = (id) => {
  const words = id.replace(/-+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function listFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listFiles(path.join(dir, entry.name), base)
        : [path.relative(base, path.join(dir, entry.name))],
    );
}

/**
 * Copies the template into `<root>/scenes/<id>/`, replacing the placeholders `__ID__` and `__NAME__`.
 * Throws with a sentence for the person who typed the command; writes nothing when it throws.
 * @param {{root: string, id: string, name?: string}} options
 * @returns {string[]} the files written, relative to `<root>/scenes/<id>/`
 */
export function scaffold({ root, id, name }) {
  if (!SCENE_ID_PATTERN.test(id ?? '')) {
    throw new Error(
      `"${id}" is not a scene id: 3 to 32 lowercase letters, digits and dashes, a letter first (for example my-garden)`,
    );
  }
  const shownName = name ?? nameFromId(id);
  if (!NAME_PATTERN.test(shownName)) {
    throw new Error(
      `"${shownName}" is not a name: 1 to 40 letters, digits, spaces and . , & - (it is written into the code)`,
    );
  }
  const templateDir = path.join(root, 'templates', 'scene');
  const target = path.join(root, 'scenes', id);
  if (fs.existsSync(target)) throw new Error(`scenes/${id} already exists`);

  const written = [];
  for (const file of listFiles(templateDir)) {
    const text = fs
      .readFileSync(path.join(templateDir, file), 'utf8')
      .split('__ID__')
      .join(id)
      .split('__NAME__')
      .join(shownName);
    const to = path.join(target, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, text);
    written.push(file.split(path.sep).join('/'));
  }
  return written.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [id, name] = process.argv.slice(2);
  if (!id) {
    console.error('Usage: npm run new-scene -- <id> ["Name shown in the menu"]');
    process.exitCode = 1;
  } else {
    try {
      const root = path.join(import.meta.dirname, '..');
      const files = scaffold({ root, id, name });
      console.log(`Made scenes/${id}/ (${files.join(', ')}).`);
      console.log('Next:');
      console.log(
        `  npm run dev        the tray menu, "Scenes", lists it (it is a development scene)`,
      );
      console.log(`  npm test           the unit test of its record`);
      console.log(`  npm run test:e2e   the contract test runs it with every other scene`);
      console.log(
        `  Edit scenes/${id}/index.js; docs/platform/01 section 8 explains the contract.`,
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
