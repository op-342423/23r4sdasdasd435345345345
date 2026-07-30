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

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="16" x2="12" y2="11"></line><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"></circle></svg>'
  };

  window.showToast = function showToast(message, type) {
    const wrap = getContainer();
    const kind = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.innerHTML = `<span class="toast__icon">${ICONS[kind]}</span><span class="toast__msg"></span>`;
    toast.querySelector('.toast__msg').textContent = message;
    wrap.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-in'));

    setTimeout(() => {
      toast.classList.remove('is-in');
      toast.classList.add('is-out');
      setTimeout(() => toast.remove(), 320);
    }, 2600);
  };
})();

/* ---------- BACK TO TOP ----------
   One floating button, shared across pages. Appears after the
   user has scrolled down a bit and smooth-scrolls back to the top
   on click. Skipped on pages tall enough that it'd never matter
   isn't necessary — it just stays hidden until the scroll threshold. */
(function () {
  function init() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
    document.body.appendChild(btn);

    let visible = false;
    function onScroll() {
      const shouldShow = window.scrollY > 480;
      if (shouldShow === visible) return;
      visible = shouldShow;
      btn.classList.toggle('is-visible', visible);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
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
