/* ==========================================================
   cursor.js — a custom "mouse move" cursor effect shared by
   every page. A soft red ring trails the real cursor with
   easing (so it glides, not snaps), grows over anything
   clickable, and fades away completely over product photos
   in the shop so it never blocks the view of an item.
   ========================================================== */
(function () {
  // Skip entirely on touch devices — there's no hover cursor to enhance.
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  const ring = document.createElement('div');
  ring.className = 'custom-cursor';
  const dot = document.createElement('div');
  dot.className = 'custom-cursor__dot';
  document.body.appendChild(ring);
  document.body.appendChild(dot);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX, ringY = mouseY;
  let dotX = mouseX, dotY = mouseY;
  let shown = false;

  function show() {
    if (shown) return;
    shown = true;
    ring.classList.add('is-visible');
    dot.classList.add('is-visible');
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    show();
  });

  document.addEventListener('mouseleave', () => {
    shown = false;
    ring.classList.remove('is-visible');
    dot.classList.remove('is-visible');
  });

  // The ring eases toward the pointer (slow), the dot eases faster,
  // so the two drift apart slightly on quick movements — feels alive.
  function loop() {
    ringX += (mouseX - ringX) * 0.14;
    ringY += (mouseY - ringY) * 0.14;
    dotX += (mouseX - dotX) * 0.4;
    dotY += (mouseY - dotY) * 0.4;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    dot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  // Grow + glow harder over anything clickable
  const HOVERABLE = 'a, button, .btn, .dot, .carousel-arrow, .modal-arrow, .upload-drop, input, select, textarea';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(HOVERABLE)) ring.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(HOVERABLE)) ring.classList.remove('is-hover');
  });

  // Fade out completely across the whole shop section (not just
  // exactly on top of a card) so browsing items is never blocked.
  // mouseenter/mouseleave don't bubble, so this fires cleanly once
  // when entering/leaving the section instead of flickering between
  // child elements the way mouseover/mouseout would.
  const productsSection = document.getElementById('products');
  if (productsSection) {
    productsSection.addEventListener('mouseenter', () => {
      ring.classList.add('is-clear');
      dot.classList.add('is-clear');
    });
    productsSection.addEventListener('mouseleave', () => {
      ring.classList.remove('is-clear');
      dot.classList.remove('is-clear');
    });
  }
})();
