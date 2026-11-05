// Writes tools/tutorials/cloud/manifest.json from the videos in that folder (task 3.7).
// Run after adding or re-rendering a video:   npm run tutorials:manifest
// then upload the new video and manifest.json to the `tutorials` bucket (docs/SETUP.md Part H).
//
// A re-rendered video gets a new name, e.g. 03-decks.v2.mp4 (delete the old file), so phones
// that already downloaded the old one fetch the new one, and the CDN never serves a stale copy.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = join(dirname(fileURLToPath(import.meta.url)), 'cloud');
const VIDEO = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.v\d+)?\.mp4$/;

const videos = [];
for (const file of readdirSync(folder).sort()) {
  const match = VIDEO.exec(file);
  if (!match) continue;
  if (videos.some((v) => v.id === match[1])) {
    console.error(`Two files for ${match[1]}: delete the old one first.`);
    process.exit(1);
  }
  videos.push({ id: match[1], file, bytes: statSync(join(folder, file)).size });
}

writeFileSync(join(folder, 'manifest.json'), `${JSON.stringify({ version: 1, videos }, null, 2)}\n`);
console.log(`manifest.json lists ${videos.length} videos.`);
