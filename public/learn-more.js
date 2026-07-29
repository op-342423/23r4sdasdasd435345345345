/* ==========================================================
   learn-more.js — populates and animates the dynamic "Learn More"
   section from whatever the owner set in the admin dashboard
   (routes/learn-more.js / api.js#getLearnMoreSection). Nothing here
   is hardcoded content — only the fallback "#products" destination
   if no button URL was set.

   If the section is disabled, or has no title yet, this script
   leaves it hidden and does nothing else — the existing "Learn more"
   popup (script.js) stays as the fallback so the button always does
   *something* even before the owner has configured this.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  const hasScrollTrigger = hasGsap && typeof ScrollTrigger !== 'undefined';
  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const section = document.getElementById('learnMore');
  if (!section) return;

  const els = {
    bg: document.getElementById('lmBg'),
    bgImage: document.getElementById('lmBgImage'),
    bgVideo: document.getElementById('lmBgVideo'),
    subtitle: document.getElementById('lmSubtitle'),
    title: document.getElementById('lmTitle'),
    description: document.getElementById('lmDescription'),
    quote: document.getElementById('lmQuote'),
    button: document.getElementById('lmButton'),
    buttonLabel: document.getElementById('lmButtonLabel')
  };

  /* ---------- SMOOTH SCROLL ----------
     Uses the Lenis instance luxury.js already set up (window.__lenis)
     when available, otherwise a plain scrollIntoView smooth scroll. */
  function smoothScrollTo(target) {
    if (!target) return;
    if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
      window.__lenis.scrollTo(target, { duration: 1.4 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /* ---------- HERO SCROLL INDICATOR ----------
     Independent of whether the section itself is enabled — it always
     hints there's more page below, and always scrolls down (to the
     Learn More section if enabled, otherwise just nudges the viewport). */
  (function setupScrollIndicator() {
    const indicator = document.getElementById('scrollIndicator');
    if (!indicator) return;
    setTimeout(() => indicator.classList.add('is-visible'), 2600);
    window.addEventListener('scroll', () => {
      indicator.classList.toggle('is-visible', window.scrollY < window.innerHeight * 0.4);
    }, { passive: true });
    indicator.addEventListener('click', () => {
      const dest = (window.__learnMoreSectionActive && !section.hidden) ? section : document.getElementById('products');
      smoothScrollTo(dest);
    });
  })();

  async function init() {
    let data;
    try {
      data = await getLearnMoreSection();
    } catch (e) {
      console.error('Learn More section: could not load content (non-critical):', e);
      return;
    }
    if (!data || !data.enabled || !data.title || !data.title.trim()) return;

    window.__learnMoreSectionActive = true;

    if (els.subtitle) els.subtitle.textContent = data.subtitle || '';
    if (els.title) els.title.textContent = data.title;
    if (els.description) els.description.textContent = data.description || '';
    if (els.quote) els.quote.textContent = data.quote ? `\u201C${data.quote}\u201D` : '';

    const label = (data.buttonText || '').trim();
    if (label && els.button) {
      if (els.buttonLabel) els.buttonLabel.textContent = label;
      els.button.hidden = false;
      const url = (data.buttonUrl || '').trim() || '#products';
      els.button.setAttribute('href', url);
      if (url.startsWith('#')) {
        els.button.addEventListener('click', (e) => {
          const dest = document.querySelector(url);
          if (dest) { e.preventDefault(); smoothScrollTo(dest); }
        });
      }
    } else if (els.button) {
      els.button.hidden = true;
    }

    if (data.accentColor) section.style.setProperty('--lm-accent', data.accentColor);

    if (data.bgType === 'video' && data.bgDataUrl) {
      section.classList.add('learn-more--bg-video');
      if (els.bgVideo) {
        els.bgVideo.src = data.bgDataUrl;
        els.bgVideo.style.display = '';
        els.bgVideo.play().catch(() => {});
      }
      if (els.bgImage) els.bgImage.style.display = 'none';
    } else if (data.bgDataUrl) {
      section.classList.add('learn-more--bg-image');
      if (els.bgImage) {
        els.bgImage.style.backgroundImage = `url("${data.bgDataUrl}")`;
        els.bgImage.style.display = '';
      }
      if (els.bgVideo) els.bgVideo.style.display = 'none';
    }

    section.hidden = false;

    const learnMoreBtn = document.getElementById('learnMoreBtn');
    if (learnMoreBtn) {
      learnMoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        smoothScrollTo(section);
      });
    }

    setupReveal();
    setupParallax();
  }

  /* ---------- ENTRANCE ANIMATION ----------
     The actual motion (opacity 0→1, translateY 40px→0, blur removed,
     1.2s, staggered title → subtitle → description → quote → button)
     lives in CSS as the ".is-in-view" state — see styles.css. GSAP
     ScrollTrigger is what decides *when* to add that class, so the
     reveal fires the moment the section enters the viewport rather
     than on page load. Falls back to IntersectionObserver if
     ScrollTrigger isn't available, and skips straight to visible for
     prefers-reduced-motion. */
  function setupReveal() {
    if (reduceMotion) { section.classList.add('is-in-view'); return; }

    if (hasScrollTrigger) {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 75%',
        once: true,
        onEnter: () => section.classList.add('is-in-view')
      });
    } else if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            section.classList.add('is-in-view');
            io.disconnect();
          }
        });
      }, { threshold: 0.25 });
      io.observe(section);
    } else {
      section.classList.add('is-in-view');
    }
  }

  /* ---------- SCROLL PARALLAX + CURSOR INTERACTION ----------
     Background drifts slowly as the section scrolls through the
     viewport (GPU-accelerated transform, GSAP-driven), plus a subtle
     cursor-follow drift while hovering — both skipped for
     prefers-reduced-motion or if GSAP/ScrollTrigger didn't load. */
  function setupParallax() {
    if (reduceMotion || !hasGsap || !els.bg) return;

    if (hasScrollTrigger) {
      gsap.to(els.bg, {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }

    section.addEventListener('mousemove', (e) => {
      const rect = section.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(els.bg, { x: px * 14, y: py * 14, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    });
    section.addEventListener('mouseleave', () => {
      gsap.to(els.bg, { x: 0, y: 0, duration: 1, ease: 'power2.out', overwrite: 'auto' });
    });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
})();
