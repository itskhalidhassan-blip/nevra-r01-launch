import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

if (!process.argv[2]) throw new Error('Usage: npm run pack:frames -- /path/to/451-webp-frames');

const source = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] || 'public/frames/hero');
const files = (await readdir(source)).filter((file) => /^frame-\d{4}\.webp$/.test(file)).sort();

if (files.length !== 451) throw new Error(`Expected 451 WebP frames, found ${files.length}`);

const chunks = [];
const frames = [];
let offset = 0;

for (const file of files) {
  const frame = await readFile(path.join(source, file));
  chunks.push(frame);
  frames.push([offset, frame.length]);
  offset += frame.length;
}

await mkdir(output, { recursive: true });
const packed = Buffer.concat(chunks);
const digest = createHash('sha256').update(packed).digest('hex').slice(0, 12);
const pack = `packs/hero-15fps-${digest}.pack`;
await mkdir(path.join(output, 'packs'), { recursive: true });
await Promise.all([
  writeFile(path.join(output, pack), packed),
  writeFile(path.join(output, 'manifest.json'), `${JSON.stringify({ version: 1, pack, bytes: offset, frames })}\n`),
]);

console.log(`Packed ${files.length} frames into ${(offset / 1024 / 1024).toFixed(2)} MiB.`);
