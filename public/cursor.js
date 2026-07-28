/* ==========================================================
   cursor.js — custom cursor: a soft ring that eases toward the
   pointer plus a small dot that tracks it exactly. Grows over
   links/buttons, hides completely over product photos (their
   own zoom/carousel affordances are enough) and on touch devices.
   ========================================================== */
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  const ring = document.createElement('div');
  ring.className = 'custom-cursor';
  const dot = document.createElement('div');
  dot.className = 'custom-cursor__dot';
  document.body.appendChild(ring);
  document.body.appendChild(dot);

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let started = false;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX - 2.5}px, ${mouseY - 2.5}px)`;
    if (!started) {
      started = true;
      ringX = mouseX;
      ringY = mouseY;
      ring.classList.add('is-visible');
      dot.classList.add('is-visible');
    }
  });

  window.addEventListener('mouseleave', () => {
    ring.classList.remove('is-visible');
    dot.classList.remove('is-visible');
    started = false;
  });

  function tick() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX - 17}px, ${ringY - 17}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const hoverSelector = 'a, button, .filter-chip, .qty-btn, input, select, .product-card, .wishlist-btn';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest && e.target.closest(hoverSelector)) ring.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest && e.target.closest(hoverSelector)) ring.classList.remove('is-hover');
  });

  const clearZones = document.querySelectorAll('.product-card__img-wrap, .modal-gallery');
  clearZones.forEach((zone) => {
    zone.addEventListener('mouseenter', () => {
      ring.classList.add('is-clear');
      dot.classList.add('is-clear');
    });
    zone.addEventListener('mouseleave', () => {
      ring.classList.remove('is-clear');
      dot.classList.remove('is-clear');
    });
  });
})();
