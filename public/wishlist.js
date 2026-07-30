renderAccountBar();

const grid = document.getElementById('wishlistGrid');
const emptyEl = document.getElementById('wishlistEmpty');

function cardHTML(p) {
  const images = getProductImages(p);
  const photo = images[0]
    ? `<img class="product-card__photo" src="${images[0]}" alt="" loading="lazy">`
    : `<div class="product-card__img product-card__img--empty"></div>`;
  const stock = getProductStock(p);
  const outOfStock = stock <= 0;
  return `
    <div class="product-card reveal" data-id="${p.id}">
      <button type="button" class="wishlist-btn wishlist-btn--card is-active" data-id="${p.id}" aria-label="Remove from wishlist">&#9829;</button>
      <div class="product-card__img-wrap">${photo}</div>
      <p class="category">${p.category || 'Item'}</p>
      <h3>${p.name}</h3>
      <p class="price">${formatPrice(p.price, p.currency)}</p>
      <a class="btn" href="index.html#products" style="display:block;text-align:center;text-decoration:none;">View in shop</a>
    </div>
  `;
}

function observeReveal() {
  const cards = grid.querySelectorAll('.product-card.reveal');
  if (!('IntersectionObserver' in window)) { cards.forEach(c => c.classList.add('is-visible')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => io.observe(c));
}

const HEART_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
  </svg>
`;
function renderEmptyState(html) {
  grid.innerHTML = '';
  emptyEl.style.display = '';
  emptyEl.className = 'empty-state';
  emptyEl.innerHTML = `<span class="empty-state__icon">${HEART_ICON}</span><span class="empty-state__text">${html}</span>`;
}

function renderSkeleton() {
  emptyEl.style.display = 'none';
  const card = `
    <div class="skeleton-card">
      <div class="skeleton-card__block skeleton-card__img"></div>
      <div class="skeleton-card__block skeleton-card__line"></div>
      <div class="skeleton-card__block skeleton-card__line skeleton-card__line--title"></div>
      <div class="skeleton-card__block skeleton-card__line skeleton-card__line--price"></div>
    </div>
  `;
  grid.innerHTML = card.repeat(4);
}
renderSkeleton();

async function render() {
  const me = await apiMe();
  if (!me.loggedIn) {
    renderEmptyState('Log in to see your wishlist — <a href="login.html?next=wishlist.html">log in</a> or <a href="register.html?next=wishlist.html">sign up</a>.');
    return;
  }

  try {
    const items = await apiGetWishlist();
    if (!items.length) {
      renderEmptyState('Nothing saved yet — tap the heart on any item in the shop to save it here.');
      return;
    }
    emptyEl.style.display = 'none';
    grid.innerHTML = items.map(cardHTML).join('');
    observeReveal();
    grid.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        await apiToggleWishlist(id);
        showToast('Removed from wishlist');
        render();
      });
    });
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--muted);">Could not load your wishlist — try refreshing.</p>';
  }
}

render();
