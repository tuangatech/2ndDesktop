import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ID, DEV_DATA_FOLDER, OLD_DATA_FOLDER, PRODUCT_NAME } from '../../electron/product.js';

const root = path.join(import.meta.dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('the product names (one place: electron/product.js)', () => {
  it('are the ones of Q1 and Q2 of the bootstrap document', () => {
    expect(PRODUCT_NAME).toBe('2ndDesktop');
    expect(APP_ID).toBe('com.tuangatech.2nddesktop');
    expect(DEV_DATA_FOLDER).toBe('2ndDesktop (dev)');
    expect(OLD_DATA_FOLDER).toBe('fish-tank');
  });

  it('agree with electron-builder.yml, package.json and the window page, which cannot import them', () => {
    const builder = read('electron-builder.yml');
    expect(builder.split(/\r?\n/)).toContain(`appId: ${APP_ID}`);
    expect(builder.split(/\r?\n/)).toContain(`productName: ${PRODUCT_NAME}`);
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.name).toBe('2nddesktop');
    expect(pkg.desktop2.channel).toBe('release');
    expect(pkg.fishtank).toBeUndefined();
    const html = read('renderer/index.html');
    expect(html).toContain(`<title>${PRODUCT_NAME}</title>`);
    expect(html).toContain(`<span class="grip">${PRODUCT_NAME}</span>`);
  });

  it('ships for Apple silicon and English only on the Mac', () => {
    const lines = read('electron-builder.yml').split(/\r?\n/);
    expect(lines).toContain('  electronLanguages: en');
    const target = lines.indexOf('    - target: dmg');
    expect(lines[target + 1]).toBe('      arch: arm64');
  });
});
