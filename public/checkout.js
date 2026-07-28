/* ==========================================================
   checkout.js — same UX as before (coupon, GPS, cash on
   delivery) but now places the order through the real API,
   which requires being logged in so the order can show up on
   "Your orders" afterward.
   ========================================================== */

renderAccountBar();

let PRODUCTS = [];
let appliedCoupon = null; // { code, label }

const cartLinesEl = document.getElementById('cartLines');
const cartSubtotalEl = document.getElementById('cartSubtotal');
const discountRowEl = document.getElementById('discountRow');
const cartDiscountEl = document.getElementById('cartDiscount');
const cartDeliveryEl = document.getElementById('cartDelivery');
const cartTotalEl = document.getElementById('cartTotal');
const deliveryEstimateEl = document.getElementById('deliveryEstimate');

// Client-side coupon preview only (server re-validates and is authoritative)
const COUPONS_PREVIEW = {
  THORN10: { type: 'percent', value: 10, label: '10% off' },
  WELCOME5: { type: 'flat', value: 5, label: '$5 off' }
};

function computeTotals() {
  const cart = getCart();
  let subtotal = 0;
  let currency = 'USD';
  cart.forEach(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) return;
    subtotal += product.price * item.qty;
    currency = product.currency;
  });

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.type === 'percent' ? subtotal * (appliedCoupon.value / 100) : appliedCoupon.value;
    discount = Math.min(discount, subtotal);
  }
  const delivery = cart.length ? DELIVERY_FEE : 0;
  const total = Math.max(0, subtotal - discount + delivery);
  return { subtotal, discount, delivery, total, currency };
}

function renderTotals() {
  const { subtotal, discount, delivery, total, currency } = computeTotals();
  cartSubtotalEl.textContent = formatPrice(subtotal, currency);
  cartDeliveryEl.textContent = getCart().length ? formatPrice(delivery, currency) : '$0';
  cartTotalEl.textContent = formatPrice(total, currency);
  if (discount > 0) {
    discountRowEl.style.display = '';
    cartDiscountEl.textContent = '-' + formatPrice(discount, currency);
  } else {
    discountRowEl.style.display = 'none';
  }
  deliveryEstimateEl.textContent = getCart().length ? `Estimated arrival: ${ESTIMATED_DELIVERY}` : '';
}

function renderCart() {
  const cart = getCart();
  if (cart.length === 0) {
    cartLinesEl.innerHTML = '<p style="color:var(--muted);">Your cart is empty.</p>';
    renderTotals();
    return;
  }

  cartLinesEl.innerHTML = cart.map(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) return '';
    const lineTotal = product.price * item.qty;
    const images = getProductImages(product);
    const maxQty = getProductStock(product);
    const thumb = images[0] ? `<img src="${images[0]}" class="cart-line__thumb" alt="">` : `<span class="cart-line__thumb cart-line__thumb--empty"></span>`;
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
  }).join('') + `<div style="text-align:right;margin-top:0.5rem;"><button type="button" class="cart-drawer__link cart-drawer__link--danger" id="clearCartBtn">Remove all</button></div>`;

  renderTotals();

  cartLinesEl.querySelectorAll('.cart-line__remove').forEach(btn => {
    btn.addEventListener('click', () => { removeFromCart(Number(btn.dataset.id)); updateCartCountIfPresent(); renderCart(); });
  });
  cartLinesEl.querySelectorAll('.cart-line__qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const item = getCart().find(i => i.id === id);
      if (!item) return;
      const product = PRODUCTS.find(p => p.id === id);
      setCartQty(id, item.qty - 1, product ? getProductStock(product) : Infinity);
      updateCartCountIfPresent(); renderCart();
    });
  });
  cartLinesEl.querySelectorAll('.cart-line__qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const item = getCart().find(i => i.id === id);
      if (!item) return;
      const product = PRODUCTS.find(p => p.id === id);
      setCartQty(id, item.qty + 1, product ? getProductStock(product) : Infinity);
      updateCartCountIfPresent(); renderCart();
    });
  });
  const clearBtn = document.getElementById('clearCartBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { clearCart(); updateCartCountIfPresent(); renderCart(); });
}

/* ---------------- Coupon ---------------- */
const couponInput = document.getElementById('couponInput');
const applyCouponBtn = document.getElementById('applyCouponBtn');
const couponStatus = document.getElementById('couponStatus');

applyCouponBtn.addEventListener('click', () => {
  const coupon = COUPONS_PREVIEW[(couponInput.value || '').trim().toUpperCase()];
  if (!coupon) {
    appliedCoupon = null;
    couponStatus.textContent = "That code isn't valid.";
    couponStatus.classList.remove('is-ready');
    renderTotals();
    return;
  }
  appliedCoupon = { code: couponInput.value.trim().toUpperCase(), ...coupon };
  couponStatus.textContent = `Applied: ${coupon.label}`;
  couponStatus.classList.add('is-ready');
  renderTotals();
});

/* ---------------- GPS ---------------- */
let capturedLocation = null;
const gpsBtn = document.getElementById('gpsBtn');
const gpsStatus = document.getElementById('gpsStatus');

gpsBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { gpsStatus.textContent = "Your browser doesn't support location sharing."; return; }
  gpsStatus.textContent = 'Getting your location...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      gpsStatus.textContent = `Location captured (${capturedLocation.lat.toFixed(4)}, ${capturedLocation.lng.toFixed(4)})`;
      gpsStatus.classList.add('is-ready');
    },
    () => { gpsStatus.textContent = 'Could not get your location. You can still order using your written address.'; }
  );
});

/* ---------------- Place order ---------------- */
document.getElementById('placeOrderBtn').addEventListener('click', async () => {
  const cart = getCart();
  if (cart.length === 0) { showToast('Your cart is empty — add something from the shop first.', 'error'); return; }

  const me = await apiMe();
  if (!me.loggedIn) {
    showToast('Please log in to place an order.', 'error');
    setTimeout(() => { location.href = 'login.html?next=checkout.html'; }, 900);
    return;
  }

  const name = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!name || !phone || !address) { showToast('Please fill in your name, phone, and address.', 'error'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("That email address doesn't look right.", 'error'); return; }

  const placeBtn = document.getElementById('placeOrderBtn');
  placeBtn.disabled = true;
  placeBtn.textContent = 'Placing order...';

  try {
    const order = await apiPlaceOrder({
      items: cart,
      name, email, phone, address, notes,
      location: capturedLocation,
      couponCode: appliedCoupon ? appliedCoupon.code : null
    });

    clearCart();
    updateCartCountIfPresent();

    const confirmBox = document.getElementById('confirmBox');
    confirmBox.style.display = 'block';
    confirmBox.innerHTML = `
      <strong>Order placed — #${String(order.id).padStart(6, '0')}</strong>
      <p style="margin-top:0.5rem;color:var(--muted);font-size:0.9rem;">
        You'll pay at the door in cash when it arrives at:<br>
        ${address}${capturedLocation ? ' (GPS location attached)' : ''}
      </p>
      <p style="margin-top:0.5rem;color:var(--muted);font-size:0.9rem;">Estimated arrival: ${ESTIMATED_DELIVERY}</p>
      <p style="margin-top:0.75rem;"><a href="my-orders.html" class="cart-drawer__link">Track this order &rarr;</a></p>
    `;
    placeBtn.style.display = 'none';
  } catch (e) {
    showToast(e.message || 'Could not place order.', 'error');
    placeBtn.disabled = false;
    placeBtn.textContent = 'Place order';
  }
});

function updateCartCountIfPresent() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = getCartCount();
}

(async function init() {
  try {
    PRODUCTS = await getProducts();
    renderCart();
  } catch (e) {
    cartLinesEl.innerHTML = '<p style="color:var(--muted);">Could not load your cart — try refreshing.</p>';
  }
})();
