import 'lenis/dist/lenis.css';
import './styles.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(CustomEase, ScrollTrigger);

const ENTER = CustomEase.create('nevraEnter', '0.16, 1, 0.3, 1');
const EXIT = CustomEase.create('nevraExit', '0.7, 0, 0.84, 0');
const FRAME_COUNT = 451;
const FRAME_CACHE_LIMIT = 18;
const TOUCH_FRAME_CACHE_LIMIT = 6;
const TOUCH_SEQUENCE_LOAD_TIMEOUT = 12000;
const IDLE_FRAME_INTERVAL = 1 / 15;
const IDLE_TICK_TOLERANCE = 0.001;
const FRAME_MANIFEST_PATH = '/frames/hero/manifest.json';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopSequence = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches && !reducedMotion;
const touchSequence = window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)').matches && !reducedMotion;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const loader = document.querySelector('#loader');
const loaderLine = document.querySelector('#loader-line');
const loaderProgress = document.querySelector('#loader-progress');
const loaderFilms = [...document.querySelectorAll('[data-loader-film]')];
const heroStage = document.querySelector('#hero-stage');
const heroStageInner = document.querySelector('#hero-stage-inner');
const heroPoster = document.querySelector('#hero-poster');
const heroCanvas = document.querySelector('#hero-canvas');
const siteHeader = document.querySelector('#site-header');
const conceptNote = document.querySelector('.concept-note');
let loaderObjectUrl = null;

const debugState = {
  frameCount: FRAME_COUNT,
  mode: reducedMotion ? 'reduced' : desktopSequence ? 'sequence' : touchSequence ? 'touch-sequence-loading' : 'static-mobile',
  sequenceReady: false,
  sequenceFailed: false,
  loaderVideoReady: false,
  loaderExitMs: null,
  loaderTotalMs: null,
  currentFrame: 0,
};

window.__NEVRA_DEBUG__ = debugState;

const modulo = (value, base) => ((value % base) + base) % base;

class FrameSequence {
  constructor(canvas, poster, { cacheLimit = FRAME_CACHE_LIMIT, fit = 'cover', mediaScale = 1, positionY = 0.5 } = {}) {
    this.canvas = canvas;
    this.poster = poster;
    this.cacheLimit = cacheLimit;
    this.fit = fit;
    this.mediaScale = mediaScale;
    this.positionY = positionY;
    this.context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.blobs = new Array(FRAME_COUNT);
    this.bitmaps = new Map();
    this.decodePromise = null;
    this.queuedIndex = null;
    this.requestedIndex = 0;
    this.paintedIndex = -1;
    this.lastBitmap = null;
    this.bounds = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }

  async preload(onProgress, timeoutMs = window.__NEVRA_ASSET_DEADLINE_AT__ - performance.now()) {
    const remaining = timeoutMs;
    if (remaining <= 0) throw new Error('Frame preload deadline expired');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), remaining);

    try {
      const manifestResponse = await fetch(FRAME_MANIFEST_PATH, {
        cache: 'no-cache',
        signal: controller.signal,
      });
      if (!manifestResponse.ok) throw new Error(`Frame manifest failed with ${manifestResponse.status}`);

      const manifest = await manifestResponse.json();
      if (
        manifest.version !== 1 ||
        !/^packs\/hero-15fps-[a-f0-9]{12}\.pack$/.test(manifest.pack) ||
        !Number.isInteger(manifest.bytes) ||
        !Array.isArray(manifest.frames) ||
        manifest.frames.length !== FRAME_COUNT
      ) {
        throw new Error(`Frame manifest must contain ${FRAME_COUNT} valid entries`);
      }

      const packResponse = await fetch(`/frames/hero/${manifest.pack}`, {
        cache: 'force-cache',
        signal: controller.signal,
      });
      if (!packResponse.ok) throw new Error(`Frame pack failed with ${packResponse.status}`);

      const pack = await this.readPack(packResponse, onProgress);
      let expectedOffset = 0;
      this.blobs = manifest.frames.map((entry, index) => {
        const [offset, length] = entry;
        if (
          !Number.isInteger(offset) ||
          !Number.isInteger(length) ||
          offset !== expectedOffset ||
          length < 1 ||
          offset + length > pack.size
        ) {
          throw new Error(`Frame ${index + 1} has an invalid pack range`);
        }
        expectedOffset += length;
        return pack.slice(offset, offset + length, 'image/webp');
      });
      if (expectedOffset !== manifest.bytes || expectedOffset !== pack.size) {
        throw new Error('Frame manifest does not span the complete pack');
      }
    } finally {
      window.clearTimeout(timeout);
    }

    await this.draw(0, true);
  }

  async readPack(response, onProgress) {
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body || !total) {
      const pack = await response.blob();
      onProgress(1);
      return pack;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress(Math.min(received / total, 1));
    }

    onProgress(1);
    return new Blob(chunks, { type: 'application/octet-stream' });
  }

  async decode(index) {
    if (this.bitmaps.has(index)) {
      const cached = this.bitmaps.get(index);
      this.bitmaps.delete(index);
      this.bitmaps.set(index, cached);
      return cached;
    }

    const blob = this.blobs[index];
    if (!blob) throw new Error(`Frame ${index + 1} is not preloaded`);

    const bitmap = await this.decodeBlob(blob);
    this.bitmaps.set(index, bitmap);
    this.evict(this.requestedIndex);
    return bitmap;
  }

  async decodeBlob(blob) {
    if ('createImageBitmap' in window) return window.createImageBitmap(blob);

    const source = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    try {
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  evict(center) {
    while (this.bitmaps.size > this.cacheLimit) {
      let furthestKey = null;
      let furthestDistance = -1;

      for (const key of this.bitmaps.keys()) {
        const direct = Math.abs(key - center);
        const distance = Math.min(direct, FRAME_COUNT - direct);
        if (distance > furthestDistance && key !== this.paintedIndex) {
          furthestDistance = distance;
          furthestKey = key;
        }
      }

      if (furthestKey === null) return;
      const bitmap = this.bitmaps.get(furthestKey);
      if (typeof bitmap?.close === 'function') bitmap.close();
      this.bitmaps.delete(furthestKey);
    }
  }

  draw(rawIndex, force = false) {
    const index = modulo(Math.round(rawIndex), FRAME_COUNT);
    this.requestedIndex = index;
    debugState.currentFrame = index;

    if (!force && index === this.paintedIndex) return Promise.resolve();

    if (this.bitmaps.has(index)) {
      const bitmap = this.bitmaps.get(index);
      this.bitmaps.delete(index);
      this.bitmaps.set(index, bitmap);
      this.commit(index, bitmap);
      return Promise.resolve();
    }

    this.queuedIndex = index;
    if (!this.decodePromise) {
      this.decodePromise = this.flushDrawQueue(force).finally(() => {
        this.decodePromise = null;
        if (this.queuedIndex !== null) this.draw(this.queuedIndex).catch(() => {});
      });
    }

    return this.decodePromise;
  }

  async flushDrawQueue(force) {
    let forceNextPaint = force;

    while (this.queuedIndex !== null) {
      const index = this.queuedIndex;
      this.queuedIndex = null;
      const bitmap = await this.decode(index);

      if (forceNextPaint || index === this.requestedIndex) this.commit(index, bitmap);
      forceNextPaint = false;
    }
  }

  commit(index, bitmap) {
    this.lastBitmap = bitmap;
    this.paintedIndex = index;
    this.paint(bitmap);
    this.canvas.classList.add('is-ready');
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    this.bounds = { width: bounds.width, height: bounds.height };
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(bounds.width * dpr);
    this.canvas.height = Math.round(bounds.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.lastBitmap) this.paint(this.lastBitmap);
  }

  paint(bitmap) {
    const bounds = this.bounds;
    if (!bounds) return;
    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    const fitScale = this.fit === 'contain'
      ? Math.min(bounds.width / width, bounds.height / height)
      : Math.max(bounds.width / width, bounds.height / height);
    const scale = fitScale * this.mediaScale;
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const x = (bounds.width - drawWidth) / 2;
    const y = (bounds.height - drawHeight) * this.positionY;

    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, bounds.width, bounds.height);
    this.context.drawImage(bitmap, x, y, drawWidth, drawHeight);
  }

  destroy() {
    this.resizeObserver.disconnect();
    for (const bitmap of this.bitmaps.values()) {
      if (typeof bitmap?.close === 'function') bitmap.close();
    }
    this.bitmaps.clear();
    this.blobs = [];
    this.canvas.classList.remove('is-ready', 'is-priming');
  }
}

function prepareReveals() {
  if (reducedMotion) return;
  gsap.set(siteHeader, { yPercent: -120 });
  gsap.set('.hero__content .line-inner', { yPercent: 116 });
  gsap.set(conceptNote, { y: 28 });
  gsap.set(heroStageInner, { scale: 1.045 });
}

function setLoaderProgress(progress) {
  gsap.set(loaderProgress, { scaleX: gsap.utils.clamp(0, 1, progress) });
}

function videoCanPlay(video, timeoutMs) {
  return new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve(true);
      return;
    }

    const finish = (ready) => {
      window.clearTimeout(timeout);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timeout = window.setTimeout(() => finish(false), Math.max(0, timeoutMs));

    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function startLoaderFilms() {
  const loaderBlob = await window.__NEVRA_LOADER_FETCH__;
  if (!loaderBlob) return false;
  loaderObjectUrl = URL.createObjectURL(loaderBlob);

  for (const film of loaderFilms) {
    if (!film.getAttribute('src')) {
      film.src = loaderObjectUrl;
      film.load();
    }
  }

  const ready = await videoCanPlay(
    loaderFilms[0],
    window.__NEVRA_ASSET_DEADLINE_AT__ - performance.now(),
  );
  debugState.loaderVideoReady = ready;
  if (!ready) return false;

  await Promise.allSettled(
    loaderFilms.map((film) => {
      film.currentTime = 0;
      return film.play();
    }),
  );
  return true;
}

function decodePoster(timeoutMs) {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      heroPoster.removeEventListener('load', finish);
      heroPoster.removeEventListener('error', finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, Math.max(0, timeoutMs));

    if (heroPoster.complete) {
      Promise.resolve(heroPoster.decode?.()).catch(() => {}).finally(finish);
      return;
    }

    heroPoster.addEventListener('load', finish, { once: true });
    heroPoster.addEventListener('error', finish, { once: true });
  });
}

function exitLoader() {
  return new Promise((resolve) => {
    const ratio = window.innerWidth / Math.max(loaderLine.getBoundingClientRect().width, 1);
    const topHalf = loader.querySelector('.loader__half--top');
    const bottomHalf = loader.querySelector('.loader__half--bottom');
    const wordmark = loader.querySelector('.loader__wordmark');
    const startedAt = performance.now();

    gsap
      .timeline({
        onComplete: () => {
          window.clearTimeout(window.__NEVRA_FAIL_OPEN__);
          debugState.loaderExitMs = Math.round(performance.now() - startedAt);
          debugState.loaderTotalMs = Math.round(
            performance.now() - (window.__NEVRA_LOADER_STARTED_AT__ || startedAt),
          );
          loader.remove();
          if (loaderObjectUrl) URL.revokeObjectURL(loaderObjectUrl);
          loaderObjectUrl = null;
          resolve();
        },
      })
      .to(loaderProgress, { scaleX: 1, duration: 0.06, ease: ENTER })
      .to(loaderLine, { scaleX: ratio, duration: 0.12, ease: ENTER })
      .to(wordmark, { scaleY: 0, duration: 0.1, ease: EXIT }, '<0.02')
      .to(heroStageInner, { scale: 1, duration: 0.4, ease: ENTER }, '<')
      .to(topHalf, { yPercent: -100, duration: 0.38, ease: EXIT }, '>-0.08')
      .to(bottomHalf, { yPercent: 100, duration: 0.38, ease: EXIT }, '<')
      .to(loaderLine, { scaleY: 0, duration: 0.08, ease: EXIT }, '<0.08');
  });
}

function scrambleHeadline() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const nodes = [...document.querySelectorAll('[data-scramble-text]')];
  const startedAt = performance.now();
  const duration = 900;

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);

    for (const node of nodes) {
      const finalText = node.dataset.scrambleText;
      const settled = Math.floor(finalText.length * eased);
      const display = [...finalText]
        .map((character, index) => {
          if (character === ' ' || index < settled) return character;
          return alphabet[Math.floor(Math.random() * alphabet.length)];
        })
        .join('');

      node.textContent = display;
      node.dataset.ghost = display;
    }

    if (progress < 1) {
      requestAnimationFrame(render);
      return;
    }

    for (const node of nodes) {
      node.textContent = node.dataset.scrambleText;
      node.dataset.ghost = node.dataset.scrambleText;
    }
  };

  requestAnimationFrame(render);
}

function revealHero() {
  gsap
    .timeline()
    .to(siteHeader, { yPercent: 0, duration: 0.8, ease: ENTER }, 0)
    .to('.hero__content .line-inner', { yPercent: 0, duration: 1, stagger: 0.075, ease: ENTER }, 0.04)
    .to(conceptNote, { y: 0, duration: 0.8, ease: ENTER }, 0.28)
    .call(scrambleHeadline, [], 0.22);
}

function initLenis() {
  if (!desktopSequence) return { lenis: null, destroy: () => {} };

  const lenis = new Lenis({
    duration: 1.2,
    easing: (time) => 1 - Math.pow(1 - time, 4),
    smoothWheel: true,
    syncTouch: false,
    anchors: { offset: 0 },
  });

  const tick = (time) => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    destroy: () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    },
  };
}

function initSequenceStory(sequence, lenis) {
  if (!sequence || !desktopSequence) return () => {};

  let engaged = false;
  let scrollProgress = 0;
  const handover = { offset: 0, startProgress: 0 };
  let idleFrame = sequence.paintedIndex >= 0 ? sequence.paintedIndex : 0;
  let lastIdleTick = null;

  const skewTo = gsap.quickTo(heroStageInner, 'skewY', {
    duration: 0.42,
    ease: ENTER,
  });

  const engage = () => {
    if (engaged) return;
    engaged = true;
    idleFrame = sequence.paintedIndex >= 0 ? sequence.paintedIndex : sequence.requestedIndex;
    handover.startProgress = scrollProgress;
    handover.offset = idleFrame - scrollProgress * (FRAME_COUNT - 1);
  };

  const idleTick = (time) => {
    if (engaged || document.hidden) {
      lastIdleTick = null;
      return;
    }
    if (lastIdleTick === null) {
      lastIdleTick = time;
      return;
    }
    const elapsed = time - lastIdleTick;
    if (elapsed < IDLE_FRAME_INTERVAL - IDLE_TICK_TOLERANCE) return;
    lastIdleTick += IDLE_FRAME_INTERVAL;
    if (time - lastIdleTick > IDLE_FRAME_INTERVAL) lastIdleTick = time;
    idleFrame = modulo(idleFrame + 1, FRAME_COUNT);
    sequence.draw(idleFrame).catch(() => {});
  };

  const onWheel = () => engage();
  const onTouch = () => engage();
  const onKey = (event) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) engage();
  };

  window.addEventListener('wheel', onWheel, { passive: true, once: true });
  window.addEventListener('touchstart', onTouch, { passive: true, once: true });
  document.addEventListener('keydown', onKey);
  gsap.ticker.add(idleTick);

  const trigger = ScrollTrigger.create({
    trigger: '#vehicle',
    start: 'top top',
    end: '+=460%',
    pin: heroStage,
    pinSpacing: true,
    scrub: 0.85,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      scrollProgress = self.progress;
      if (!engaged && self.progress > 0.002) engage();
      if (!engaged) return;

      const remaining = 1 - handover.startProgress;
      const handoverProgress = remaining <= 0
        ? 1
        : gsap.utils.clamp(0, 1, (self.progress - handover.startProgress) / remaining);
      const frame = modulo(
        handover.offset * (1 - handoverProgress) + self.progress * (FRAME_COUNT - 1),
        FRAME_COUNT,
      );
      sequence.draw(frame).catch(() => {});
      const skew = gsap.utils.clamp(-0.85, 0.85, self.getVelocity() / -1800);
      skewTo(skew);
    },
    onLeave: () => {
      handover.offset = 0;
      handover.startProgress = 0;
      skewTo(0);
    },
    onLeaveBack: () => skewTo(0),
  });

  const onLenisScroll = ({ scroll }) => {
    if (scroll > 2) engage();
  };
  lenis.on('scroll', onLenisScroll);

  return () => {
    trigger.kill();
    gsap.ticker.remove(idleTick);
    document.removeEventListener('keydown', onKey);
    lenis.off('scroll', onLenisScroll);
  };
}

function initTouchSequenceStory(sequence) {
  const trigger = ScrollTrigger.create({
    trigger: '#vehicle',
    start: 'top top',
    end: 'bottom bottom',
    invalidateOnRefresh: true,
    onUpdate: (self) => sequence.draw(self.progress * (FRAME_COUNT - 1)).catch(() => {}),
  });

  trigger.refresh();
  sequence.draw(trigger.progress * (FRAME_COUNT - 1)).catch(() => {});
  return () => trigger.kill();
}

function initSpecAnimations() {
  const introLine = document.querySelector('.specs__intro h2 .line-inner');
  const introCopy = document.querySelector('.specs__intro p');
  gsap.set(introLine, { yPercent: 112 });
  gsap.set(introCopy, { y: 24, clipPath: 'inset(0 0 100% 0)' });

  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.specs__intro',
        start: 'top 74%',
        once: true,
      },
    })
    .to(introLine, { yPercent: 0, duration: 1, ease: ENTER })
    .to(introCopy, { y: 0, clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: ENTER }, '<0.12');

  for (const spec of document.querySelectorAll('[data-spec]')) {
    const valueLine = spec.querySelector('.spec__value .line-inner');
    const counter = spec.querySelector('[data-counter]');
    const label = spec.querySelector('h3');
    const target = Number(counter.dataset.counter);
    const decimals = Number(counter.dataset.decimals || 0);
    const countState = { value: 0 };

    gsap.set(valueLine, { yPercent: 112 });
    gsap.set(label, { y: 24, clipPath: 'inset(0 0 100% 0)' });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: spec,
          start: 'top 68%',
          once: true,
        },
      })
      .to(valueLine, { yPercent: 0, duration: 0.95, ease: ENTER })
      .to(
        countState,
        {
          value: target,
          duration: 1.25,
          ease: ENTER,
          onUpdate: () => {
            counter.textContent = countState.value.toFixed(decimals);
          },
        },
        '<0.04',
      )
      .to(label, { y: 0, clipPath: 'inset(0 0 0% 0)', duration: 0.72, ease: ENTER }, '<0.2');
  }
}

function setFinalCounters() {
  for (const counter of document.querySelectorAll('[data-counter]')) {
    const decimals = Number(counter.dataset.decimals || 0);
    counter.textContent = Number(counter.dataset.counter).toFixed(decimals);
  }
}

function initMagnetics() {
  if (!finePointer || reducedMotion) return;

  for (const element of document.querySelectorAll('.magnetic')) {
    element.addEventListener('pointermove', (event) => {
      const bounds = element.getBoundingClientRect();
      const x = gsap.utils.clamp(-16, 16, event.clientX - (bounds.left + bounds.width / 2));
      const y = gsap.utils.clamp(-12, 12, event.clientY - (bounds.top + bounds.height / 2));
      gsap.to(element, { x: x * 0.45, y: y * 0.45, duration: 0.72, ease: 'elastic.out(1, 0.34)', overwrite: true });
    });

    element.addEventListener('pointerleave', () => {
      gsap.to(element, { x: 0, y: 0, duration: 0.85, ease: 'elastic.out(1, 0.32)', overwrite: true });
    });
  }
}

function initCursor() {
  if (!finePointer || reducedMotion) return;

  const cursor = document.querySelector('#custom-cursor');
  document.documentElement.classList.add('has-custom-cursor');
  gsap.set(cursor, { xPercent: -50, yPercent: -50 });

  const moveX = gsap.quickTo(cursor, 'x', { duration: 0.22, ease: ENTER });
  const moveY = gsap.quickTo(cursor, 'y', { duration: 0.22, ease: ENTER });
  let visible = false;
  window.addEventListener('pointermove', (event) => {
    if (!visible) {
      visible = true;
      cursor.classList.add('is-visible');
    }
    moveX(event.clientX);
    moveY(event.clientY);
  });

  const grow = () => gsap.to(cursor, { scale: 4.2, duration: 0.62, ease: 'elastic.out(1, 0.34)', overwrite: true });
  const shrink = () => gsap.to(cursor, { scale: 1, duration: 0.72, ease: 'elastic.out(1, 0.34)', overwrite: true });

  for (const link of document.querySelectorAll('a')) {
    link.addEventListener('pointerenter', grow);
    link.addEventListener('pointerleave', shrink);
  }
}

async function run() {
  prepareReveals();

  if (reducedMotion) {
    window.clearTimeout(window.__NEVRA_FAIL_OPEN__);
    loader.remove();
    document.body.classList.remove('is-loading');
    setFinalCounters();
    return;
  }

  await startLoaderFilms();
  let sequence = null;

  if (desktopSequence) {
    try {
      sequence = new FrameSequence(heroCanvas, heroPoster);
      await sequence.preload(setLoaderProgress);
      debugState.sequenceReady = true;
    } catch (error) {
      console.warn('Frame sequence unavailable, keeping poster fallback.', error);
      debugState.sequenceFailed = true;
      setLoaderProgress(1);
      sequence?.destroy();
      sequence = null;
    }
  } else {
    await decodePoster(window.__NEVRA_ASSET_DEADLINE_AT__ - performance.now());
    setLoaderProgress(1);
  }

  await exitLoader();
  document.body.classList.remove('is-loading');
  revealHero();

  const lenisRuntime = initLenis();
  let destroyStory = initSequenceStory(sequence, lenisRuntime.lenis);
  initSpecAnimations();
  initMagnetics();
  initCursor();
  ScrollTrigger.refresh();

  if (touchSequence) {
    heroCanvas.classList.add('is-priming');
    sequence = new FrameSequence(heroCanvas, heroPoster, {
      cacheLimit: TOUCH_FRAME_CACHE_LIMIT,
      fit: 'contain',
      mediaScale: 1.12,
      positionY: 0.6,
    });
    sequence
      .preload(() => {}, TOUCH_SEQUENCE_LOAD_TIMEOUT)
      .then(async () => {
        if (window.scrollY > 2) {
          debugState.mode = 'static-mobile';
          sequence.destroy();
          sequence = null;
          return;
        }

        document.documentElement.classList.add('has-touch-story');
        debugState.sequenceReady = true;
        debugState.mode = 'touch-sequence';
        destroyStory = initTouchSequenceStory(sequence);
        ScrollTrigger.refresh();
        await sequence.draw(0, true);
        requestAnimationFrame(() => heroCanvas.classList.remove('is-priming'));
      })
      .catch((error) => {
        console.warn('Touch sequence unavailable, keeping poster fallback.', error);
        debugState.sequenceFailed = true;
        debugState.mode = 'static-mobile';
        document.documentElement.classList.remove('has-touch-story');
        sequence?.destroy();
        sequence = null;
        ScrollTrigger.refresh();
      });
  }

  window.addEventListener(
    'beforeunload',
    () => {
      destroyStory();
      lenisRuntime.destroy();
      sequence?.destroy();
    },
    { once: true },
  );
}

run().catch((error) => {
  console.error('NEVRA experience failed open.', error);
  window.clearTimeout(window.__NEVRA_FAIL_OPEN__);
  document.documentElement.classList.remove('has-touch-story');
  loader?.remove();
  if (loaderObjectUrl) URL.revokeObjectURL(loaderObjectUrl);
  loaderObjectUrl = null;
  document.body.classList.remove('is-loading');
  gsap.set([siteHeader, conceptNote, heroStageInner], { clearProps: 'transform' });
  gsap.set(
    '.hero__content .line-inner, .specs__intro h2 .line-inner, .specs__intro p, .spec__value .line-inner, .spec h3',
    { clearProps: 'transform,clipPath' },
  );
  setFinalCounters();
});
