/* ==========================================================
   script.js — shop page logic. Same visual behavior as before
   (lightning, letter reveal, product carousels, cart drawer,
   lightbox modal) but products/wishlist now come from the real
   API (api.js) instead of localStorage, so they're shared by
   every visitor instead of being stuck in one browser.
   ========================================================== */

renderAccountBar();

/* ==========================================================
   1) SPLIT-OPEN INTRO
   ========================================================== */
window.addEventListener('load', () => {
  const intro = document.getElementById('splitIntro');
  if (intro) setTimeout(() => intro.classList.add('is-open'), 300);
});


/* ==========================================================
   1a) HERO VIDEO
   ========================================================== */
(async function setupHeroVideo() {
  try {
    const videoEl = document.querySelector('.hero__video');
    if (!videoEl) return;
    videoEl.addEventListener('error', () => { videoEl.style.display = 'none'; });

    const config = await getHeroVideo();
    if (!config || !config.dataUrl) return; // keep the placeholder source

    videoEl.querySelectorAll('source').forEach(s => s.remove());
    videoEl.src = config.dataUrl;
    videoEl.style.objectFit = config.fit || 'cover';
    videoEl.style.filter = `brightness(${(config.brightness ?? 45) / 100}) saturate(1.2)`;

    const start = config.start || 0;
    const end = config.end || null;

    videoEl.addEventListener('loadedmetadata', () => { videoEl.currentTime = start; });
    videoEl.addEventListener('timeupdate', () => {
      if (end && videoEl.currentTime >= end) {
        videoEl.currentTime = start;
        videoEl.play().catch(() => {});
      }
    });
    videoEl.load();
  } catch (e) {
    console.error('Hero video setup failed, falling back to placeholder:', e);
  }
})();


/* ==========================================================
   1b) LIGHTNING / SPARK EFFECTS
   ========================================================== */
const lightningContainer = document.getElementById('lightningContainer');

function randomBoltPath(startX, height) {
  const segments = 6 + Math.floor(Math.random() * 3);
  const step = height / segments;
  let x = startX;
  let y = 0;
  let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  for (let i = 0; i < segments; i++) {
    y += step;
    x += (Math.random() - 0.5) * 70;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function spawnBolt(opts = {}) {
  if (!lightningContainer) return;
  const rect = lightningContainer.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || window.innerHeight;
  if (!width || !height) return;

  const startX = opts.x != null ? opts.x : Math.random() * width;
  const svgNS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('bolt');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', randomBoltPath(startX, height));
  path.setAttribute('stroke', 'var(--spark)');
  path.setAttribute('stroke-width', opts.thin ? 1.4 : 2.4);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);

  if (!opts.thin && Math.random() > 0.55) {
    const branchStartY = height * (0.25 + Math.random() * 0.35);
    const branch = document.createElementNS(svgNS, 'path');
    branch.setAttribute('d', randomBoltPath(startX + (Math.random() - 0.5) * 50, height - branchStartY));
    branch.setAttribute('transform', `translate(0, ${branchStartY})`);
    branch.setAttribute('stroke', 'var(--spark-2)');
    branch.setAttribute('stroke-width', 1.2);
    branch.setAttribute('fill', 'none');
    branch.setAttribute('stroke-linecap', 'round');
    svg.appendChild(branch);
  }

  lightningContainer.appendChild(svg);
  requestAnimationFrame(() => svg.classList.add('is-flashing'));
  setTimeout(() => svg.remove(), 650);
}

function lightningBurst(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnBolt(), i * 90 + Math.random() * 70);
  }
}

let ambientBoltTimer = null;
try {
  setTimeout(() => lightningBurst(3), 550);
  const heroSection = document.querySelector('.hero');

  function scheduleAmbientBolt() {
    const delay = 1800 + Math.random() * 3200;
    ambientBoltTimer = setTimeout(() => {
      spawnBolt({ thin: Math.random() > 0.5 });
      scheduleAmbientBolt();
    }, delay);
  }

  if (heroSection && 'IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!ambientBoltTimer) scheduleAmbientBolt();
        } else {
          clearTimeout(ambientBoltTimer);
          ambientBoltTimer = null;
        }
      });
    }, { threshold: 0.2 });
    heroObserver.observe(heroSection);
  }
} catch (e) {
  console.error('Lightning effect setup failed (non-critical):', e);
}


/* ==========================================================
   2) 3D LETTER REVEAL
   ========================================================== */
const heroTitle = document.getElementById('heroTitle');
if (heroTitle) {
  try {
    const letters = Array.from(heroTitle.querySelectorAll('.letter'));
    letters.forEach((l, i) => {
      l.classList.add('letter--pending');
      l.style.transitionDelay = `${i * 0.08}s`;
      l.style.animationDelay = `${0.5 + i * 0.08}s`;
    });
    setTimeout(() => {
      letters.forEach(l => {
        l.classList.add('is-in');
        setTimeout(() => l.classList.add('letter--settled'), 1450);
      });
    }, 700);
  } catch (e) {
    console.error('Hero title animation failed — text stays visible as plain text:', e);
  }
}


/* ==========================================================
   2b) GLITCH HOVER on the nav wordmark
   ========================================================== */
const navMark = document.querySelector('.nav__mark');
if (navMark) {
  navMark.setAttribute('data-text', navMark.textContent);
  navMark.addEventListener('mouseenter', () => {
    navMark.classList.remove('glitching');
    void navMark.offsetWidth;
    navMark.classList.add('glitching');
    setTimeout(() => navMark.classList.remove('glitching'), 400);
  });
}


/* ==========================================================
   4) ADD-TO-CART SOUND
   ========================================================== */
let audioCtx = null;
function playAddSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) { /* audio not available — fail silently */ }
}


/* ==========================================================
   5) FLY-TO-CART ANIMATION
   ========================================================== */
function flyToCart(sourceImgEl) {
  const cartIcon = document.getElementById('cartCount');
  if (!sourceImgEl || !cartIcon) return;

  const startRect = sourceImgEl.getBoundingClientRect();
  const endRect = cartIcon.getBoundingClientRect();

  const clone = document.createElement('div');
  clone.className = 'flying-clone';
  if (sourceImgEl.tagName === 'IMG') {
    clone.style.backgroundImage = `url('${sourceImgEl.src}')`;
  } else {
    clone.style.background = getComputedStyle(sourceImgEl).backgroundImage;
  }
  clone.style.left = startRect.left + 'px';
  clone.style.top = startRect.top + 'px';
  clone.style.width = startRect.width + 'px';
  clone.style.height = startRect.height + 'px';
  document.body.appendChild(clone);

  const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
  const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.12) rotate(20deg)`;
    clone.style.opacity = '0.25';
  });

  setTimeout(() => {
    clone.remove();
    cartIcon.classList.add('cart-bounce');
    setTimeout(() => cartIcon.classList.remove('cart-bounce'), 420);
  }, 650);
}

function handleAddToCart(id, imgEl, qty) {
  const product = PRODUCTS.find(p => p.id === id);
  const maxQty = product ? getProductStock(product) : Infinity;
  addToCart(id, qty || 1, maxQty);
  updateCartCount();
  playAddSound();
  if (imgEl) flyToCart(imgEl);
  if (typeof showToast === 'function') showToast('Added to cart', 'success');
  renderCartDrawer();
}


/* ==========================================================
   6) RENDER PRODUCTS
   ========================================================== */
const grid = document.getElementById('productGrid');
let PRODUCTS = [];
let WISHLIST_IDS = new Set();

function productPhotoHTML(images) {
  if (!images.length) return `<div class="product-card__img product-card__img--empty"></div>`;
  return `<div class="img-skeleton"></div><img class="product-card__photo" src="${images[0]}" alt="" draggable="false" loading="lazy" decoding="async">`;
}

const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const sortSelect = document.getElementById('sortSelect');
const shopEmpty = document.getElementById('shopEmpty');

let shopState = { search: '', category: 'All', sort: 'newest' };

function getVisibleProducts() {
  const q = shopState.search.trim().toLowerCase();
  let visible = PRODUCTS.filter(p => {
    const matchesCategory = shopState.category === 'All' || p.category === shopState.category;
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
  if (shopState.sort === 'price-asc') visible.sort((a, b) => a.price - b.price);
  else if (shopState.sort === 'price-desc') visible.sort((a, b) => b.price - a.price);
  else visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return visible;
}

if (searchInput) searchInput.addEventListener('input', () => { shopState.search = searchInput.value; renderProducts(); });
if (categoryFilters) {
  categoryFilters.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    shopState.category = chip.dataset.category;
    categoryFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('is-active', c === chip));
    renderProducts();
  });
}
if (sortSelect) sortSelect.addEventListener('change', () => { shopState.sort = sortSelect.value; renderProducts(); });

function isWishlisted(id) { return WISHLIST_IDS.has(id); }

async function handleWishlistToggle(id, btn) {
  try {
    const me = await apiMe();
    if (!me.loggedIn) {
      if (typeof showToast === 'function') showToast('Log in to save items to your wishlist', 'error');
      setTimeout(() => { location.href = 'login.html?next=index.html'; }, 900);
      return;
    }
    const { inWishlist } = await apiToggleWishlist(id);
    if (inWishlist) WISHLIST_IDS.add(id); else WISHLIST_IDS.delete(id);
    document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(b => {
      b.classList.toggle('is-active', inWishlist);
      b.setAttribute('aria-pressed', String(inWishlist));
      b.innerHTML = inWishlist ? '&#9829;' : '&#9825;';
    });
    if (typeof showToast === 'function') showToast(inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Could not update wishlist right now.', 'error');
  }
}

function renderProducts() {
  const products = getVisibleProducts();
  if (shopEmpty) shopEmpty.style.display = products.length ? 'none' : '';

  grid.innerHTML = products.map(p => {
    const images = getProductImages(p);
    const hasMultiple = images.length > 1;
    const dots = hasMultiple
      ? `<div class="carousel-dots">${images.map((_, i) => `<span class="dot${i === 0 ? ' is-active' : ''}" data-i="${i}"></span>`).join('')}</div>`
      : '';
    const arrows = hasMultiple
      ? `<button type="button" class="carousel-arrow carousel-arrow--prev">&#8249;</button><button type="button" class="carousel-arrow carousel-arrow--next">&#8250;</button>`
      : '';
    const badge = p.badge ? `<span class="product-badge">${p.badge}</span>` : '';
    const stock = getProductStock(p);
    const outOfStock = stock <= 0;
    const stockNote = stock === Infinity ? '' : outOfStock
      ? `<p class="stock-note stock-note--out">Out of stock</p>`
      : stock <= 5 ? `<p class="stock-note stock-note--low">${stock} left</p>` : '';
    const wishlisted = isWishlisted(p.id);
    return `
      <div class="product-card reveal" data-id="${p.id}" data-index="0">
        ${badge}
        <button type="button" class="wishlist-btn wishlist-btn--card${wishlisted ? ' is-active' : ''}" data-id="${p.id}" aria-label="Save to wishlist" aria-pressed="${wishlisted}">${wishlisted ? '&#9829;' : '&#9825;'}</button>
        <div class="product-card__img-wrap">
          ${productPhotoHTML(images)}
          ${arrows}
          ${dots}
        </div>
        <p class="category">${p.category || 'Item'}</p>
        <h3>${p.name}</h3>
        <p class="price">${formatPrice(p.price, p.currency)}</p>
        ${stockNote}
        <button class="btn add-to-cart-btn" data-id="${p.id}"${outOfStock ? ' disabled' : ''}>${outOfStock ? 'Out of stock' : 'Add to cart'}</button>
      </div>
    `;
  }).join('');

  attachCardBehavior();
  observeReveal();
}

function observeReveal() {
  const cards = grid.querySelectorAll('.product-card.reveal');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => io.observe(c));
}

function attachCardBehavior() {
  grid.querySelectorAll('.product-card').forEach(card => {
    const id = Number(card.dataset.id);
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return;
    const images = getProductImages(product);
    const imgWrap = card.querySelector('.product-card__img-wrap');
    const photoEl = card.querySelector('.product-card__photo');

    const skeletonEl = card.querySelector('.img-skeleton');
    function hideSkeleton() { if (skeletonEl) skeletonEl.style.display = 'none'; }
    if (photoEl) {
      if (photoEl.complete) hideSkeleton();
      else photoEl.addEventListener('load', hideSkeleton, { once: true });
    }

    let current = 0;
    function showIndex(i) {
      current = (i + images.length) % images.length;
      card.dataset.index = current;
      if (photoEl) photoEl.src = images[current];
      card.querySelectorAll('.dot').forEach((d, di) => d.classList.toggle('is-active', di === current));
    }

    card.addEventListener('mouseenter', () => { if (typeof playHoverTick === 'function') playHoverTick(); });

    const prevBtn = card.querySelector('.carousel-arrow--prev');
    const nextBtn = card.querySelector('.carousel-arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(current + 1); });
    card.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', (e) => { e.stopPropagation(); showIndex(Number(dot.dataset.i)); });
    });

    if (imgWrap) imgWrap.addEventListener('click', () => openProductModal(id, current));

    const wishlistBtn = card.querySelector('.wishlist-btn');
    if (wishlistBtn) {
      wishlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleWishlistToggle(id, wishlistBtn);
      });
    }

    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });

    const addBtn = card.querySelector('.add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => handleAddToCart(id, photoEl || imgWrap));
      if (typeof makeMagnetic === 'function') makeMagnetic(addBtn, 8);
    }
  });
}


/* ==========================================================
   7) PRODUCT LIGHTBOX MODAL
   ========================================================== */
const productModal = document.getElementById('productModal');
const modalImage = document.getElementById('modalImage');
const modalDots = document.getElementById('modalDots');
const modalCategory = document.getElementById('modalCategory');
const modalName = document.getElementById('modalName');
const modalPrice = document.getElementById('modalPrice');
const modalDesc = document.getElementById('modalDesc');
const modalAddBtn = document.getElementById('modalAddBtn');
const modalClose = document.getElementById('modalClose');
const modalPrev = document.getElementById('modalPrev');
const modalNext = document.getElementById('modalNext');
const modalWishlistBtn = document.getElementById('modalWishlistBtn');
const modalStock = document.getElementById('modalStock');
const modalQtyWrap = document.getElementById('modalQtyWrap');
const modalQtyValue = document.getElementById('modalQtyValue');
const modalQtyMinus = document.getElementById('modalQtyMinus');
const modalQtyPlus = document.getElementById('modalQtyPlus');

let modalState = { id: null, images: [], index: 0, qty: 1, maxQty: Infinity };

function updateModalQtyUI() {
  modalQtyValue.textContent = modalState.qty;
  modalQtyMinus.disabled = modalState.qty <= 1;
  modalQtyPlus.disabled = modalState.qty >= modalState.maxQty;
}
if (modalQtyMinus) modalQtyMinus.addEventListener('click', () => { modalState.qty = Math.max(1, modalState.qty - 1); updateModalQtyUI(); });
if (modalQtyPlus) modalQtyPlus.addEventListener('click', () => { modalState.qty = Math.min(modalState.maxQty, modalState.qty + 1); updateModalQtyUI(); });
if (modalWishlistBtn) {
  modalWishlistBtn.addEventListener('click', async () => {
    if (!modalState.id) return;
    await handleWishlistToggle(modalState.id, modalWishlistBtn);
    const nowSaved = isWishlisted(modalState.id);
    modalWishlistBtn.classList.toggle('is-active', nowSaved);
    modalWishlistBtn.setAttribute('aria-pressed', String(nowSaved));
    modalWishlistBtn.innerHTML = nowSaved ? '&#9829;' : '&#9825;';
  });
}

function renderModalFrame() {
  const { images, index } = modalState;
  if (!images.length) return;
  modalImage.src = images[index];
  const showArrows = images.length > 1;
  modalPrev.style.display = showArrows ? '' : 'none';
  modalNext.style.display = showArrows ? '' : 'none';
  modalDots.innerHTML = showArrows
    ? images.map((_, i) => `<span class="dot${i === index ? ' is-active' : ''}" data-i="${i}"></span>`).join('')
    : '';
  modalDots.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => { modalState.index = Number(dot.dataset.i); renderModalFrame(); });
  });
}

function openProductModal(id, startIndex) {
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;
  const images = getProductImages(product);
  const stock = getProductStock(product);
  const outOfStock = stock <= 0;

  modalState = { id, images, index: startIndex || 0, qty: 1, maxQty: outOfStock ? 1 : stock };
  modalCategory.textContent = product.category || 'Item';
  modalName.textContent = product.name;
  modalDesc.textContent = product.description || '';
  modalDesc.style.display = product.description ? '' : 'none';

  modalStock.textContent = stock === Infinity ? '' : outOfStock ? 'Out of stock' : `${stock} left in stock`;
  modalStock.className = 'stock-note' + (outOfStock ? ' stock-note--out' : stock <= 5 ? ' stock-note--low' : '');

  modalQtyWrap.style.display = outOfStock ? 'none' : '';
  updateModalQtyUI();

  modalAddBtn.disabled = outOfStock;
  modalAddBtn.textContent = outOfStock ? 'Out of stock' : 'Add to cart';

  const wishlisted = isWishlisted(id);
  modalWishlistBtn.classList.toggle('is-active', wishlisted);
  modalWishlistBtn.setAttribute('aria-pressed', String(wishlisted));
  modalWishlistBtn.innerHTML = wishlisted ? '&#9829;' : '&#9825;';

  renderModalFrame();

  productModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  if (typeof animateNumberTo === 'function') animateNumberTo(modalPrice, formatPrice(product.price, product.currency), 450);
  else modalPrice.textContent = formatPrice(product.price, product.currency);

  setTimeout(() => modalClose.focus(), 50);
}

function closeProductModal() {
  productModal.classList.remove('is-open');
  document.body.style.overflow = '';
}

if (typeof trapFocus === 'function') trapFocus(productModal, () => productModal.classList.contains('is-open'));

modalClose.addEventListener('click', closeProductModal);
productModal.addEventListener('click', (e) => { if (e.target === productModal) closeProductModal(); });
modalPrev.addEventListener('click', () => {
  modalState.index = (modalState.index - 1 + modalState.images.length) % modalState.images.length;
  renderModalFrame();
});
modalNext.addEventListener('click', () => {
  modalState.index = (modalState.index + 1) % modalState.images.length;
  renderModalFrame();
});
document.addEventListener('keydown', (e) => {
  if (!productModal.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeProductModal();
  if (e.key === 'ArrowLeft') modalPrev.click();
  if (e.key === 'ArrowRight') modalNext.click();
});
modalAddBtn.addEventListener('click', () => {
  if (!modalState.id || modalAddBtn.disabled) return;
  handleAddToCart(modalState.id, modalImage, modalState.qty);
  closeProductModal();
});
if (typeof makeMagnetic === 'function') makeMagnetic(modalAddBtn, 8);


/* ==========================================================
   8) CART COUNT badge
   ========================================================== */
function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = getCartCount();
}
updateCartCount();


/* ==========================================================
   9) CART DRAWER
   ========================================================== */
const cartDrawer = document.getElementById('cartDrawer');
const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
const cartDrawerItems = document.getElementById('cartDrawerItems');
const cartDrawerTotal = document.getElementById('cartDrawerTotal');
const cartOpenBtn = document.getElementById('cartOpenBtn');
const cartDrawerClose = document.getElementById('cartDrawerClose');
const cartDrawerActions = document.getElementById('cartDrawerActions');
const cartDrawerClearBtn = document.getElementById('cartDrawerClearBtn');
const cartDrawerContinueBtn = document.getElementById('cartDrawerContinueBtn');

if (cartDrawerClearBtn) {
  cartDrawerClearBtn.addEventListener('click', () => {
    clearCart();
    updateCartCount();
    renderCartDrawer();
    if (typeof showToast === 'function') showToast('Cart cleared');
  });
}
if (cartDrawerContinueBtn) cartDrawerContinueBtn.addEventListener('click', () => closeCartDrawer());

function renderCartDrawer() {
  if (!cartDrawerItems) return;
  const cart = getCart();

  if (cart.length === 0) {
    cartDrawerItems.innerHTML = '<p style="color:var(--muted);padding:0.75rem 0;">Your cart is empty.</p>';
    cartDrawerTotal.textContent = '$0';
    if (cartDrawerActions) cartDrawerActions.style.display = 'none';
    return;
  }
  if (cartDrawerActions) cartDrawerActions.style.display = '';

  let total = 0;
  let currency = 'USD';
  cartDrawerItems.innerHTML = cart.map(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) return '';
    const lineTotal = product.price * item.qty;
    total += lineTotal;
    currency = product.currency;
    const images = getProductImages(product);
    const thumb = images[0] ? `<img src="${images[0]}" class="cart-line__thumb" alt="">` : `<span class="cart-line__thumb cart-line__thumb--empty"></span>`;
    const maxQty = getProductStock(product);
    return `
      <div class="cart-line">
        <span style="display:flex;align-items:center;gap:0.6rem;">${thumb}
          <span>
            ${product.name}<br>
            <span class="cart-line__qty">
              <button type="button" class="qty-btn qty-btn--sm cart-line__qty-minus" data-id="${item.id}" aria-label="Decrease quantity">&minus;</button>
              <span class="qty-value qty-value--sm">${item.qty}</span>
              <button type="button" class="qty-btn qty-btn--sm cart-line__qty-plus" data-id="${item.id}" aria-label="Increase quantity"${item.qty >= maxQty ? ' disabled' : ''}>+</button>
            </span>
          </span>
        </span>
        <span style="display:flex;align-items:center;gap:0.5rem;">
          ${formatPrice(lineTotal, product.currency)}
          <button class="cart-line__remove" data-id="${item.id}" aria-label="Remove">&times;</button>
        </span>
      </div>
    `;
  }).join('');
  cartDrawerTotal.textContent = formatPrice(total, currency);

  cartDrawerItems.querySelectorAll('.cart-line__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(Number(btn.dataset.id));
      updateCartCount();
      renderCartDrawer();
      if (typeof showToast === 'function') showToast('Removed from cart');
    });
  });
  cartDrawerItems.querySelectorAll('.cart-line__qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const item = getCart().find(i => i.id === id);
      if (!item) return;
      const product = PRODUCTS.find(p => p.id === id);
      setCartQty(id, item.qty - 1, product ? getProductStock(product) : Infinity);
      updateCartCount();
      renderCartDrawer();
    });
  });
  cartDrawerItems.querySelectorAll('.cart-line__qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const item = getCart().find(i => i.id === id);
      if (!item) return;
      const product = PRODUCTS.find(p => p.id === id);
      setCartQty(id, item.qty + 1, product ? getProductStock(product) : Infinity);
      updateCartCount();
      renderCartDrawer();
    });
  });
}

function openCartDrawer() {
  renderCartDrawer();
  cartDrawer.classList.add('is-open');
  cartDrawerOverlay.classList.add('is-open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => cartDrawerClose.focus(), 50);
}

function closeCartDrawer() {
  cartDrawer.classList.remove('is-open');
  cartDrawerOverlay.classList.remove('is-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

if (cartOpenBtn) cartOpenBtn.addEventListener('click', (e) => { e.preventDefault(); openCartDrawer(); });
if (cartDrawerClose) cartDrawerClose.addEventListener('click', closeCartDrawer);
if (cartDrawerOverlay) cartDrawerOverlay.addEventListener('click', closeCartDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cartDrawer && cartDrawer.classList.contains('is-open')) closeCartDrawer();
});
if (cartDrawer && typeof trapFocus === 'function') trapFocus(cartDrawer, () => cartDrawer.classList.contains('is-open'));


/* ==========================================================
   10) INITIAL LOAD — fetch products + wishlist, then render
   ========================================================== */
(async function init() {
  try {
    const [products, me] = await Promise.all([getProducts(), apiMe()]);
    PRODUCTS = products;
    if (me.loggedIn) {
      try { WISHLIST_IDS = new Set(await apiGetWishlistIds()); } catch (e) { /* ignore */ }
    }
    if (grid) renderProducts();
  } catch (e) {
    console.error('Could not load products:', e);
    if (grid) grid.innerHTML = '<p style="color:var(--muted);">Could not load products — try refreshing.</p>';
  }
})();
