/* ==========================================================
   luxury.js — cinematic entry, continuous ambient motion, breathing
   glow, and mouse parallax for THORN.

   Everything in here is additive on top of the resting CSS state:
   if GSAP/Lenis fail to load, or the person has prefers-reduced-motion
   set, the page still looks correct — it just skips the choreography
   and shows the final state immediately. Nothing here blocks
   script.js (cart, products, modals), which runs independently.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';

  const intro = document.getElementById('splitIntro');
  const introLight = document.getElementById('splitIntroLight');
  const panelLeft = document.querySelector('.split-intro__panel--left');
  const panelRight = document.querySelector('.split-intro__panel--right');
  const nav = document.querySelector('.nav');
  const heroTitle = document.getElementById('heroTitle');
  const heroSub = document.querySelector('.hero__sub');
  const heroCta = document.querySelector('.hero__cta');
  const heroVideo = document.getElementById('heroVideo');


  /* ---------- LENIS SMOOTH SCROLL ---------- */
  (function setupLenis() {
    if (reduceMotion || typeof Lenis === 'undefined') return;
    try {
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
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
  function runIntro() {
    if (!intro) return;

    // Reduced motion (or no GSAP): skip straight to the finished state.
    if (reduceMotion || !hasGsap) {
      intro.style.display = 'none';
      if (nav) nav.style.opacity = '1';
      if (heroTitle) { heroTitle.style.opacity = '1'; heroTitle.style.filter = 'none'; heroTitle.style.transform = 'none'; }
      startContinuousMotion();
      return;
    }

    if (nav) gsap.set(nav, { opacity: 0 });
    if (heroTitle) gsap.set(heroTitle, { opacity: 0, filter: 'blur(30px)', y: 40, scale: 0.97, letterSpacing: '0.6em' });
    if (heroSub) { heroSub.style.animation = 'none'; gsap.set(heroSub, { opacity: 0, y: 10 }); }
    if (heroCta) { heroCta.style.animation = 'none'; gsap.set(heroCta, { opacity: 0, y: 12 }); }
    const ctaBtns = heroCta ? Array.from(heroCta.children) : [];

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        if (intro) intro.remove();
        startContinuousMotion();
      }
    });

    // 1–4: black screen holds, then a hairline of light grows in the center
    tl.set(introLight, { opacity: 1 })
      .to(introLight, { scaleY: 1, duration: 0.4, ease: 'power1.inOut' }, 0.1)
      // 5: the boutique doors part, 6–7: hero video is already live underneath
      .to([panelLeft, panelRight], { duration: 0, onStart: () => intro.classList.add('is-open') }, 0.45)
      .to(introLight, { opacity: 0, duration: 0.3 }, 0.45)
      // 8: nav fades in as the doors clear
      .to(nav, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.7)
      // 9: THORN animates last — opacity, blur, letter-spacing, translateY, scale
      .to(heroTitle, {
        opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, letterSpacing: '0.04em',
        duration: 1.3, ease: 'power4.out'
      }, 0.75)
      // 10: buttons stagger in
      .to(heroSub, { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' }, 1.75)
      .to(ctaBtns, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'power1.out' }, 1.9);
  }

  if (document.readyState === 'complete') runIntro();
  else window.addEventListener('load', runIntro, { once: true });


  /* ---------- CONTINUOUS AMBIENT MOTION ---------- */
  function startContinuousMotion() {
    if (reduceMotion || !hasGsap) return;

    // Title: almost-imperceptible drift + scale breathing, every ~10s
    if (heroTitle) {
      gsap.to(heroTitle, {
        x: '+=2.5', duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true
      });
      gsap.to(heroTitle, {
        scale: 1.01, duration: 8.5, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.4
      });
    }

    // Background video: forever-slow zoom, alternating direction.
    // Handled with GSAP instead of the CSS fallback animation once
    // GSAP is confirmed available, for smoother easing control.
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
