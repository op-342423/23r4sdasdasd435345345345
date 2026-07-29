/* ==========================================================
   api.js — talks to the real backend (server.js) instead of
   localStorage. Same job data.js used to do, but everything
   is async now (fetch) since it goes over the network and is
   shared by every visitor.
   ========================================================== */

const CURRENCY_SYMBOLS = { USD: '$', EGP: 'E£', GBP: '£' };
const MAX_PRODUCT_IMAGES = 8; // raised from 5 (brief item 2, this batch)
const DELIVERY_FEE = 5;
const ESTIMATED_DELIVERY = '2–4 days';
const LOW_STOCK_THRESHOLD = 10; // brief item 6: "Only X left" below this

function formatPrice(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return symbol + Number(amount).toFixed(0);
}

function getProductImages(p) {
  return (p.images && p.images.length) ? p.images : [];
}

function getProductStock(p) {
  return (p.stock === undefined || p.stock === null) ? Infinity : Number(p.stock);
}

// ---------------- Low stock counter (brief item 6, this batch) ----------------
// Shared by product cards, the quick-view modal, and the new product
// page so the escalating color/threshold logic only lives in one
// place. Returns null when nothing should be shown (unlimited stock,
// or stock at/above the threshold).
//
// TODO: once the Arabic/English system (Section 5) ships, swap the
// "text" string here for an i18n lookup ("Only {n} left" /
// "باقي {n} قطعة فقط") — left English-only for now, same as the rest
// of the pre-i18n UI text.
function getStockNote(p) {
  const stock = getProductStock(p);
  if (stock === Infinity) return null;
  if (stock <= 0) return { text: 'Out of stock', cls: 'stock-note--out' };
  if (stock >= LOW_STOCK_THRESHOLD) return null;
  const cls = stock <= 2 ? 'stock-note--critical' : stock <= 5 ? 'stock-note--urgent' : 'stock-note--low';
  return { text: `Only ${stock} left`, cls };
}

async function apiCall(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------- Auth ----------------
async function apiMe() { return apiCall('GET', '/api/auth/me'); }
async function apiRegister(email, password) { return apiCall('POST', '/api/auth/register', { email, password }); }
async function apiLogin(email, password) { return apiCall('POST', '/api/auth/login', { email, password }); }
async function apiLogout() { return apiCall('POST', '/api/auth/logout'); }

// ---------------- Products ----------------
async function getProducts() { return apiCall('GET', '/api/products'); }
async function getProduct(id) { return apiCall('GET', '/api/products/' + id); }
async function addProduct(product) { return apiCall('POST', '/api/products', product); }
async function updateProduct(id, product) { return apiCall('PUT', '/api/products/' + id, product); }
async function deleteProduct(id) { return apiCall('DELETE', '/api/products/' + id); }

// ---------------- Reviews (Part 3, this batch) ----------------
async function getReviews(productId) { return apiCall('GET', '/api/reviews?productId=' + productId); }
async function addReview(review) { return apiCall('POST', '/api/reviews', review); }
async function getReviewsAdmin() { return apiCall('GET', '/api/reviews/admin'); }
async function setReviewApproved(id, approved) { return apiCall('PATCH', `/api/reviews/${id}/approve`, { approved }); }
async function deleteReview(id) { return apiCall('DELETE', '/api/reviews/' + id); }

// ---------------- Hero video ----------------
async function getHeroVideo() { return apiCall('GET', '/api/products/hero-video'); }
async function saveHeroVideo(config) { return apiCall('POST', '/api/products/hero-video', config); }
async function removeHeroVideo() { return apiCall('DELETE', '/api/products/hero-video'); }

// ---------------- Site settings (social / contact) ----------------
async function getSiteSettings() { return apiCall('GET', '/api/settings'); }
async function saveSiteSettings(settings) { return apiCall('POST', '/api/settings', settings); }

// ---------------- Learn More section ----------------
async function getLearnMoreSection() { return apiCall('GET', '/api/learn-more'); }
async function saveLearnMoreSection(section) { return apiCall('POST', '/api/learn-more', section); }

// ---------------- Collection Stories ----------------
async function getCollectionStories(all) { return apiCall('GET', '/api/collections' + (all ? '?all=1' : '')); }
async function addCollectionStory(story) { return apiCall('POST', '/api/collections', story); }
async function deleteCollectionStory(id) { return apiCall('DELETE', '/api/collections/' + id); }

// ---------------- Editorial ----------------
async function getEditorialItems(all) { return apiCall('GET', '/api/editorial' + (all ? '?all=1' : '')); }
async function addEditorialItem(item) { return apiCall('POST', '/api/editorial', item); }
async function deleteEditorialItem(id) { return apiCall('DELETE', '/api/editorial/' + id); }

// ---------------- Payment methods (Part 3) ----------------
async function getPaymentMethods() { return apiCall('GET', '/api/payment-methods'); }
async function getPaymentMethodsAdmin() { return apiCall('GET', '/api/payment-methods/admin'); }
async function savePaymentMethods(list) { return apiCall('PUT', '/api/payment-methods', list); }

// ---------------- Wishlist ----------------
async function apiGetWishlist() { return apiCall('GET', '/api/wishlist'); }
async function apiGetWishlistIds() { return apiCall('GET', '/api/wishlist/mine-ids'); }
async function apiToggleWishlist(productId) { return apiCall('POST', '/api/wishlist/toggle', { productId }); }

// ---------------- Orders ----------------
async function apiPlaceOrder(order) { return apiCall('POST', '/api/orders', order); }
async function apiGetMyOrders() { return apiCall('GET', '/api/orders/mine'); }

// ---------------- Cart (still local — it's just a pre-checkout basket) ----------------
function getCart() {
  try { return JSON.parse(localStorage.getItem('thorn_cart') || '[]'); } catch (e) { return []; }
}
function saveCart(cart) {
  try { localStorage.setItem('thorn_cart', JSON.stringify(cart)); return true; } catch (e) { return false; }
}
function addToCart(productId, qty, maxQty) {
  const addQty = qty || 1;
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  const cap = maxQty === undefined ? Infinity : maxQty;
  if (existing) {
    existing.qty = Math.min(existing.qty + addQty, cap);
  } else {
    cart.push({ id: productId, qty: Math.min(addQty, cap) });
  }
  return saveCart(cart);
}
function removeFromCart(productId) {
  return saveCart(getCart().filter(item => item.id !== productId));
}
function setCartQty(productId, qty, maxQty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  const cap = maxQty === undefined ? Infinity : maxQty;
  const clamped = Math.max(0, Math.min(qty, cap));
  if (clamped <= 0) return saveCart(cart.filter(i => i.id !== productId));
  item.qty = clamped;
  return saveCart(cart);
}
function clearCart() { localStorage.removeItem('thorn_cart'); }
function getCartCount() { return getCart().reduce((sum, item) => sum + item.qty, 0); }

// Resizes an image before sending it to the server, same as before.
function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Renders the small "Hi, you@x.com · Wishlist · Your Orders · Log out"
// account strip into any element with id="accountBar", if present on
// the page. Pages that don't have that element just skip this.
async function renderAccountBar() {
  const el = document.getElementById('accountBar');
  if (!el) return;
  try {
    const me = await apiMe();
    if (me.loggedIn) {
      el.innerHTML = `
        <a href="wishlist.html">Wishlist</a>
        <a href="my-orders.html">Your orders</a>
        <span class="account-email">${me.email}</span>
        <button type="button" id="logoutBtn" class="cart-drawer__link">Log out</button>
      `;
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        await apiLogout();
        location.reload();
      });
    } else {
      el.innerHTML = `<a href="login.html">Log in</a> <a href="register.html">Sign up</a>`;
    }
  } catch (e) { /* not logged in / network hiccup — leave as-is */ }
}
