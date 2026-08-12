import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const [html, css, javascript, manifestSource, loaderStats] = await Promise.all([
  read('index.html'),
  read('src/styles.css'),
  read('src/main.js'),
  read('public/frames/hero/manifest.json'),
  stat(path.join(root, 'public/media/loader.mp4')),
]);

const manifest = JSON.parse(manifestSource);
assert.equal(manifest.version, 1, 'frame manifest version');
assert.match(manifest.pack, /^packs\/hero-15fps-[a-f0-9]{12}\.pack$/, 'content-addressed frame pack');
const packStats = await stat(path.join(root, 'public/frames/hero', manifest.pack));
assert.equal(manifest.frames.length, 451, 'hero frame count');
let expectedOffset = 0;
for (const [offset, length] of manifest.frames) {
  assert.equal(offset, expectedOffset, 'frame pack offsets are contiguous');
  assert.ok(Number.isInteger(length) && length > 0, 'frame pack lengths are valid');
  expectedOffset += length;
}
assert.equal(expectedOffset, packStats.size, 'manifest spans the complete frame pack');
assert.equal(manifest.bytes, packStats.size, 'manifest records the exact pack size');
assert.ok(packStats.size < 10_000_000, 'frame pack stays below 10 MB');
assert.ok(loaderStats.size < 2_500_000, 'loader stays below 2.5 MB');
assert.match(html, /href="#specs"/, 'primary CTA has a working destination');
assert.match(html, /Fictional vehicle \/ generated concept film/, 'concept proof label is visible');
assert.match(html, /muted[\s\S]*preload="auto"/, 'normal video is muted and preloaded');
assert.match(html, /min-width: 768px[\s\S]*hover: hover[\s\S]*pointer: fine[\s\S]*fetch\('\/media\/loader\.mp4'/, 'loader video is desktop-gated');
assert.match(html, /__NEVRA_FAIL_OPEN__[\s\S]*2400/, 'module failures release the loader');
assert.match(css, /prefers-reduced-motion: reduce/, 'reduced-motion fallback exists');
assert.match(css, /"Archivo"/, 'Archivo is the display face');
assert.match(css, /"Martian Mono"/, 'Martian Mono is the text face');
assert.match(javascript, /desktopSequence[\s\S]*new FrameSequence/, 'frame sequence is desktop-gated');
assert.match(javascript, /hover: hover[\s\S]*pointer: fine/, 'frame sequence requires a desktop-class pointer');
assert.match(javascript, /touchSequence[\s\S]*new FrameSequence/, 'touch devices receive a frame sequence');
assert.match(javascript, /function initLenis\(\)[\s\S]*if \(!desktopSequence\)/, 'mobile keeps native scrolling');
assert.match(javascript, /FRAME_CACHE_LIMIT = 18/, 'decoded frame cache is bounded');
assert.match(javascript, /TOUCH_FRAME_CACHE_LIMIT = 6/, 'touch decoded frame cache stays small');
assert.match(javascript, /function initTouchSequenceStory[\s\S]*end: 'bottom bottom'/, 'touch sequence maps native sticky scroll progress');
assert.match(javascript, /if \(touchSequence\) document\.documentElement\.classList\.add\('has-touch-story'\)/, 'touch story reserves stable space before frames load');
assert.match(javascript, /\.preload\(\(\) => \{\}, null\)/, 'touch frame loading remains progressive on slow networks');
assert.match(javascript, /trigger\.refresh\(\);\s*trigger\.update\(\);[\s\S]*await touchStory\.ready/, 'touch canvas resolves current scroll progress before revealing');
assert.doesNotMatch(javascript, /window\.scrollY > 2/, 'mobile scrolling must not permanently disable the sequence');
assert.match(css, /has-touch-story[\s\S]*400svh/, 'touch story reserves stable scroll space');
assert.ok(javascript.lastIndexOf("document.documentElement.classList.remove('has-touch-story')") > javascript.indexOf('run().catch'), 'global failure collapses the touch story');
assert.match(javascript, /IDLE_FRAME_INTERVAL = 1 \/ 15/, 'idle orbit runs at the native 15 fps cadence');
assert.match(javascript, /IDLE_TICK_TOLERANCE = 0\.001/, 'idle cadence tolerates display timer quantization');
assert.match(javascript, /handoverProgress[\s\S]*handover\.offset \* \(1 - handoverProgress\)/, 'idle-to-scroll handover converges with scroll distance');
assert.match(javascript, /manifest\.pack[\s\S]*readPack/, 'desktop frames load through one streamed pack');
assert.doesNotMatch(javascript, /pendingDecodes/, 'decodes are coalesced instead of accumulating');
assert.doesNotMatch(javascript, /elapsed < 1250/, 'loader has no forced long hold');
assert.doesNotMatch(html, /[—–]/u, 'visible copy contains no em or en dashes');

console.log('NEVRA structural check passed: 451 packed frames, fallbacks, CTA, fonts, and motion guards present.');
