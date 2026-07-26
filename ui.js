/* ==========================================================
   ui.js — small shared UI helpers used on every page:
   - toast notifications (replaces browser alert())
   - focus trap for modals/drawers (keyboard accessibility)
   - magnetic button pull effect
   - light hover "tick" sound
   - number counter animation
   These are plain functions attached to window so any page's
   inline script or script.js can call them after including
   this file.
   ========================================================== */

/* ---------------- Persistent warning banner ---------------- */
// Unlike toasts (which auto-dismiss in ~3s), this stays until the
// person closes it — for things they need to actually notice, like
// "your changes aren't being saved." Safe to call more than once;
// it won't stack duplicate banners.
window.showPersistentBanner = function (message) {
  if (document.querySelector('.site-banner')) return;
  const el = document.createElement('div');
  el.className = 'site-banner';
  el.innerHTML = `<span class="site-banner__text"></span><button type="button" class="site-banner__close" aria-label="Dismiss">&times;</button>`;
  el.querySelector('.site-banner__text').textContent = message;
  document.body.prepend(el);
  el.querySelector('.site-banner__close').addEventListener('click', () => el.remove());
};

/* ---------------- Toast notifications ---------------- */
(function () {
  let container = null;
  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
  }

  window.showToast = function (message, type) {
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = message;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 350);
    }, 3200);
  };
})();

/* ---------------- Focus trap for modals/drawers ---------------- */
// Keeps Tab / Shift+Tab cycling inside `container` while `isActive()`
// returns true. Call once per container; safe to call multiple times.
window.trapFocus = function (container, isActive) {
  if (!container || container.__focusTrapAttached) return;
  container.__focusTrapAttached = true;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || (isActive && !isActive())) return;
    const focusables = Array.from(container.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
};

/* ---------------- Magnetic buttons ---------------- */
// The button drifts a few px toward the cursor while it's nearby,
// then eases back to place on mouseleave.
window.makeMagnetic = function (el, strength) {
  if (!el || el.__magnetic) return;
  el.__magnetic = true;
  const pull = strength || 14;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translate(${x * pull}px, ${y * pull}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
};

/* ---------------- Light hover tick sound ---------------- */
let __uiAudioCtx = null;
let __lastTick = 0;
window.playHoverTick = function () {
  const now = Date.now();
  if (now - __lastTick < 90) return; // throttle rapid re-triggers
  __lastTick = now;
  try {
    __uiAudioCtx = __uiAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = __uiAudioCtx.currentTime;
    const osc = __uiAudioCtx.createOscillator();
    const gain = __uiAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain).connect(__uiAudioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch (e) { /* audio not available */ }
};

/* ---------------- Number counter animation ---------------- */
// Animates the text content of `el` counting from 0 to `finalText`
// (a pre-formatted price string like "$45"), extracting the numeric
// part to animate and re-applying the currency symbol/formatting.
window.animateNumberTo = function (el, finalText, duration) {
  if (!el) return;
  const match = finalText.match(/([\d.,]+)/);
  if (!match) { el.textContent = finalText; return; }
  const numStr = match[1].replace(/,/g, '');
  const target = parseFloat(numStr);
  if (isNaN(target)) { el.textContent = finalText; return; }
  const prefix = finalText.slice(0, match.index);
  const suffix = finalText.slice(match.index + match[1].length);
  const dur = duration || 500;
  const start = performance.now();

  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(target * eased);
    el.textContent = prefix + val + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = finalText;
  }
  requestAnimationFrame(tick);
};
