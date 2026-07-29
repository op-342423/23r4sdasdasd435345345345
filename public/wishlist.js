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
    <div class="product-card" data-id="${p.id}">
      <button type="button" class="wishlist-btn wishlist-btn--card is-active" data-id="${p.id}" aria-label="Remove from wishlist">&#9829;</button>
      <div class="product-card__img-wrap">${photo}</div>
      <p class="category">${p.category || 'Item'}</p>
      <h3>${p.name}</h3>
      <p class="price">${formatPrice(p.price, p.currency)}</p>
      <a class="btn" href="index.html#products" style="display:block;text-align:center;text-decoration:none;">View in shop</a>
    </div>
  `;
}

async function render() {
  const me = await apiMe();
  if (!me.loggedIn) {
    grid.innerHTML = '';
    emptyEl.style.display = '';
    emptyEl.innerHTML = 'Log in to see your wishlist — <a href="login.html?next=wishlist.html">log in</a> or <a href="register.html?next=wishlist.html">sign up</a>.';
    return;
  }

  try {
    const items = await apiGetWishlist();
    if (!items.length) {
      grid.innerHTML = '';
      emptyEl.style.display = '';
      emptyEl.textContent = 'Nothing saved yet — tap the heart on any item in the shop to save it here.';
      return;
    }
    emptyEl.style.display = 'none';
    grid.innerHTML = items.map(cardHTML).join('');
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
