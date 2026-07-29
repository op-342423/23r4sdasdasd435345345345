/* ==========================================================
   ui.js — small shared UI utilities used across script.js and
   admin.js. Kept dependency-free (no build step) so it can be
   included with a plain <script> tag like every other file here.
   ========================================================== */

/* ---------- PAGE TRANSITIONS ----------
   Wraps the page's existing content in #pageContentRoot (a single
   layer we can blur/fade as one unit) and adds a full-screen veil.
   Clicking any same-origin link fades + blurs the current page
   out, then navigates; the incoming page fades/un-blurs in on load.
   Deliberately framework-free (no GSAP dependency) so it behaves
   identically on every page, including ones that don't load GSAP. */
(function () {
  if (!document.body) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.id = 'pageContentRoot';
  while (document.body.firstChild) root.appendChild(document.body.firstChild);
  document.body.appendChild(root);

  const veil = document.createElement('div');
  veil.id = 'pageTransitionVeil';
  document.body.appendChild(veil);

  if (reduceMotion) return;

  // Incoming page: start blurred, then lift on the next frame so
  // the browser has committed the "blurred" state first (otherwise
  // the transition has nothing to transition from).
  document.body.classList.add('page-enter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.remove('page-enter'));
  });

  function isTransitionable(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
    let url;
    try { url = new URL(href, location.href); } catch (e) { return false; }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false; // same page (e.g. #anchor)
    return true;
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const a = e.target.closest('a');
    if (!isTransitionable(a)) return;
    e.preventDefault();
    veil.classList.add('is-active');
    root.style.opacity = '0';
    setTimeout(() => { window.location.href = a.href; }, 600);
  });

  // If the page is restored from bfcache (browser back/forward),
  // make sure the veil doesn't stay stuck visible.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      veil.classList.remove('is-active');
      root.style.opacity = '';
    }
  });
})();

/* ---------- TOASTS ---------- */
(function () {
  let container = null;
  function getContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  window.showToast = function showToast(message, type) {
    const wrap = getContainer();
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'success' ? ' toast--success' : type === 'error' ? ' toast--error' : '');
    toast.textContent = message;
    wrap.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-in'));

    setTimeout(() => {
      toast.classList.remove('is-in');
      toast.classList.add('is-out');
      setTimeout(() => toast.remove(), 320);
    }, 2600);
  };
})();

/* ---------- FOCUS TRAP ----------
   Keeps Tab/Shift+Tab cycling inside an open modal/drawer instead
   of leaking focus out to the page behind it. `isOpen` is a
   function so the trap can check current state on every keydown
   without needing to be re-registered when the element opens. */
window.trapFocus = function trapFocus(el, isOpen) {
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !isOpen()) return;
    const focusable = el.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
};

/* ---------- MAGNETIC BUTTONS ----------
   The element eases toward the cursor while hovered, within a
   capped travel distance, then springs back to rest on leave. */
window.makeMagnetic = function makeMagnetic(el, strength) {
  if (!el) return;
  const pull = strength || 14;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const max = pull;
    const dx = Math.max(-max, Math.min(max, x * 0.3));
    const dy = Math.max(-max, Math.min(max, y * 0.3));
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'translate(0, 0)';
  });
};

/* ---------- ANIMATED NUMBER ----------
   Used for the price counting up in the product modal. `to` may
   arrive as a pre-formatted string (e.g. "$48") — pull the digits
   back out so the count animates, then set the exact final text. */
window.animateNumberTo = function animateNumberTo(el, to, duration) {
  if (!el) return;
  const match = String(to).match(/[\d.,]+/);
  const targetNum = match ? parseFloat(match[0].replace(/,/g, '')) : NaN;
  const prefix = match ? String(to).slice(0, match.index) : '';
  const suffix = match ? String(to).slice(match.index + match[0].length) : '';

  if (Number.isNaN(targetNum)) {
    el.textContent = to;
    return;
  }

  const start = performance.now();
  const dur = duration || 400;
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = targetNum * eased;
    el.textContent = prefix + current.toFixed(targetNum % 1 === 0 ? 0 : 2) + suffix;
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = to;
  }
  requestAnimationFrame(frame);
};
