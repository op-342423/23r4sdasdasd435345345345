/* ==========================================================
   collections.js — renders the Collection Stories section from
   whatever rows the owner added in the admin dashboard
   (routes/collections.js / api.js#getCollectionStories). Nothing
   here is hardcoded — the section stays hidden entirely if the
   owner hasn't added any collections yet.
   ========================================================== */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  const hasScrollTrigger = hasGsap && typeof ScrollTrigger !== 'undefined';

  const section = document.getElementById('collectionStories');
  const list = document.getElementById('collectionStoriesList');
  if (!section || !list) return;

  function smoothScrollTo(target) {
    if (!target) return;
    if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
      window.__lenis.scrollTo(target, { duration: 1.4 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function block(story, i) {
    const el = document.createElement('article');
    el.className = 'collection-story' + (i % 2 === 1 ? ' collection-story--reverse' : '');

    const media = document.createElement('div');
    media.className = 'collection-story__media';
    if (story.mediaType === 'video' && story.mediaDataUrl) {
      media.innerHTML = `<video autoplay muted loop playsinline src="${story.mediaDataUrl}"></video>`;
    } else if (story.mediaDataUrl) {
      media.innerHTML = `<img src="${story.mediaDataUrl}" alt="${story.title.replace(/"/g, '')}" loading="lazy" decoding="async">`;
    }
    if (story.secondaryImageDataUrl) {
      const secondary = document.createElement('img');
      secondary.className = 'collection-story__media-secondary';
      secondary.src = story.secondaryImageDataUrl;
      secondary.alt = '';
      secondary.loading = 'lazy';
      secondary.decoding = 'async';
      media.appendChild(secondary);
    }

    const content = document.createElement('div');
    content.className = 'collection-story__content';
    content.innerHTML = `
      ${story.mood ? `<p class="collection-story__mood">${story.mood}</p>` : ''}
      <h3 class="collection-story__title">${story.title}</h3>
      ${story.story ? `<p class="collection-story__text">${story.story}</p>` : ''}
      ${story.linkUrl ? `<a href="${story.linkUrl}" class="collection-story__link">Discover the story</a>` : ''}
    `;

    el.appendChild(media);
    el.appendChild(content);

    const link = content.querySelector('.collection-story__link');
    if (link && story.linkUrl.startsWith('#')) {
      link.addEventListener('click', (e) => {
        const dest = document.querySelector(story.linkUrl);
        if (dest) { e.preventDefault(); smoothScrollTo(dest); }
      });
    }
    return el;
  }

  function setupReveal(el) {
    if (reduceMotion) { el.classList.add('is-in-view'); return; }
    if (hasScrollTrigger) {
      ScrollTrigger.create({
        trigger: el, start: 'top 80%', once: true,
        onEnter: () => el.classList.add('is-in-view')
      });
    } else if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { el.classList.add('is-in-view'); io.disconnect(); }
        });
      }, { threshold: 0.2 });
      io.observe(el);
    } else {
      el.classList.add('is-in-view');
    }
  }

  async function init() {
    let stories;
    try {
      stories = await getCollectionStories();
    } catch (e) {
      console.error('Collection Stories: could not load (non-critical):', e);
      return;
    }
    if (!stories || !stories.length) return;

    stories.forEach((story, i) => {
      const el = block(story, i);
      list.appendChild(el);
      setupReveal(el);
    });

    section.hidden = false;
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
})();
