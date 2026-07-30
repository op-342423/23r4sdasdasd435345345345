/* ==========================================================
   checkout.js — same UX as before (coupon, GPS, cash on
   delivery) but now places the order through the real API,
   which requires being logged in so the order can show up on
   "Your orders" afterward.
   ========================================================== */

renderAccountBar();

let PRODUCTS = [];
let appliedCoupon = null; // { code, label }
let PAYMENT_METHODS = [];
let selectedPaymentMethodId = null;
let paymentProofDataUrl = null;

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
    cartLinesEl.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
        </span>
        <span class="empty-state__text">Your cart is empty — <a href="index.html#products">go find something</a>.</span>
      </div>
    `;
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

/* ---------------- GPS ----------------
   Captures precise coordinates, then reverse-geocodes them into a
   readable address (OpenStreetMap Nominatim — free, no API key)
   purely to show the shopper a human-readable confirmation of
   where they've pinned. The coordinates are what's authoritative
   and what gets sent with the order either way, so a slow/blocked
   geocoding call never stops checkout from working. */
let capturedLocation = null;
const gpsBtn = document.getElementById('gpsBtn');
const gpsStatus = document.getElementById('gpsStatus');

function mapsLinkFor(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.display_name ? data.display_name : null;
  } catch (e) {
    return null; // non-critical — coordinates alone are still enough for delivery
  }
}

gpsBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { gpsStatus.textContent = "Your browser doesn't support location sharing."; return; }
  gpsStatus.textContent = 'Getting your location…';
  gpsStatus.classList.remove('is-ready');
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      capturedLocation = { lat, lng, accuracy: position.coords.accuracy || null, address: null };

      gpsStatus.innerHTML = `Location captured — <a href="${mapsLinkFor(lat, lng)}" target="_blank" rel="noopener">view on map</a>`;
      gpsStatus.classList.add('is-ready');

      const resolvedAddress = await reverseGeocode(lat, lng);
      if (resolvedAddress && capturedLocation) {
        capturedLocation.address = resolvedAddress;
        gpsStatus.innerHTML = `Pinned: ${resolvedAddress} — <a href="${mapsLinkFor(lat, lng)}" target="_blank" rel="noopener">view on map</a>`;
      }
    },
    () => { gpsStatus.textContent = 'Could not get your location. You can still order using your written address.'; }
  );
});

/* ---------------- Payment methods (Part 3) ----------------
   Renders whatever the owner has enabled, in the order they set in
   admin — never hardcoded here. Vodafone Cash / InstaPay show the
   relevant phone/username + QR and an optional reference/screenshot
   field once selected; Visa/Mastercard render disabled with a
   "coming soon" note, since no live card flow exists yet. */
const paymentMethodsListEl = document.getElementById('paymentMethodsList');

function pmDisplayName(id, fallback) {
  const NAMES = { cod: 'Cash on Delivery', vodafone_cash: 'Vodafone Cash', instapay: 'InstaPay', visa: 'Visa', mastercard: 'Mastercard' };
  return NAMES[id] || fallback;
}

function renderPaymentMethodsList() {
  if (!paymentMethodsListEl) return;

  if (!PAYMENT_METHODS.length) {
    paymentMethodsListEl.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;">Cash on Delivery — pay at the door when your order arrives.</p>`;
    selectedPaymentMethodId = 'cod';
    return;
  }

  if (!selectedPaymentMethodId || !PAYMENT_METHODS.some(m => m.id === selectedPaymentMethodId)) {
    const firstUsable = PAYMENT_METHODS.find(m => m.id !== 'visa' && m.id !== 'mastercard');
    selectedPaymentMethodId = firstUsable ? firstUsable.id : PAYMENT_METHODS[0].id;
  }

  paymentMethodsListEl.innerHTML = PAYMENT_METHODS.map((m) => {
    const isCardPlaceholder = m.id === 'visa' || m.id === 'mastercard';
    const checked = selectedPaymentMethodId === m.id;
    const cfg = m.config || {};

    let details = '';
    if (checked && m.id === 'vodafone_cash') {
      details = `
        <div class="payment-method__details">
          ${cfg.phone ? `<p><strong>Send to:</strong> ${cfg.phone}${cfg.accountHolder ? ` (${cfg.accountHolder})` : ''}</p>` : ''}
          ${cfg.qrDataUrl ? `<img src="${cfg.qrDataUrl}" alt="Vodafone Cash QR code" class="payment-method__qr">` : ''}
          <div class="field">
            <label for="paymentReferenceInput">Transaction reference (optional)</label>
            <input type="text" id="paymentReferenceInput" placeholder="e.g. transaction ID">
          </div>
          ${paymentProofFieldHtml()}
        </div>
      `;
    } else if (checked && m.id === 'instapay') {
      details = `
        <div class="payment-method__details">
          ${cfg.username ? `<p><strong>Send to:</strong> ${cfg.username}</p>` : ''}
          ${cfg.qrDataUrl ? `<img src="${cfg.qrDataUrl}" alt="InstaPay QR code" class="payment-method__qr">` : ''}
          <div class="field">
            <label for="paymentReferenceInput">Transaction reference (optional)</label>
            <input type="text" id="paymentReferenceInput" placeholder="e.g. transaction ID">
          </div>
          ${paymentProofFieldHtml()}
        </div>
      `;
    } else if (checked && m.id === 'cod') {
      details = `<p class="payment-method__details" style="color:var(--muted);font-size:0.85rem;">Pay in cash at the door when your order arrives.</p>`;
    }

    return `
      <label class="payment-method${isCardPlaceholder ? ' payment-method--disabled' : ''}${checked ? ' is-selected' : ''}">
        <span style="display:flex;align-items:center;gap:0.6rem;">
          <input type="radio" name="paymentMethod" value="${m.id}" ${checked ? 'checked' : ''} ${isCardPlaceholder ? 'disabled' : ''}>
          ${pmDisplayName(m.id, m.name)}
          ${isCardPlaceholder ? '<span class="payment-method__badge">Coming soon</span>' : ''}
        </span>
        ${details}
      </label>
    `;
  }).join('');

  paymentMethodsListEl.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      selectedPaymentMethodId = input.value;
      paymentProofDataUrl = null;
      renderPaymentMethodsList();
    });
  });

  const proofInput = document.getElementById('paymentProofInput');
  if (proofInput) {
    proofInput.addEventListener('change', async () => {
      const file = proofInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Please choose an image file.', 'error'); return; }
      try {
        paymentProofDataUrl = await compressImageFile(file, 900, 0.8);
        showToast('Screenshot attached', 'success');
      } catch (e) {
        showToast('Could not read that image.', 'error');
      }
    });
  }
}

function paymentProofFieldHtml() {
  return `
    <div class="field">
      <label for="paymentProofInput">Payment screenshot (optional)</label>
      <input type="file" id="paymentProofInput" accept="image/*">
    </div>
  `;
}

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
    const referenceInput = document.getElementById('paymentReferenceInput');
    const order = await apiPlaceOrder({
      items: cart,
      name, email, phone, address, notes,
      location: capturedLocation,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      paymentMethod: selectedPaymentMethodId || 'cod',
      paymentReference: referenceInput ? referenceInput.value.trim() : null,
      paymentProofDataUrl: paymentProofDataUrl || null
    });

    clearCart();
    updateCartCountIfPresent();

    const methodLabel = pmDisplayName(order.paymentMethodKey, order.paymentMethod || 'Cash on Delivery');
    const gpsNote = capturedLocation ? ' (exact GPS pin shared with the courier)' : '';
    const paymentNote = order.paymentMethodKey === 'cod' || !order.paymentMethodKey
      ? `You'll pay in cash at the door when it arrives at:<br>${address}${gpsNote}`
      : `Paying via <strong>${methodLabel}</strong>${order.paymentReference ? ` — reference: ${order.paymentReference}` : ''}. Delivering to:<br>${address}${gpsNote}`;

    const confirmBox = document.getElementById('confirmBox');
    confirmBox.style.display = 'block';
    confirmBox.innerHTML = `
      <svg class="confirm-check" viewBox="0 0 60 60">
        <circle class="confirm-check__circle" cx="30" cy="30" r="26"></circle>
        <polyline class="confirm-check__tick" points="18,31 26,39 42,21"></polyline>
      </svg>
      <div style="text-align:center;">
        <strong>Order placed — #${String(order.id).padStart(6, '0')}</strong>
        <p style="margin-top:0.5rem;color:var(--muted);font-size:0.9rem;">
          ${paymentNote}
        </p>
        <p style="margin-top:0.5rem;color:var(--muted);font-size:0.9rem;">Estimated arrival: ${ESTIMATED_DELIVERY}</p>
        <p style="margin-top:0.75rem;"><a href="my-orders.html" class="cart-drawer__link">Track this order &rarr;</a></p>
      </div>
    `;
    placeBtn.style.display = 'none';
    confirmBox.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
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

  try {
    PAYMENT_METHODS = await getPaymentMethods();
  } catch (e) {
    PAYMENT_METHODS = []; // falls back to Cash on Delivery only, see renderPaymentMethodsList
  }
  renderPaymentMethodsList();
})();
