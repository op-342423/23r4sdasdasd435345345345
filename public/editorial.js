/* ==========================================================
   editorial.js — renders the Editorial section from whatever
   rows the owner added in the admin dashboard (routes/editorial.js
   / api.js#getEditorialItems). Pure storytelling: photography,
   runway/BTS media, and quotes — deliberately never a price.
   Stays hidden entirely if the owner hasn't added anything yet.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  const hasScrollTrigger = hasGsap && typeof ScrollTrigger !== 'undefined';

  const section = document.getElementById('editorial');
  const grid = document.getElementById('editorialGrid');
  if (!section || !grid) return;

  function tile(item) {
    const el = document.createElement('div');
    el.className = 'editorial-tile' + (item.size === 'large' ? ' editorial-tile--large' : '') +
      (item.kind === 'quote' ? ' editorial-tile--quote' : '');

    if (item.kind === 'quote') {
      el.innerHTML = `
        <blockquote class="editorial-tile__quote">&ldquo;${item.quoteText}&rdquo;</blockquote>
        ${item.quoteAuthor ? `<span class="editorial-tile__author">${item.quoteAuthor}</span>` : ''}
      `;
    } else if (item.kind === 'video') {
      el.innerHTML = `
        <video class="editorial-tile__media" autoplay muted loop playsinline src="${item.mediaDataUrl}"></video>
        ${item.caption ? `<span class="editorial-tile__caption">${item.caption}</span>` : ''}
      `;
    } else {
      el.innerHTML = `
        <img class="editorial-tile__media" loading="lazy" decoding="async" src="${item.mediaDataUrl}" alt="${(item.caption || `${window.__brandName || 'THORN'} editorial`).replace(/"/g, '')}">
        ${item.caption ? `<span class="editorial-tile__caption">${item.caption}</span>` : ''}
      `;
    }
    return el;
  }

  function setupReveal() {
    const tiles = Array.from(grid.children);
    if (reduceMotion) { tiles.forEach(t => t.classList.add('is-in-view')); return; }

    if (hasScrollTrigger) {
      tiles.forEach((t, i) => {
        ScrollTrigger.create({
          trigger: t, start: 'top 88%', once: true,
          onEnter: () => setTimeout(() => t.classList.add('is-in-view'), (i % 3) * 90)
        });
      });
    } else if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('is-in-view'); io.unobserve(entry.target); }
        });
      }, { threshold: 0.15 });
      tiles.forEach(t => io.observe(t));
    } else {
      tiles.forEach(t => t.classList.add('is-in-view'));
    }
  }

  async function init() {
    let items;
    try {
      items = await getEditorialItems();
    } catch (e) {
      console.error('Editorial: could not load (non-critical):', e);
      return;
    }
    if (!items || !items.length) return;

    items.forEach(item => grid.appendChild(tile(item)));
    section.hidden = false;
    setupReveal();
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
})();
