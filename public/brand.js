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
     (their textContent becomes the tagline). The <title> tag,
     every <meta description>/Open Graph/Twitter tag, and the
     browser-tab favicon are updated too: anything still literally
     containing "THORN" gets that swapped for the real name, and
     the favicon is redrawn with the new name's first letter.
   - The /api/settings fetch is capped at 900ms (aborted if slower)
     so window.__brandReady always resolves quickly either way —
     previously a slow request could lose a race in luxury.js and
     leave the literal word "THORN" briefly on screen instead of
     the real name.
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
  const FETCH_TIMEOUT_MS = 900; // keeps window.__brandReady resolving quickly even on a slow/hanging network, so luxury.js's own safety timeout never has to win the race and show the wrong name

  let resolveReady;
  window.__brandReady = new Promise((resolve) => { resolveReady = resolve; });

  // Swaps every literal "THORN" occurrence for the real brand name across
  // <title> and every meta tag whose content mentions it (description,
  // Open Graph, Twitter card) — so a shared link's preview always shows
  // the current brand, not whatever name shipped in the HTML.
  function swapBrandInMetaTags(brandName) {
    if (document.title.indexOf(DEFAULT_BRAND_NAME) !== -1) {
      document.title = document.title.split(DEFAULT_BRAND_NAME).join(brandName);
    }
    document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]').forEach((tag) => {
      const content = tag.getAttribute('content');
      if (content && content.indexOf(DEFAULT_BRAND_NAME) !== -1) {
        tag.setAttribute('content', content.split(DEFAULT_BRAND_NAME).join(brandName));
      }
    });
  }

  // Redraws the browser-tab favicon with the brand's first letter so it
  // matches whatever name the owner has set, instead of a hardcoded "T".
  // Client-side only (a <link> swap) — this changes what the visitor's
  // own tab shows, not what a link-preview crawler sees.
  function updateFavicon(brandName) {
    try {
      const letter = (brandName || DEFAULT_BRAND_NAME).trim().charAt(0).toUpperCase() || 'T';
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, 32, 35);
      const dataUrl = canvas.toDataURL('image/png');
      document.querySelectorAll('link[rel="icon"]').forEach((link) => { link.href = dataUrl; });
    } catch (e) { /* canvas unavailable — keep the shipped static favicon */ }
  }

  function applyToDom(brandName, heroTagline) {
    document.querySelectorAll('[data-brand]').forEach((el) => {
      el.textContent = brandName;
    });
    document.querySelectorAll('[data-hero-tagline]').forEach((el) => {
      el.textContent = heroTagline;
    });
    swapBrandInMetaTags(brandName);
    if (brandName !== DEFAULT_BRAND_NAME) updateFavicon(brandName);
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

  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  fetch('/api/settings', controller ? { signal: controller.signal } : undefined)
    .then((r) => (r.ok ? r.json() : null))
    .then((settings) => {
      if (timeoutId) clearTimeout(timeoutId);
      const brandName = (settings && settings.brandName) || DEFAULT_BRAND_NAME;
      const heroTagline = (settings && settings.heroTagline) || DEFAULT_HERO_TAGLINE;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ brandName, heroTagline }));
      } catch (e) { /* storage full/unavailable — non-critical */ }
      applyToDom(brandName, heroTagline);
    })
    .catch(() => {
      // Network/API error, or the timeout above aborted a hung request:
      // keep whatever is already on the page (shipped defaults, or a
      // cached value applied above) rather than leaving __brandReady
      // unresolved forever.
      if (!cached) {
        applyToDom(DEFAULT_BRAND_NAME, DEFAULT_HERO_TAGLINE);
      }
    });
})();
