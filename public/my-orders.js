renderAccountBar();

const listEl = document.getElementById('ordersList');

const STEP_ORDER = ['pending', 'accepted', 'out_for_delivery', 'delivered'];
const STEP_LABELS = { pending: 'Order placed', accepted: 'Accepted', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timelineHTML(order) {
  if (order.status === 'rejected') {
    return `<p class="stock-note stock-note--out" style="margin-top:0.6rem;">This order was rejected. Please contact the shop if you have questions.</p>`;
  }
  const currentIndex = STEP_ORDER.indexOf(order.status);
  return `
    <div class="order-timeline">
      ${STEP_ORDER.map((step, i) => `
        <div class="order-timeline__step${i <= currentIndex ? ' is-done' : ''}${i === currentIndex ? ' is-current' : ''}">
          <span class="order-timeline__dot"></span>
          <span class="order-timeline__label">${STEP_LABELS[step]}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function orderCardHTML(order) {
  const itemsHTML = order.items.map(i => `
    <div class="admin-row" style="padding:0.4rem 0;">
      <span>${i.name} &times; ${i.qty}</span>
      <span>${formatPrice(i.price * i.qty, i.currency)}</span>
    </div>
  `).join('');

  return `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <strong>Order #${String(order.id).padStart(6, '0')}</strong>
        <span class="stock-pill${order.status === 'rejected' ? ' stock-pill--out' : ''}">${order.statusLabel}</span>
      </div>
      <p style="color:var(--muted);font-size:0.8rem;margin-top:0.3rem;">Placed ${formatDate(order.createdAt)} &middot; Last updated ${formatDate(order.updatedAt)}</p>

      ${timelineHTML(order)}

      <div style="margin-top:1rem;">${itemsHTML}</div>

      <div class="order-summary" style="margin-top:0.8rem;">
        <div class="order-summary__row"><span>Subtotal</span><span>${formatPrice(order.subtotal, order.currency)}</span></div>
        ${order.discount > 0 ? `<div class="order-summary__row"><span>Discount</span><span>-${formatPrice(order.discount, order.currency)}</span></div>` : ''}
        <div class="order-summary__row"><span>Delivery</span><span>${formatPrice(order.deliveryFee, order.currency)}</span></div>
        <div class="cart-total"><span>Total</span><span>${formatPrice(order.total, order.currency)}</span></div>
      </div>

      <p style="color:var(--muted);font-size:0.82rem;margin-top:0.8rem;">
        Delivering to: ${order.address}<br>
        ${order.paymentMethod}
      </p>
      ${order.location && typeof order.location.lat === 'number' ? `
        <p style="color:var(--muted);font-size:0.82rem;margin-top:0.4rem;">
          &#128205; <a href="https://www.google.com/maps?q=${order.location.lat},${order.location.lng}" target="_blank" rel="noopener" style="color:var(--red);font-weight:600;">View your shared pin on the map</a>
        </p>
      ` : ''}
    </div>
  `;
}

async function render() {
  const me = await apiMe();
  if (!me.loggedIn) {
    listEl.innerHTML = `<p style="color:var(--muted);">Log in to see your orders — <a href="login.html?next=my-orders.html">log in</a> or <a href="register.html?next=my-orders.html">sign up</a>.</p>`;
    return;
  }
  try {
    const orders = await apiGetMyOrders();
    if (!orders.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
              <path d="M3 6h18"></path>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </span>
          <span class="empty-state__text">You haven't placed any orders yet — <a href="index.html#products">go shopping</a>.</span>
        </div>
      `;
      return;
    }
    listEl.innerHTML = orders.map(orderCardHTML).join('');
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load your orders — try refreshing.</p>';
  }
}

render();
