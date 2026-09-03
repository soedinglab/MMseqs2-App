// Every module in frontend/lib must import under plain Node.
//
// That is the invariant the whole headless layer rests on — it imports those files directly rather
// than reimplementing them (context.md §2) — and nothing else enforces it. A single `import 'ngl'`
// or a `window.` reference added to one of them breaks this package with an error that surfaces far
// from the change, in whichever tool happened to import it first.
//
// Checklist 5.5 proposes an ESLint rule banning browser globals there. This is the cheaper half of
// that: it does not care *why* a module fails to load, only that none does. accession.js is the
// reason it exists — it was the one file that did not load, because axios is CommonJS and Node
// cannot detect its named exports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../frontend/lib');

test('every frontend/lib module loads under Node', async () => {
    const files = (await fs.readdir(LIB))
        .filter(f => f.endsWith('.js'))
        .sort();
    assert.ok(files.length >= 15, `expected the lib directory, found ${files.length} modules`);

    const failed = [];
    for (const file of files) {
        try {
            await import(pathToFileURL(path.join(LIB, file)).href);
        } catch (err) {
            failed.push(`${file}: ${err.message.split('\n')[0]}`);
        }
    }
    assert.deepEqual(failed, [], 'these modules cannot be imported outside a browser');
});

test('frontend/lib is declared as ESM, which is what makes the direct import work', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(LIB, 'package.json'), 'utf8'));
    // Node picks a .js file's module format from the nearest package.json; without this one it walks
    // up to the repo root, finds no "type", and parses `export function` as CommonJS.
    assert.equal(pkg.type, 'module');
});
