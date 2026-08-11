# NEVRA R/01 cinematic homepage build ledger

## Build contract

| Field | Decision / evidence |
| --- | --- |
| Business and homepage | NEVRA R/01, fictional performance-car launch concept |
| Audience and traffic | Design-conscious automotive audience arriving cold |
| Primary action and destination | Explore R/01 to `#specs` |
| Verified facts and proof boundary | All vehicle media and specifications are concept-only, not authentic product proof |
| Environment and existing stack | New Vite 8 vanilla JavaScript build with GSAP 3 and Lenis 1 |
| Scope and write authority | Single page, local build, GitHub repository, and Vercel deployment authorized by the user |
| Approved-media manifest | HERO-01, HERO-POSTER, and LOADER-01 below |
| Experience extent | cinematic-first |
| Mobile strategy | static-mobile poster, no frame-sequence requests |
| Runtime | Canvas frames on desktop, poster on mobile and reduced motion |
| Current status | LOCALLY VERIFIED / RELEASE READY |

## Evidence ledger

| ID | Visitor-facing fact or proof | Source | Rights/status | Approved wording | Notes |
| --- | --- | --- | --- | --- | --- |
| F-01 | NEVRA R/01 is fictional | User brief plus project decision | Concept-only | Fictional vehicle / generated concept film | Must remain visible |
| F-02 | Performance specifications | Project creative decision | Fictional concept target | 2.7 S, 920 PS, 340 KM/H, 1680 KG | Never present as real manufacturer data |
| F-03 | Generated footage | Higgsfield Seedance 2.5 jobs | User-authorized concept media | Generated concept film | No claim of real photography |

## Approved media

| ID | Exact file | Chapter / role | Status | Proof / rights | Dimensions / duration | Format / codec | Mobile | Desktop | Start -> end | Seam | Text-safe zone | Poster / fallback | Acceptance | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HERO-01 | `public/frames/hero/frame-0001.webp` to `frame-0451.webp` | Opening and scroll-controlled orbit | sample-approved | Concept / user-authorized generation | 1280x720, 30.041667 s source, 15 fps extraction | WebP sequence from H.264 | Unused | Native Canvas sequence | Left side -> full orbit -> left side | Continuous camera | Upper-left with black scrim | `public/media/hero-poster.webp` | Full physical orbit, stable identity, magenta/cyan light, hard highlights | Higgsfield job `974fb35d-3b24-49e2-ab95-af78bde23ef6`; source SHA-256 `8db1a8c4a44fbdb525d47c2bc02bbf00bd6a5940c3d7aeeb88ad90029862805a` |
| HERO-POSTER | `public/media/hero-poster.webp` | Immediate poster and all static fallbacks | approved | Concept / derived from HERO-01 | 1280x720 | WebP | Static-mobile | First paint and failure fallback | Stable hold | Hold | Upper-left with black scrim | Self | Same car and opening state | SHA-256 `e856806f21f12419456dbcef452799e71ad5738ebc7db4f80472380528633377` |
| LOADER-01 | `public/media/loader.mp4` | Loader background | sample-approved | Concept / user-authorized generation | 1280x720, 5.041667 s | H.264, muted, 611 KB | Native video | Native video | Fender -> wheel -> front detail | Cut into hero through split | Center wordmark | `public/media/loader-poster.webp` | Smooth macro travel, matching paint and colored light | Higgsfield job `8114bf10-9416-4d22-83df-0bf76546764d`; SHA-256 `49519c43b2cde6f36e8fc582c136e6563fe1e05b44e4e65e0ab77634c82ad49a` |

Rejected media is excluded: Higgsfield job `da406242-6f03-4622-a28c-5da20d524b50` did not orbit and is not a build source.

## Implementation

| Area | Decision | Evidence / file | Status |
| --- | --- | --- | --- |
| Design read and dials | Kinetic monochrome launch film, variance 9, motion 9, density 2 | `src/styles.css` | Implemented |
| Stack and dependencies | Vite, vanilla JavaScript, GSAP, Lenis | `package.json` | Implemented |
| Cinematic runtime | Preloaded compressed blobs plus 18-frame decoded LRU cache | `src/main.js` | Implemented |
| Header and opening clarity | NEVRA, concept label, promise, CTA | `index.html` | Implemented |
| Chapter text choreography | Masked line reveals and one headline scramble | `src/main.js` | Implemented |
| Services and proof | Not applicable; fictional single-product concept | `index.html` | Intentionally omitted |
| Primary CTA and contact behavior | `Explore R/01` anchors to specifications | `index.html` | Implemented |
| Posters and media failure | Poster remains when video, fetch, decode, or JavaScript fails | `index.html`, `src/main.js` | Implemented |
| Reduced motion and semantic DOM | No video or sequence source assignment under reduced motion | `src/main.js`, `src/styles.css` | Implemented |
| Structural check | Asset, copy, CTA, font, cache, and motion assertions | `scripts/check.mjs` | Implemented |

## Rendered QA

| Gate | Evidence | Pass / fail | Blocker or repair |
| --- | --- | --- | --- |
| Mobile 360 / 390 / 430 | Static poster, full-car art direction, zero frame requests, zero horizontal overflow | Pass | |
| Desktop 1440 | 451 frames ready, Canvas visible, all fonts loaded, zero horizontal overflow | Pass | |
| Forward / reverse checkpoints | Scroll 900 -> frame 98 twice; scroll 2500 -> frame 272 twice | Pass | Exact deterministic repeats |
| Seam captures and fast jumps | First-scroll maximum circular step 1; frame 1 / 451 SSIM 0.895785 | Pass | |
| Rotation and anchors | Full orbit reaches frame 450; keyboard CTA reaches `#specs`; counters finish at 2.7 / 920 / 340 / 1680 | Pass | |
| Reduced motion / zero cinematic requests | No loader MP4 or frame requests; final counters visible; static poster and normal scrolling | Pass | |
| Broken media / poster fallback | Aborted frame requests retain poster; forced media failure clears all reveal transforms and finalizes counters | Pass | |
| Keyboard / focus / links / CTA | Visible focus outline, semantic links, working skip link, working CTA | Pass | |
| Console / page / network | Clean production-bundle reload with zero unexpected console or request failures | Pass | Forced-failure logs excluded |
| LCP / CLS / INP / transfer / cache | Lighthouse mobile: Performance 86, Accessibility 100, Best Practices 100; FCP/LCP 3.0 s throttled, TBT 0 ms, CLS 0; cold local loader 1.51 s desktop / 1.09 s mobile; 18-bitmap decoded cache | Pass | SEO 66 is expected because the preview is intentionally `noindex` |
| Proof provenance / concept labels | Visible labels and ledger | Pass | |

## Quality score

| Category | Score | Evidence |
| --- | ---: | --- |
| Creative integration and continuity | 19 / 20 | Corrected full orbit, matching macro loader, controlled seam |
| Mobile-first art direction | 19 / 20 | Full-car poster at three phone widths and landscape touch gate |
| Design craft and conversion truth | 20 / 20 | Tight two-section concept, visible fictional labels, no invented proof |
| Motion behavior | 19 / 20 | One-frame first-input handoff, deterministic reverse scrub, reduced-motion path |
| Performance | 17 / 20 | Zero mobile sequence requests, 1.09 s mobile loader, 86 Lighthouse performance |
| Accessibility and resilience | 20 / 20 | 100 Lighthouse accessibility, keyboard path, fail-open fallbacks |
| Total | 114 / 120 | 95% |

## Verdict

**Status:** LOCALLY VERIFIED / RELEASE READY

**Passed scope:** Seedance media generation, local implementation, structural checks, production build, rendered browser QA, performance, accessibility, and resilience.

**Creative repair request:** None. The corrected hero and loader are accepted for this concept sample.

**Production gaps:** Physical iOS Safari remains a final device check; repository publication and deployment verification are the active release steps.

**Next smallest decision:** Publish the verified commit and verify the deployed response.
