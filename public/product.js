/* ==========================================================
   product.js — Part 3 (this batch) of the brief: Product Details
   page. Reuses the existing products table/API and cart/wishlist
   helpers from api.js — no parallel systems.
   ========================================================== */
renderAccountBar();

function updateCartCountIfPresent() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = getCartCount();
}
updateCartCountIfPresent();

const params = new URLSearchParams(location.search);
const productId = parseInt(params.get('id'), 10);

const pdpRoot = document.getElementById('pdpRoot');
const notFoundEl = document.getElementById('pdpNotFound');
const breadcrumbEl = document.getElementById('pdpBreadcrumb');
const reviewsSection = document.getElementById('pdpReviewsSection');
const relatedSection = document.getElementById('relatedSection');
const relatedGrid = document.getElementById('relatedGrid');

let WISHLIST_IDS = new Set();
let PRODUCT = null;
let GALLERY_IMAGES = [];
let galleryIndex = 0;
let qty = 1;

// ---------------- Wishlist (same pattern as script.js) ----------------
function isWishlisted(id) { return WISHLIST_IDS.has(id); }

async function handleWishlistToggle(id, btn) {
  try {
    const me = await apiMe();
    if (!me.loggedIn) {
      showToast('Log in to save items to your wishlist', 'error');
      setTimeout(() => { location.href = `login.html?next=product.html?id=${id}`; }, 900);
      return;
    }
    const { inWishlist } = await apiToggleWishlist(id);
    if (inWishlist) WISHLIST_IDS.add(id); else WISHLIST_IDS.delete(id);
    document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(b => {
      b.classList.toggle('is-active', inWishlist);
      b.setAttribute('aria-pressed', String(inWishlist));
      b.innerHTML = inWishlist ? '&#9829;' : '&#9825;';
    });
    showToast(inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');
  } catch (e) {
    showToast('Could not update wishlist right now.', 'error');
  }
}

// ---------------- Gallery: thumbnails + hover zoom (desktop) + swipe (mobile) ----------------
const mainFrame = document.getElementById('pdpMainFrame');
const mainImage = document.getElementById('pdpMainImage');
const skeletonEl = document.getElementById('pdpSkeleton');
const thumbsEl = document.getElementById('pdpThumbs');
const prevBtn = document.getElementById('pdpPrev');
const nextBtn = document.getElementById('pdpNext');

function showGalleryImage(i) {
  if (!GALLERY_IMAGES.length) return;
  galleryIndex = (i + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
  if (skeletonEl) skeletonEl.style.display = '';
  mainImage.src = GALLERY_IMAGES[galleryIndex];
  mainImage.onload = () => { if (skeletonEl) skeletonEl.style.display = 'none'; };
  thumbsEl.querySelectorAll('.pdp__thumb').forEach((t, idx) => t.classList.toggle('is-active', idx === galleryIndex));
}

function renderGallery(images) {
  GALLERY_IMAGES = images.length ? images : [];
  galleryIndex = 0;
  if (!GALLERY_IMAGES.length) {
    mainImage.removeAttribute('src');
    if (skeletonEl) skeletonEl.style.display = 'none';
    thumbsEl.innerHTML = '';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    return;
  }
  showGalleryImage(0);
  thumbsEl.innerHTML = GALLERY_IMAGES.map((src, i) => `
    <button type="button" class="pdp__thumb${i === 0 ? ' is-active' : ''}" data-index="${i}">
      <img src="${src}" alt="" loading="lazy">
    </button>
  `).join('');
  thumbsEl.querySelectorAll('.pdp__thumb').forEach(t => {
    t.addEventListener('click', () => showGalleryImage(Number(t.dataset.index)));
  });
  const multi = GALLERY_IMAGES.length > 1;
  prevBtn.style.display = multi ? '' : 'none';
  nextBtn.style.display = multi ? '' : 'none';
}

prevBtn.addEventListener('click', () => showGalleryImage(galleryIndex - 1));
nextBtn.addEventListener('click', () => showGalleryImage(galleryIndex + 1));

// Hover-to-magnify (desktop). Cursor position within the frame maps
// to the image's transform-origin, and CSS scales it up via
// .is-zoomed — see the .pdp__main-frame rules in styles.css.
mainFrame.addEventListener('mousemove', (e) => {
  if (!GALLERY_IMAGES.length) return;
  const rect = mainFrame.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  mainFrame.style.setProperty('--zx', `${x}%`);
  mainFrame.style.setProperty('--zy', `${y}%`);
  mainFrame.classList.add('is-zoomed');
});
mainFrame.addEventListener('mouseleave', () => mainFrame.classList.remove('is-zoomed'));

// Swipe (mobile) — mirrors the same gesture used on product cards.
let touchStartX = null;
mainFrame.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
mainFrame.addEventListener('touchend', (e) => {
  if (touchStartX === null || GALLERY_IMAGES.length < 2) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(dx) < 30) return;
  showGalleryImage(dx < 0 ? galleryIndex + 1 : galleryIndex - 1);
}, { passive: true });

// ---------------- Quantity ----------------
const qtyValueEl = document.getElementById('pdpQtyValue');
const qtyMinusBtn = document.getElementById('pdpQtyMinus');
const qtyPlusBtn = document.getElementById('pdpQtyPlus');

function updateQtyUI(maxQty) {
  qtyValueEl.textContent = qty;
  qtyMinusBtn.disabled = qty <= 1;
  qtyPlusBtn.disabled = qty >= maxQty;
}
qtyMinusBtn.addEventListener('click', () => { qty = Math.max(1, qty - 1); updateQtyUI(getProductStock(PRODUCT)); });
qtyPlusBtn.addEventListener('click', () => { qty = Math.min(getProductStock(PRODUCT), qty + 1); updateQtyUI(getProductStock(PRODUCT)); });

// ---------------- Specs list ----------------
function renderSpecs(p) {
  const rows = [
    ['Material', p.material],
    ['Size', p.size],
    ['Weight', p.weight],
    ['Warranty', p.warranty],
  ].filter(([, v]) => v);
  const specsEl = document.getElementById('pdpSpecs');
  specsEl.innerHTML = rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
}

// ---------------- Rating summary ----------------
function starsHTML(average) {
  const rounded = Math.round(average);
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= rounded ? '&#9733;' : '<span class="stars--empty">&#9733;</span>';
  return out;
}

// ---------------- Reviews ----------------
async function loadReviews(id) {
  const listEl = document.getElementById('pdpReviewsList');
  const summaryEl = document.getElementById('pdpRatingSummary');
  try {
    const { reviews, average, count } = await getReviews(id);
    if (count) {
      summaryEl.innerHTML = `<span class="stars">${starsHTML(average)}</span><a href="#pdpReviewsSection" class="pdp__rating-count">${average.toFixed(1)} (${count} review${count === 1 ? '' : 's'})</a>`;
    } else {
      summaryEl.innerHTML = `<a href="#pdpReviewsSection" class="pdp__rating-count">No reviews yet — be the first</a>`;
    }
    listEl.innerHTML = reviews.length
      ? reviews.map(r => `
          <div class="review-card">
            <div class="review-card__head">
              <span class="review-card__name">${r.name}</span>
              <span class="stars">${starsHTML(r.rating)}</span>
            </div>
            ${r.comment ? `<p class="review-card__comment">${r.comment}</p>` : ''}
          </div>
        `).join('')
      : '<p class="reviews-empty">No reviews yet — be the first to share your thoughts.</p>';
  } catch (e) {
    summaryEl.innerHTML = '';
    listEl.innerHTML = '<p class="reviews-empty">Reviews couldn\'t be loaded right now.</p>';
  }
}

let selectedStars = 0;
const starsInputEl = document.getElementById('reviewStarsInput');
starsInputEl.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedStars = Number(btn.dataset.star);
    starsInputEl.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', Number(b.dataset.star) <= selectedStars));
  });
});

document.getElementById('submitReviewBtn').addEventListener('click', async () => {
  const name = document.getElementById('reviewName').value.trim();
  const comment = document.getElementById('reviewComment').value.trim();
  if (!selectedStars) return showToast('Please choose a star rating', 'error');
  if (!name) return showToast('Please add your name', 'error');
  try {
    await addReview({ productId, name, rating: selectedStars, comment });
    showToast('Thanks! Your review will appear once it\'s checked.');
    document.getElementById('reviewName').value = '';
    document.getElementById('reviewComment').value = '';
    selectedStars = 0;
    starsInputEl.querySelectorAll('button').forEach(b => b.classList.remove('is-on'));
  } catch (e) {
    showToast(e.message || 'Could not submit your review.', 'error');
  }
});

// ---------------- Related products ("You may also like") ----------------
function relatedCardHTML(p) {
  const images = getProductImages(p);
  const photo = images[0]
    ? `<img class="product-card__photo" src="${images[0]}" alt="" loading="lazy">`
    : `<div class="product-card__img product-card__img--empty"></div>`;
  const note = getStockNote(p);
  const stockNote = note ? `<p class="stock-note ${note.cls}">${note.text}</p>` : '';
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-card__img-wrap">${photo}</div>
      <p class="category">${p.category || 'Item'}</p>
      <h3><a href="product.html?id=${p.id}" class="product-card__title-link">${p.name}</a></h3>
      <p class="price">${formatPrice(p.price, p.currency)}</p>
      ${stockNote}
    </div>
  `;
}

async function loadRelated(p) {
  try {
    const all = await getProducts();
    const related = all.filter(x => x.id !== p.id && x.category === p.category).slice(0, 8);
    if (!related.length) return;
    relatedGrid.innerHTML = related.map(relatedCardHTML).join('');
    relatedSection.hidden = false;
  } catch (e) { /* related products are a bonus, not critical — fail quietly */ }
}

// ---------------- Main render ----------------
async function init() {
  if (!productId) { showNotFound(); return; }
  try {
    PRODUCT = await getProduct(productId);
  } catch (e) {
    showNotFound();
    return;
  }

  try { WISHLIST_IDS = new Set(await apiGetWishlistIds()); } catch (e) { /* logged out — fine */ }

  const p = PRODUCT;
  document.title = `THORN — ${p.name}`;
  breadcrumbEl.innerHTML = `<a href="index.html">Shop</a> / <a href="index.html">${p.category || 'Item'}</a> / ${p.name}`;

  document.getElementById('pdpCategory').textContent = p.category || 'Item';
  document.getElementById('pdpName').textContent = p.name;
  document.getElementById('pdpPrice').textContent = formatPrice(p.price, p.currency);
  document.getElementById('pdpSku').textContent = p.sku ? `SKU: ${p.sku}` : '';
  document.getElementById('pdpDesc').textContent = p.description || '';
  document.getElementById('pdpDeliveryInfo').textContent = p.deliveryInfo || '';

  const stock = getProductStock(p);
  const outOfStock = stock <= 0;
  const note = getStockNote(p);
  const stockEl = document.getElementById('pdpStock');
  stockEl.textContent = note ? note.text : '';
  stockEl.className = 'stock-note' + (note ? ' ' + note.cls : '');

  renderGallery(getProductImages(p));
  renderSpecs(p);

  qty = 1;
  updateQtyUI(stock);
  document.getElementById('pdpQtyWrap').style.display = outOfStock ? 'none' : '';

  const addBtn = document.getElementById('pdpAddBtn');
  const buyNowBtn = document.getElementById('pdpBuyNowBtn');
  addBtn.disabled = outOfStock;
  buyNowBtn.disabled = outOfStock;
  addBtn.textContent = outOfStock ? 'Out of stock' : 'Add to cart';

  addBtn.addEventListener('click', () => {
    addToCart(p.id, qty, stock === Infinity ? undefined : stock);
    updateCartCountIfPresent();
    showToast('Added to cart');
  });
  buyNowBtn.addEventListener('click', () => {
    addToCart(p.id, qty, stock === Infinity ? undefined : stock);
    location.href = 'checkout.html';
  });

  const wishlistBtn = document.getElementById('pdpWishlistBtn');
  wishlistBtn.dataset.id = p.id;
  const wishlisted = isWishlisted(p.id);
  wishlistBtn.classList.toggle('is-active', wishlisted);
  wishlistBtn.setAttribute('aria-pressed', String(wishlisted));
  wishlistBtn.innerHTML = wishlisted ? '&#9829;' : '&#9825;';
  wishlistBtn.addEventListener('click', () => handleWishlistToggle(p.id, wishlistBtn));

  pdpRoot.style.display = '';
  reviewsSection.style.display = '';

  loadReviews(p.id);
  loadRelated(p);
}

function showNotFound() {
  pdpRoot.style.display = 'none';
  breadcrumbEl.style.display = 'none';
  notFoundEl.style.display = '';
}

init();
