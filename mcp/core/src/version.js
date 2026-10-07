import { createRequire } from 'node:module';

/** One source for the number: the bundle ships a package.json beside dist/server.mjs. */
export const VERSION = createRequire(import.meta.url)('../package.json').version;
