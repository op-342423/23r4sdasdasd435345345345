/* ==========================================================
   luxury.js — cinematic entry, continuous ambient motion, breathing
   glow, and mouse parallax for THORN.

   ENTRY SEQUENCE (matches the THORN intro spec):
   Screen is black (the hero video sits behind an opaque veil).
   "T" appears alone, centered, softly glowing. Then H/O/R/N arrive
   one by one, each with its own motion (H slides in from the right,
   O fades upward through blur, R rotates in, N slides up) — and
   because each hidden letter reserves zero width until it arrives,
   the word visually recentres itself, which reads as "T drifts left"
   exactly as the brief describes, with no separate tween needed.
   When the word is complete, the black veil dissolves so the hero
   video emerges from darkness while nav / subtitle / buttons arrive
   together. There is no separate intro screen and no cut — the
   animation IS the homepage.

   Everything here is additive on top of the resting CSS state: if
   GSAP/SplitType fail to load, or the person has prefers-reduced-motion
   set, the page still looks correct — it just skips the choreography
   and shows the final state immediately. Nothing here blocks
   script.js (cart, products, modals), which runs independently.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';

  const heroVeil = document.getElementById('heroVeil');
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


  /* ---------- SPLIT "THORN" INTO ANIMATABLE LETTERS ----------
     Prefers SplitType (per the technical spec). Each character ends
     up wrapped twice: an outer .letter "slot" (overflow-hidden, whose
     width we can animate from 0 → natural so it reserves no space
     until it arrives) around an inner .letter__inner (the thing that
     actually fades/slides/rotates/blurs in). Falls back to a manual
     split if SplitType isn't available, so the effect never depends
     on a third-party CDN being reachable. */
  function splitIntoLetters(el) {
    let innerEls = [];

    if (typeof SplitType !== 'undefined') {
      try {
        new SplitType(el, { types: 'chars', tagName: 'span' });
        innerEls = Array.from(el.querySelectorAll('.char'));
      } catch (e) {
        innerEls = [];
      }
    }

    if (!innerEls.length) {
      const text = el.textContent.trim();
      el.textContent = '';
      innerEls = text.split('').map((ch) => {
        const span = document.createElement('span');
        span.textContent = ch;
        el.appendChild(span);
        return span;
      });
    }

    innerEls.forEach((inner) => {
      inner.classList.add('letter__inner');
      const slot = document.createElement('span');
      slot.className = 'letter';
      inner.parentNode.insertBefore(slot, inner);
      slot.appendChild(inner);
    });

    return innerEls;
  }


  /* ---------- ENTRY EXPERIENCE ---------- */
  function finishIntroInstantly() {
    if (heroVeil) heroVeil.style.display = 'none';
    if (nav) nav.style.opacity = '1';
    if (heroTitle) { heroTitle.style.opacity = '1'; heroTitle.querySelectorAll('.letter, .letter__inner').forEach(l => { l.style.width = ''; l.style.opacity = '1'; l.style.transform = 'none'; l.style.filter = 'none'; }); }
    if (heroSub) { heroSub.style.animation = 'none'; heroSub.style.opacity = '1'; }
    if (heroCta) { heroCta.style.animation = 'none'; heroCta.style.opacity = '1'; }
    if (skipBtn) { skipBtn.classList.remove('is-visible'); skipBtn.style.display = 'none'; }
    startContinuousMotion();
  }

  function buildIntro() {
    if (!heroTitle) return;

    const seenBefore = sessionStorage.getItem('thornIntroSeen') === '1';
    sessionStorage.setItem('thornIntroSeen', '1');

    const chars = splitIntoLetters(heroTitle);
    if (chars.length !== 5) { finishIntroInstantly(); return; }
    const slots = chars.map(c => c.parentElement);
    const [T, H, O, R, N] = chars;
    const [sT, sH, sO, sR, sN] = slots;
    const naturalWidths = slots.map(s => s.getBoundingClientRect().width);

    if (nav) gsap.set(nav, { opacity: 0 });
    if (heroSub) { heroSub.style.animation = 'none'; gsap.set(heroSub, { opacity: 0, y: 10 }); }
    const ctaBtns = heroCta ? Array.from(heroCta.children) : [];
    // Hide the individual buttons, not the wrapping .hero__cta container —
    // the reveal tween below only animates ctaBtns back to opacity 1, so if
    // the container itself were left at opacity 0 the buttons would stay
    // invisible forever regardless of their own opacity.
    if (heroCta) { heroCta.style.animation = 'none'; gsap.set(ctaBtns, { opacity: 0, y: 12 }); }
    if (heroVeil) gsap.set(heroVeil, { opacity: 1 });

    gsap.set(T, { opacity: 0, filter: 'blur(16px)', scale: 1.08 });
    gsap.set([sH, sO, sR, sN], { width: 0 });
    gsap.set(H, { opacity: 0, x: 26 });
    gsap.set(O, { opacity: 0, y: 22, filter: 'blur(10px)' });
    gsap.set(R, { opacity: 0, rotate: 5, scale: 0.94, transformOrigin: '50% 100%' });
    gsap.set(N, { opacity: 0, y: 26 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        sT.classList.remove('letter--flare');
        if (skipBtn) { skipBtn.classList.remove('is-visible'); skipBtn.style.pointerEvents = 'none'; }
        startContinuousMotion();
      }
    });
    introTimeline = tl;

    if (seenBefore) {
      // Repeat visit, same tab: quick, quiet reveal instead of the
      // full first-time formation. Still no cut, no flash — just faster.
      sT.classList.add('letter--flare');
      tl.to(T, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.4 }, 0.05)
        .to([sH, sO, sR, sN], { width: (i) => naturalWidths[i + 1], duration: 0.45, stagger: 0.05 }, 0.1)
        .to([H, O, R, N], { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: 'blur(0px)', duration: 0.45, stagger: 0.05 }, 0.1)
        .to(heroVeil, { opacity: 0, duration: 0.6 }, 0.45)
        .to(nav, { opacity: 1, duration: 0.5 }, 0.45)
        .to(heroSub, { opacity: 1, y: 0, duration: 0.4 }, 0.55)
        .to(ctaBtns, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.65);
      return tl;
    }

    // Full first-visit cinematic formation (~2.8s total)
    // 1. Black hold, then T appears alone, centered, glowing softly.
    sT.classList.add('letter--flare');
    tl.to(T, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.7, ease: 'power2.out' }, 0.3);

    // 2. H, O, R, N each arrive with distinct motion. Their slots grow
    //    from 0 width, which pushes T left as the word fills in.
    tl.to(sH, { width: naturalWidths[1], duration: 0.55, ease: 'power3.out' }, 1.0)
      .to(H, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' }, 1.0)
      .to(sO, { width: naturalWidths[2], duration: 0.6, ease: 'power3.out' }, 1.15)
      .to(O, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }, 1.15)
      .to(sR, { width: naturalWidths[3], duration: 0.6, ease: 'power3.out' }, 1.32)
      .to(R, { opacity: 1, rotate: 0, scale: 1, duration: 0.65, ease: 'back.out(1.5)' }, 1.32)
      .to(sN, { width: naturalWidths[4], duration: 0.55, ease: 'power3.out' }, 1.5)
      .to(N, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 1.5);

    // 3. Tiny settle on each letter as it lands — a hint of weight.
    chars.forEach((c, i) => {
      const t = 1.55 + i * 0.05;
      tl.to(c, { scale: 1.03, duration: 0.14, ease: 'power1.out' }, t)
        .to(c, { scale: 1, duration: 0.22, ease: 'power2.inOut' }, t + 0.14);
    });

    // 4. Word complete — video emerges from black, nav/subtitle/buttons
    //    arrive together, finishing at the same moment.
    tl.to(heroVeil, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, 2.05)
      .to(nav, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 2.05)
      .to(heroSub, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 2.1)
      .to(ctaBtns, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, 2.2);

    return tl;
  }

  function runIntro() {
    if (!heroTitle) { startContinuousMotion(); return; }

    if (reduceMotion || !hasGsap) {
      finishIntroInstantly();
      return;
    }

    const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 500))]).then(() => {
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
