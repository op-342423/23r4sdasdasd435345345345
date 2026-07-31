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

/* ---------- WHATSAPP FLOAT ----------
   Reuses the phone number the owner already enters for the nav's
   "Call / copy number" icon (site_settings.phone) — nothing new to
   configure. Hidden entirely if no number is set. Only fetches
   /api/settings when getSiteSettings() is available (script.js
   defines it on every page that loads api.js, which is every page). */
(function () {
  function init() {
    if (typeof getSiteSettings !== 'function') return;
    getSiteSettings().then((settings) => {
      const phone = (settings && settings.phone || '').trim();
      if (!phone) return;
      const digits = phone.replace(/[^\d]/g, '');
      if (!digits) return;

      const btn = document.createElement('a');
      btn.className = 'whatsapp-float';
      btn.href = `https://wa.me/${digits}`;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.setAttribute('aria-label', 'Chat on WhatsApp');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z"/><path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.6A11 11 0 1 0 20.5 3.5zM12 20.9a9 9 0 0 1-4.6-1.3l-.3-.2-3.2 1 1-3.1-.2-.3A9 9 0 1 1 12 20.9z"/></svg>';
      document.body.appendChild(btn);
      requestAnimationFrame(() => btn.classList.add('is-visible'));
    }).catch(() => { /* non-critical — page works fine without the button */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ---------- MOBILE NAV DRAWER ----------
   Every storefront page ships the same <header class="nav"> /
   <nav class="nav__links"> markup (just with different links inside).
   Below 720px that row of links, cart icon, social icons and account
   links no longer fits — this turns .nav__links into a slide-in
   drawer with a hamburger toggle, once, here, instead of duplicating
   the wiring on all 12 pages. CSS lives in styles.css under
   "MOBILE NAV DRAWER" / the 720px media query. */
(function () {
  function init() {
    const nav = document.querySelector('.nav');
    const links = document.querySelector('.nav__links');
    if (!nav || !links) return;

    const burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span class="nav-burger__line"></span>';
    nav.insertBefore(burger, links);

    const overlay = document.createElement('div');
    overlay.className = 'nav-drawer-overlay';
    document.body.appendChild(overlay);

    let open = false;
    function setOpen(next) {
      open = next;
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      links.classList.toggle('is-open', open);
      overlay.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-drawer-locked', open);
    }

    burger.addEventListener('click', () => setOpen(!open));
    overlay.addEventListener('click', () => setOpen(false));
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    });
    if (window.trapFocus) window.trapFocus(links, () => open);

    // If the viewport is resized past the breakpoint while the
    // drawer is open (e.g. rotating a tablet), reset to the desktop
    // inline layout instead of leaving it stuck mid-transition.
    window.addEventListener('resize', () => {
      if (open && window.innerWidth > 720) setOpen(false);
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
