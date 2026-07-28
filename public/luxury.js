/* ==========================================================
   luxury.js — cinematic entry, continuous ambient motion, breathing
   glow, and mouse parallax for the site.

   ENTRY SEQUENCE — "The Orb Reveal" (Part 9 of the brief):
   Screen is black (the hero video sits behind an opaque veil). A
   single point of light ignites at the center, rotates in place with
   a sweeping specular highlight, grows, morphs into a thin rotating
   ring, then blooms outward in a fast burst of light. In that bloom:
   the veil fades so the hero video emerges from darkness, the brand
   wordmark (any length — see brand.js/Part 8) fades and scales in as
   one clean block, and nav / tagline / CTA buttons settle in right
   after. This entirely replaces the old letter-by-letter "THORN"
   formation, which broke for any brand name that wasn't exactly 5
   letters — the orb doesn't know or care how long the wordmark is,
   since the wordmark only ever appears as a single fade+scale block.

   Everything here is additive on top of the resting CSS state: if
   GSAP fails to load, or the person has prefers-reduced-motion set,
   the page still looks correct — it just skips the choreography and
   shows the final state immediately. Nothing here blocks script.js
   (cart, products, modals), which runs independently.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';

  const heroVeil = document.getElementById('heroVeil');
  const introOrb = document.getElementById('introOrb');
  const nav = document.querySelector('.nav');
  const heroTitle = document.getElementById('heroTitle');
  const heroSub = document.querySelector('.hero__sub');
  const heroCta = document.querySelector('.hero__cta');
  const heroVideo = document.getElementById('heroVideo');
  const skipBtn = document.getElementById('skipIntroBtn');

  let introTimeline = null;

  /* ---------- LENIS SMOOTH SCROLL ---------- */
  (function setupLenis() {
    if (reduceMotion || typeof Lenis === 'undefined') return;
    try {
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      window.__lenis = lenis; // let other scripts (e.g. learn-more.js) drive scrollTo
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    } catch (e) {
      console.error('Lenis setup failed (non-critical):', e);
    }
  })();


  /* ---------- ENTRY EXPERIENCE ---------- */
  function finishIntroInstantly() {
    if (heroVeil) heroVeil.style.display = 'none';
    if (introOrb) introOrb.style.display = 'none';
    if (nav) nav.style.opacity = '1';
    if (heroTitle) { heroTitle.style.opacity = '1'; heroTitle.style.transform = 'none'; }
    if (heroSub) { heroSub.style.animation = 'none'; heroSub.style.opacity = '1'; }
    if (heroCta) { heroCta.style.animation = 'none'; heroCta.style.opacity = '1'; }
    if (skipBtn) { skipBtn.classList.remove('is-visible'); skipBtn.style.display = 'none'; }
    startContinuousMotion();
  }

  function buildIntro() {
    if (!heroTitle) return;

    const seenBefore = sessionStorage.getItem('thornIntroSeen') === '1';
    sessionStorage.setItem('thornIntroSeen', '1');

    const orbDisk = document.getElementById('orbDisk');
    const orbRing = document.getElementById('orbRing');
    const orbBloom = document.getElementById('orbBloom');
    const orbSheen = document.getElementById('orbSheen');
    const orbSheenGroup = document.getElementById('orbSheenGroup');

    if (!orbDisk || !orbRing || !orbBloom || !introOrb) { finishIntroInstantly(); return; }

    if (nav) gsap.set(nav, { opacity: 0 });
    if (heroSub) { heroSub.style.animation = 'none'; gsap.set(heroSub, { opacity: 0, y: 10 }); }
    // NOTE: the wrapper itself must stay at opacity 1 — only the buttons
    // inside it start hidden. A parent stuck at opacity 0 keeps its
    // children invisible forever, even after the children are tweened
    // back to opacity 1 individually.
    const ctaBtns = heroCta ? Array.from(heroCta.children) : [];
    if (heroCta) { heroCta.style.animation = 'none'; gsap.set(heroCta, { opacity: 1 }); gsap.set(ctaBtns, { opacity: 0, y: 12 }); }
    if (heroVeil) gsap.set(heroVeil, { opacity: 1 });

    // The wordmark appears as one clean block at the end — no per-
    // letter choreography needed, so it works for any brand name length.
    gsap.set(heroTitle, { opacity: 0, scale: 0.92 });
    gsap.set(orbDisk, { opacity: 1, attr: { r: 0 } });
    gsap.set(orbRing, { opacity: 0, attr: { r: 46 }, strokeWidth: 0 });
    gsap.set(orbBloom, { opacity: 0, attr: { r: 0 } });
    gsap.set(orbSheen, { opacity: 0 });
    gsap.set(orbSheenGroup, { rotation: -20 });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        if (skipBtn) { skipBtn.classList.remove('is-visible'); skipBtn.style.pointerEvents = 'none'; }
        if (introOrb) introOrb.style.display = 'none';
        startContinuousMotion();
      }
    });
    introTimeline = tl;

    if (seenBefore) {
      // Repeat visit, same tab: shorter spin, faster bloom, same beats.
      tl.to(orbDisk, { attr: { r: 15 }, duration: 0.35, ease: 'power2.out' }, 0)
        .to(orbSheen, { opacity: 0.8, duration: 0.2 }, 0.1)
        .to(orbSheenGroup, { rotation: 340, duration: 0.7, ease: 'power1.inOut' }, 0.1)
        // Morph: disk shrinks away while the ring grows in, still spinning.
        .to(orbDisk, { attr: { r: 0 }, opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.55)
        .to(orbRing, { opacity: 1, strokeWidth: 2.5, duration: 0.35 }, 0.55)
        .to(orbSheenGroup, { rotation: 560, duration: 0.5, ease: 'power1.in' }, 0.55)
        // Bloom + arrival, all together.
        .to(orbBloom, { opacity: 1, attr: { r: 130 }, duration: 0.45, ease: 'power2.out' }, 0.95)
        .to(orbBloom, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 1.2)
        .to(orbRing, { opacity: 0, duration: 0.3 }, 0.95)
        .to(heroVeil, { opacity: 0, duration: 0.5 }, 0.95)
        .to(heroTitle, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 1.0)
        .to(nav, { opacity: 1, duration: 0.4 }, 1.0)
        .to(heroSub, { opacity: 1, y: 0, duration: 0.35 }, 1.15)
        .to(ctaBtns, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06 }, 1.3);
      return tl;
    }

    // Full first-visit cinematic sequence (~2.7s total).
    // 1. Black hold, then a single point of light ignites at the center.
    tl.to(orbDisk, { attr: { r: 16 }, duration: 0.6, ease: 'power2.out' }, 0.3);

    // 2. The orb rotates in place, slow and deliberate, growing subtly
    //    as a specular highlight sweeps across its surface.
    tl.to(orbSheen, { opacity: 0.85, duration: 0.3 }, 0.5)
      .to(orbSheenGroup, { rotation: 340, duration: 1.1, ease: 'power1.inOut' }, 0.5)
      .to(orbDisk, { attr: { r: 20 }, duration: 1.1, ease: 'sine.inOut' }, 0.5);

    // 3. The orb morphs into a ring — silhouette stretches and hollows
    //    at the center — while it keeps rotating.
    tl.to(orbDisk, { attr: { r: 0 }, opacity: 0, duration: 0.55, ease: 'power1.in' }, 1.6)
      .to(orbRing, { opacity: 1, strokeWidth: 3, duration: 0.55, ease: 'power1.out' }, 1.6)
      .to(orbSheenGroup, { rotation: 620, duration: 0.9, ease: 'power1.in' }, 1.6);

    // 4. The ring blooms open — a fast, soft bloom of light, the moment
    //    of release. Veil fades, wordmark + nav/tagline/CTA arrive.
    tl.to(orbBloom, { opacity: 1, attr: { r: 150 }, duration: 0.55, ease: 'power2.out' }, 2.2)
      .to(orbBloom, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 2.55)
      .to(orbRing, { opacity: 0, duration: 0.35 }, 2.2)
      .to(heroVeil, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 2.2)
      .to(heroTitle, { opacity: 1, scale: 1, duration: 0.7, ease: 'power2.out' }, 2.3)
      .to(nav, { opacity: 1, duration: 0.8, ease: 'power1.out' }, 2.25)
      .to(heroSub, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.45)
      .to(ctaBtns, { opacity: 1, y: 0, duration: 0.55, stagger: 0.1, ease: 'power2.out' }, 2.6);

    return tl;
  }

  function runIntro() {
    if (!heroTitle) { startContinuousMotion(); return; }

    if (reduceMotion || !hasGsap) {
      finishIntroInstantly();
      return;
    }

    const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    // Wait for both the fonts AND the real brand name/tagline (Part 8/10)
    // before building the timeline, so the wordmark/tagline text is
    // already final the moment they fade in — no flash of stale text
    // after the reveal has started. brand.js resolves this promise
    // immediately from cache if available, so this rarely adds delay.
    const brandReady = window.__brandReady || Promise.resolve();
    Promise.race([
      Promise.all([fontsReady, brandReady]),
      new Promise(r => setTimeout(r, 700))
    ]).then(() => {
      try {
        buildIntro();
      } catch (e) {
        console.error('Intro build failed (non-critical):', e);
        finishIntroInstantly();
      }
    });

    if (skipBtn) {
      setTimeout(() => skipBtn.classList.add('is-visible'), 900);
      skipBtn.addEventListener('click', () => {
        if (introTimeline) introTimeline.progress(1);
      });
    }
  }

  if (document.readyState === 'complete') runIntro();
  else window.addEventListener('load', runIntro, { once: true });


  /* ---------- CONTINUOUS AMBIENT MOTION ---------- */
  function startContinuousMotion() {
    if (reduceMotion || !hasGsap) return;

    if (heroTitle) {
      gsap.to(heroTitle, {
        x: '+=2.5', duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true
      });
      gsap.to(heroTitle, {
        scale: 1.01, duration: 8.5, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.4
      });
    }

    if (heroVideo) {
      heroVideo.style.animation = 'none';
      gsap.fromTo(heroVideo, { scale: 1 }, { scale: 1.04, duration: 25, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }
  }


  /* ---------- MOUSE PARALLAX ---------- */
  (function setupParallax() {
    if (reduceMotion || !hasGsap) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const layers = [
      { el: heroVideo, amount: 6 },
      { el: heroTitle, amount: 2 },
      { el: heroCta, amount: 3 },
      { el: nav, amount: 1 }
    ].filter(l => l.el);

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      layers.forEach(l => {
        gsap.to(l.el, {
          xPercent: 0,
          x: px * l.amount * 2,
          y: py * l.amount * 2,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });
    });

    hero.addEventListener('mouseleave', () => {
      layers.forEach(l => gsap.to(l.el, { x: 0, y: 0, duration: 0.8, ease: 'power2.out', overwrite: 'auto' }));
    });
  })();
})();
