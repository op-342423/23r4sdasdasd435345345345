/* ==========================================================
   luxury.js — cinematic entry, continuous ambient motion, breathing
   glow, and mouse parallax for the site.

   ENTRY SEQUENCE (letter-by-letter formation):
   Screen is black (the hero video sits behind an opaque veil). The
   first letter appears alone, centered, softly glowing. Then every
   letter after it arrives one by one, each with its own distinct
   motion (cycling through: slide-in from the right, fade-up through
   blur, rotate-in with a small bounce, slide-up) — and because each
   hidden letter reserves zero width until it arrives, the word
   visually recentres itself as it fills in, with no separate tween
   needed. Once the word is fully formed, a single quick light shimmer
   sweeps across it, then the black veil dissolves so the hero video
   emerges from darkness while nav / subtitle / buttons arrive right
   after — one continuous handoff, no cut.

   This works for a brand name of ANY length (not just exactly 5
   letters): letters beyond the first four simply keep cycling through
   the same four motion variants, and the per-letter stagger timing
   scales to the letter count so the whole sequence still lands at
   roughly the same ~2.8s total.

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


  /* ---------- SPLIT THE BRAND WORD INTO ANIMATABLE LETTERS ----------
     Prefers SplitType. Each character ends up wrapped twice: an outer
     .letter "slot" (overflow-hidden, whose width we can animate from
     0 → natural so it reserves no space until it arrives) around an
     inner .letter__inner (the thing that actually fades/slides/rotates/
     blurs in). Falls back to a manual split if SplitType isn't
     available, so the effect never depends on a third-party CDN being
     reachable. Works for any word length, not just 5 characters. */
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

  /* Four distinct per-letter entrance variants, cycled through for
     however many letters come after the first one. Each returns the
     "from" state (what buildIntro should gsap.set the letter to
     before animating it in) and the "to" state/ease used for the
     reveal tween — kept data-driven so adding a 6th, 10th, 20th
     letter just keeps repeating the same four looks instead of
     needing special-casing. */
  const LETTER_VARIANTS = [
    { // slide in from the right (was H)
      from: { opacity: 0, x: 26 },
      to: { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' }
    },
    { // fade upward through blur (was O)
      from: { opacity: 0, y: 22, filter: 'blur(10px)' },
      to: { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }
    },
    { // rotate in with a small bounce (was R)
      from: { opacity: 0, rotate: 5, scale: 0.94, transformOrigin: '50% 100%' },
      to: { opacity: 1, rotate: 0, scale: 1, duration: 0.65, ease: 'back.out(1.5)' }
    },
    { // slide up (was N)
      from: { opacity: 0, y: 26 },
      to: { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }
    }
  ];


  /* ---------- UNCLIPPED GLOW (drop-shadow on #heroTitle) ----------
     Bug fix: a text-shadow/box-shadow placed on a letter (or its
     inner span) gets clipped to a hard edge by the .letter slot's
     overflow:hidden, which is required for the width-grow animation.
     Fix: drive the glow as a filter: drop-shadow(...) on the OUTER
     #heroTitle element instead — it hugs whatever letters are
     currently visible and is never clipped by a child's overflow.
     Used both for the intro's glow-bloom-then-letter-resolves beat
     and for the ongoing ambient "breathing" once the intro is done. */
  function setGlow(el, blur1, alpha1, blur2, alpha2) {
    el.style.filter =
      `drop-shadow(0 0 ${blur1}px rgba(255,255,255,${alpha1})) ` +
      `drop-shadow(0 0 ${blur2}px rgba(255,255,255,${alpha2}))`;
  }

  function startGlowBreathing(el, startFrom) {
    if (reduceMotion || !hasGsap || !el) return;
    const BASE = { blur1: 10, alpha1: 0.10, blur2: 26, alpha2: 0.06 };
    const BRIGHT = { blur1: 16, alpha1: 0.22, blur2: 40, alpha2: 0.12 };
    const glow = startFrom ? Object.assign({}, startFrom) : Object.assign({}, BASE);
    const apply = () => setGlow(el, glow.blur1, glow.alpha1, glow.blur2, glow.alpha2);
    const tl = gsap.timeline();
    if (startFrom) {
      // Ease down from wherever the intro's glow-bloom left off (bright)
      // into the quieter ambient range, instead of snapping straight to
      // the loop's baseline — keeps the handoff feeling continuous.
      tl.to(glow, Object.assign({}, BASE, { duration: 1.1, ease: 'power2.inOut', onUpdate: apply }));
    }
    tl.to(glow, Object.assign({}, BRIGHT, { duration: 5, ease: 'sine.inOut', repeat: -1, yoyo: true, onUpdate: apply }));
  }


  /* ---------- ENTRY EXPERIENCE ---------- */
  function finishIntroInstantly() {
    if (heroVeil) heroVeil.style.display = 'none';
    if (nav) nav.style.opacity = '1';
    if (heroTitle) {
      heroTitle.style.opacity = '1';
      heroTitle.style.filter = ''; // fall back to the CSS static glow (unclipped, no-JS safe)
      heroTitle.querySelectorAll('.letter, .letter__inner').forEach(l => { l.style.width = ''; l.style.opacity = '1'; l.style.transform = 'none'; l.style.filter = 'none'; });
    }
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
    // Once split, this element no longer holds a single plain text
    // node — brand.js must never overwrite its textContent again
    // (that would destroy the letter spans mid- or post-animation),
    // so we drop the attribute it watches for.
    heroTitle.removeAttribute('data-brand');

    if (!chars.length) { finishIntroInstantly(); return; }

    const slots = chars.map(c => c.parentElement);
    const first = chars[0];
    const restChars = chars.slice(1);
    const restSlots = slots.slice(1);
    const naturalWidths = slots.map(s => s.getBoundingClientRect().width);

    if (nav) gsap.set(nav, { opacity: 0 });
    if (heroSub) { heroSub.style.animation = 'none'; gsap.set(heroSub, { opacity: 0, y: 10 }); }
    // NOTE: the wrapper itself must stay at opacity 1 — only the buttons
    // inside it start hidden. A parent stuck at opacity 0 keeps its
    // children invisible forever, even after the children are tweened
    // back to opacity 1 individually. This was the root cause of the
    // "Learn more / View collection" buttons never appearing.
    const ctaBtns = heroCta ? Array.from(heroCta.children) : [];
    if (heroCta) { heroCta.style.animation = 'none'; gsap.set(heroCta, { opacity: 1 }); gsap.set(ctaBtns, { opacity: 0, y: 12 }); }
    if (heroVeil) gsap.set(heroVeil, { opacity: 1 });

    gsap.set(first, { opacity: 0, filter: 'blur(16px)', scale: 1.08 });
    gsap.set(restSlots, { width: 0 });
    restChars.forEach((c, i) => gsap.set(c, LETTER_VARIANTS[i % LETTER_VARIANTS.length].from));
    setGlow(heroTitle, 0, 0, 0, 0); // fully dark — the glow bloom below lights it from nothing

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        if (skipBtn) { skipBtn.classList.remove('is-visible'); skipBtn.style.pointerEvents = 'none'; }
        startContinuousMotion(STEADY);
      }
    });
    introTimeline = tl;

    // Per-letter stagger scales down as the word gets longer, so a
    // long brand name still finishes forming inside roughly the same
    // total budget instead of dragging the intro out indefinitely.
    // Clamped so short names keep their original, more deliberate pace.
    const letterStagger = Math.max(0.09, Math.min(0.17, 1.1 / Math.max(restChars.length, 1)));
    const letterDuration = Math.max(0.4, Math.min(0.6, letterStagger * 3.4));

    // Steady glow values the first letter settles into once formed —
    // matches what used to be a static text-shadow, now reached via
    // a gentle bloom instead of appearing at full brightness instantly.
    const STEADY = { blur1: 18, alpha1: 0.55, blur2: 46, alpha2: 0.28 };

    if (seenBefore) {
      // Repeat visit, same tab: quick, quiet reveal instead of the
      // full first-time formation. Still no cut, no flash — just faster,
      // with a brief version of the same glow-then-letter beat.
      const glow = { blur1: 0, alpha1: 0, blur2: 0, alpha2: 0 };
      const quickStagger = letterStagger * 0.75;
      tl.to(glow, {
          blur1: STEADY.blur1, alpha1: STEADY.alpha1, blur2: STEADY.blur2, alpha2: STEADY.alpha2,
          duration: 0.3, ease: 'power2.out',
          onUpdate: () => setGlow(heroTitle, glow.blur1, glow.alpha1, glow.blur2, glow.alpha2)
        }, 0.15)
        .to(first, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.35 }, 0.2)
        .to(restSlots, { width: (i) => naturalWidths[i + 1], duration: 0.4, stagger: quickStagger }, 0.45)
        .to(restChars, {
          opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: 'blur(0px)',
          duration: 0.4, stagger: quickStagger
        }, 0.45)
        .add(shimmerTween(heroTitle, 0.45), '+=0.05')
        .to(heroVeil, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.15')
        .to(nav, { opacity: 1, duration: 0.5, ease: 'power1.out' }, '<')
        .to(heroSub, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, '-=0.35')
        .to(ctaBtns, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }, '-=0.25');
      return tl;
    }

    // Full first-visit cinematic formation (~2.9s total).
    // 1. A confident black hold — slightly longer than before, so the
    //    letter's arrival feels intentional rather than immediate.
    const HOLD = 0.45;

    // 2. The glow blooms in gently BEFORE the letter is sharp: a soft
    //    pulse of light gathers (dim), overshoots a touch brighter,
    //    then settles — the letter resolves out of that glow rather
    //    than snapping in at the same instant. The double-pulse easing
    //    is what keeps it from reading as a mechanical linear fade.
    const glow = { blur1: 0, alpha1: 0, blur2: 0, alpha2: 0 };
    function glowTo(vals, duration, ease) {
      return { ...vals, duration, ease, onUpdate: () => setGlow(heroTitle, glow.blur1, glow.alpha1, glow.blur2, glow.alpha2) };
    }
    tl.to(glow, glowTo({ blur1: 12, alpha1: 0.18, blur2: 30, alpha2: 0.10 }, 0.15, 'power1.out'), HOLD)
      .to(glow, glowTo({ blur1: 22, alpha1: 0.62, blur2: 50, alpha2: 0.32 }, 0.20, 'power2.out'), HOLD + 0.15)
      .to(glow, glowTo(STEADY, 0.22, 'power2.inOut'), HOLD + 0.35);

    // 3. The letter itself resolves shortly after the glow starts
    //    gathering (not at the same moment), so it reads as "lit into
    //    existence" rather than the letter and glow popping in together.
    tl.to(first, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.62, ease: 'power2.out' }, HOLD + 0.13);
    const firstLetterSettledAt = HOLD + 0.13 + 0.62; // ≈ 1.20

    // 4. Every following letter arrives with its own distinct motion,
    //    cycling through the four variants. Their slots grow from 0
    //    width, which pushes the earlier letters to recentre as the
    //    word fills in — same visual effect as before, generalised.
    //    They begin just before the first letter is fully settled, so
    //    the handoff overlaps rather than pausing.
    let t = firstLetterSettledAt - 0.15;
    const letterStartTimes = [firstLetterSettledAt];
    restChars.forEach((c, i) => {
      const slot = restSlots[i];
      const variant = LETTER_VARIANTS[i % LETTER_VARIANTS.length];
      tl.to(slot, { width: naturalWidths[i + 1], duration: letterDuration, ease: 'power3.out' }, t)
        .to(c, Object.assign({}, variant.to), t);
      letterStartTimes.push(t);
      t += letterStagger;
    });
    const formationEnd = t + letterDuration * 0.55;

    // 5. Tiny settle on each letter as it lands — a hint of weight.
    chars.forEach((c, i) => {
      const st = letterStartTimes[i] + letterDuration * 0.7;
      tl.to(c, { scale: 1.03, duration: 0.14, ease: 'power1.out' }, st)
        .to(c, { scale: 1, duration: 0.22, ease: 'power2.inOut' }, st + 0.14);
    });

    // 6. Word complete — a single, subtle light shimmer sweeps across
    //    it once, immediately followed by the veil dissolving so the
    //    video emerges from black while nav/subtitle/buttons arrive.
    //    Eased and overlapped (rather than a hard cut to the next
    //    beat) so the whole thing reads as one continuous motion.
    const handoff = formationEnd + 0.1;
    tl.add(shimmerTween(heroTitle, 0.7), handoff)
      .to(heroVeil, { opacity: 0, duration: 1.05, ease: 'power2.inOut' }, handoff + 0.15)
      .to(nav, { opacity: 1, duration: 0.85, ease: 'power1.out' }, handoff + 0.15)
      .to(heroSub, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, handoff + 0.35)
      .to(ctaBtns, { opacity: 1, y: 0, duration: 0.55, stagger: 0.1, ease: 'power2.out' }, handoff + 0.55);

    return tl;
  }


  /* One-time light shimmer across the fully-formed word — a soft
     diagonal highlight sweeping left to right, driven by the
     ::after gradient defined in styles.css. Purely a polish beat;
     harmless no-op if the element/gradient somehow isn't present. */
  function shimmerTween(el, duration) {
    const shimmer = gsap.timeline();
    shimmer.set(el, { '--shimmer-x': '-30%', '--shimmer-o': 0 })
      .to(el, { '--shimmer-o': 1, duration: duration * 0.25, ease: 'power1.out' }, 0)
      .to(el, { '--shimmer-x': '130%', duration: duration, ease: 'power2.inOut' }, 0)
      .to(el, { '--shimmer-o': 0, duration: duration * 0.3, ease: 'power1.in' }, duration * 0.7);
    return shimmer;
  }

  function runIntro() {
    if (!heroTitle) { startContinuousMotion(); return; }

    if (reduceMotion || !hasGsap) {
      finishIntroInstantly();
      return;
    }

    const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    // Wait for both the fonts AND the real brand name (Part 8) before
    // splitting into letters, so we split the final wordmark text —
    // not a stale default that then needs replacing mid-animation.
    // The safety timeout is comfortably longer than brand.js's own
    // 900ms fetch cap, so in practice brandReady always wins this
    // race and the intro never has to fall back to the shipped
    // "THORN" default.
    const brandReady = window.__brandReady || Promise.resolve();
    Promise.race([
      Promise.all([fontsReady, brandReady]),
      new Promise(r => setTimeout(r, 1400))
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

  // Runs as soon as this script executes. It's loaded at the end of
  // <body> with no defer/async, so by the time it runs the DOM is
  // already parsed and #heroTitle exists — there's no need to wait
  // for the full window 'load' event (which only fires once every
  // image AND the hero video have finished downloading). Waiting for
  // that was the bug: on a slow connection the video alone could take
  // several seconds, during which the page just showed a black,
  // seemingly-frozen screen before the wordmark animation ever
  // started. runIntro()'s own fonts/brand-name wait (capped above)
  // is the only gate now, so the animation starts almost immediately
  // regardless of how long the video takes to load in the background.
  runIntro();


  /* ---------- CONTINUOUS AMBIENT MOTION ---------- */
  function startContinuousMotion(glowStartFrom) {
    if (reduceMotion || !hasGsap) return;

    startGlowBreathing(heroTitle, glowStartFrom);

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
