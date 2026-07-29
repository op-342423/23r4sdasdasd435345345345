/* ==========================================================
   brand.js — Part 8 of the brief: dynamic brand name (Global),
   plus Part 10's editable hero tagline, applied on every page.

   How it works:
   - Every page ships with the literal defaults ("THORN" /
     "NOT MADE FOR EVERYONE.") already in the HTML, so the page
     never flashes empty while this loads — it only *overwrites*
     text once the real setting arrives, same safe-fallback
     pattern as learn-more.js.
   - Elements to update are marked with `data-brand` (their
     textContent becomes the brand name) or `data-hero-tagline`
     (their textContent becomes the tagline). The <title> tag is
     handled separately: we swap the literal word "THORN" inside
     whatever the page's title already is.
   - Cached in sessionStorage so navigating between pages in the
     same session doesn't re-fetch /api/settings every time; the
     cache is short-lived (this session only) so an admin change
     shows up on the very next fresh visit/tab.
   - Fires a `thorn:brandready` event on `document` once applied,
     AND exposes `window.__brandReady`, a Promise that resolves
     with { brandName, heroTagline } the first time real data is
     applied (cached-this-session or freshly fetched) — so
     luxury.js's intro can `await` it once before building the
     timeline, guaranteeing the wordmark/tagline text is final
     *before* the reveal animation ever starts, instead of a race
     against an async fetch.
   ========================================================== */
(function () {
  const DEFAULT_BRAND_NAME = 'THORN';
  const DEFAULT_HERO_TAGLINE = 'NOT MADE FOR EVERYONE.';
  const CACHE_KEY = 'thornBrandSettingsCache';

  let resolveReady;
  window.__brandReady = new Promise((resolve) => { resolveReady = resolve; });

  function applyToDom(brandName, heroTagline) {
    document.querySelectorAll('[data-brand]').forEach((el) => {
      el.textContent = brandName;
    });
    document.querySelectorAll('[data-hero-tagline]').forEach((el) => {
      el.textContent = heroTagline;
    });
    if (document.title.indexOf(DEFAULT_BRAND_NAME) !== -1) {
      document.title = document.title.split(DEFAULT_BRAND_NAME).join(brandName);
    }
    window.__brandName = brandName;
    window.__heroTagline = heroTagline;
    document.dispatchEvent(new CustomEvent('thorn:brandready', {
      detail: { brandName, heroTagline }
    }));
    if (resolveReady) { resolveReady({ brandName, heroTagline }); resolveReady = null; }
  }

  // Apply a cached value immediately (if we have one) so repeat
  // navigations in the same session never show the literal default
  // even for a frame, then refresh from the network in the background.
  let cached = null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) { /* ignore corrupt cache */ }

  if (cached && cached.brandName) {
    applyToDom(cached.brandName, cached.heroTagline || DEFAULT_HERO_TAGLINE);
  }

  fetch('/api/settings')
    .then((r) => (r.ok ? r.json() : null))
    .then((settings) => {
      const brandName = (settings && settings.brandName) || DEFAULT_BRAND_NAME;
      const heroTagline = (settings && settings.heroTagline) || DEFAULT_HERO_TAGLINE;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ brandName, heroTagline }));
      } catch (e) { /* storage full/unavailable — non-critical */ }
      applyToDom(brandName, heroTagline);
    })
    .catch(() => {
      // Network/API error: keep whatever is already on the page
      // (the shipped defaults, or a cached value applied above).
      if (!cached) {
        applyToDom(DEFAULT_BRAND_NAME, DEFAULT_HERO_TAGLINE);
      }
    });
})();
