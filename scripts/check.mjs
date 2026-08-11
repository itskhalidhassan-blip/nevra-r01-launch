import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const [html, css, javascript, frames, loaderStats] = await Promise.all([
  read('index.html'),
  read('src/styles.css'),
  read('src/main.js'),
  readdir(path.join(root, 'public/frames/hero')),
  stat(path.join(root, 'public/media/loader.mp4')),
]);

assert.equal(frames.filter((file) => /^frame-\d{4}\.webp$/.test(file)).length, 451, 'hero frame count');
assert.ok(loaderStats.size < 2_500_000, 'loader stays below 2.5 MB');
assert.match(html, /href="#specs"/, 'primary CTA has a working destination');
assert.match(html, /Fictional vehicle \/ generated concept film/, 'concept proof label is visible');
assert.match(html, /muted[\s\S]*preload="auto"/, 'normal video is muted and preloaded');
assert.match(css, /prefers-reduced-motion: reduce/, 'reduced-motion fallback exists');
assert.match(css, /"Archivo"/, 'Archivo is the display face');
assert.match(css, /"Martian Mono"/, 'Martian Mono is the text face');
assert.match(javascript, /desktopSequence[\s\S]*new FrameSequence/, 'frame sequence is desktop-gated');
assert.match(javascript, /hover: hover[\s\S]*pointer: fine/, 'frame sequence requires a desktop-class pointer');
assert.match(javascript, /FRAME_CACHE_LIMIT = 18/, 'decoded frame cache is bounded');
assert.doesNotMatch(javascript, /pendingDecodes/, 'decodes are coalesced instead of accumulating');
assert.doesNotMatch(javascript, /elapsed < 1250/, 'loader has no forced long hold');
assert.doesNotMatch(html, /[—–]/u, 'visible copy contains no em or en dashes');

console.log('NEVRA structural check passed: 451 frames, fallbacks, CTA, fonts, and motion guards present.');
