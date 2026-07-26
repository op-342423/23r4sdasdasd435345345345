/* ==========================================================
   data.js — the shared "database" for the whole site.

   Real production sites store products on a server. We don't
   have a server here, so we use the browser's localStorage —
   it's a small key/value store built into every browser that
   survives page reloads and closing the tab.

   IMPORTANT: this only works when you open the site through a
   real server (Live Server in VS Code, or any hosting) — not
   when it's just previewed inside a chat window's sandboxed
   preview, which blocks localStorage entirely. Every save
   function below reports whether it actually persisted, and
   every page shows a banner if it can't, instead of silently
   losing your data.
   ========================================================== */

const CURRENCY_SYMBOLS = {
  USD: '$',
  EGP: 'E£',
  GBP: '£'
};

const MAX_PRODUCT_IMAGES = 5;

function formatPrice(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return symbol + Number(amount).toFixed(0);
}


/* ==========================================================
   SAFE STORAGE LAYER
   Wraps every localStorage call. If localStorage is blocked
   (private browsing, a sandboxed preview iframe, disabled
   storage) or a write goes over quota (e.g. too many big
   product photos), these fall back to an in-memory copy so
   the site keeps working for the current session instead of
   throwing and silently doing nothing. storageSet() returns
   true/false so callers can tell the user when something
   didn't actually save permanently.
   ========================================================== */
const _memoryStore = {};
let _storageAvailable = null;

function isStorageAvailable() {
  if (_storageAvailable !== null) return _storageAvailable;
  try {
    const testKey = '__thorn_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    _storageAvailable = true;
  } catch (e) {
    _storageAvailable = false;
  }
  return _storageAvailable;
}

function storageGet(key) {
  if (isStorageAvailable()) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) { /* fall through to memory */ }
  }
  return Object.prototype.hasOwnProperty.call(_memoryStore, key) ? _memoryStore[key] : null;
}

// Always keeps an in-memory copy (so the page works this session
// even if persistence fails), and returns true only if it actually
// made it into real localStorage.
function storageSet(key, value) {
  _memoryStore[key] = value;
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false; // e.g. QuotaExceededError — photo/video too large for what's left
  }
}

function storageRemove(key) {
  delete _memoryStore[key];
  if (isStorageAvailable()) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
}

// Call once per page on load. Shows a persistent banner (see ui.js)
// if nothing will actually survive a refresh, so this is never a
// silent failure.
function checkStorageAndWarn() {
  if (!isStorageAvailable() && typeof showPersistentBanner === 'function') {
    showPersistentBanner('Changes on this page won\'t be saved permanently — your browser is blocking local storage (common in private browsing or a chat preview). Open the site through real hosting to save products, cart, and orders.');
  }
}


// Every product now carries an `images` array (up to 5 photos)
// instead of a single `image` URL. getProductImages() below keeps
// old single-image products working automatically.
function getProductImages(p) {
  if (p.images && p.images.length) return p.images;
  if (p.image) return [p.image];
  return [];
}

// Products the store starts with, the first time it's ever opened.
const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Vein Ring',   price: 45,  currency: 'USD', category: 'Rings',       images: [], stock: 12, createdAt: 3, description: 'Cast in blackened silver — a single vein of red runs through the band.' },
  { id: 'p2', name: 'Ash Hoodie',  price: 60,  currency: 'USD', category: 'Clothing',    images: [], stock: 8,  createdAt: 2, description: 'Heavyweight fleece, oversized fit, faded like it survived something.' },
  { id: 'p3', name: 'Root Chain',  price: 850, currency: 'EGP', category: 'Accessories', images: [], stock: 5,  createdAt: 1, description: 'Hand-linked chain with a matte-black finish. Not made for everyone.' }
];

// Stock is optional on older saved products — treat "missing" as
// unlimited (Infinity) so nothing that used to work suddenly breaks.
function getProductStock(p) {
  return (p.stock === undefined || p.stock === null || p.stock === '') ? Infinity : Number(p.stock);
}

function getProducts() {
  const raw = storageGet('thorn_products');
  if (!raw) {
    storageSet('thorn_products', JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  }
  try {
    const products = JSON.parse(raw);
    // migrate any legacy single-image products on the fly
    return products.map((p, i) => ({ ...p, images: getProductImages(p), createdAt: p.createdAt ?? i }));
  } catch (e) {
    return DEFAULT_PRODUCTS;
  }
}

// Lowers stock for each cart line by the quantity ordered. Silently
// skips products with unlimited (no) stock tracking, and never goes
// below 0 even if two tabs ordered the last item at once.
function decrementStock(cartItems) {
  const products = getProducts();
  cartItems.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product || product.stock === undefined || product.stock === null) return;
    product.stock = Math.max(0, Number(product.stock) - item.qty);
  });
  saveProducts(products);
}

// Returns true if the product list actually persisted.
function saveProducts(products) {
  return storageSet('thorn_products', JSON.stringify(products));
}

// Returns true if the new product actually persisted.
function addProduct(product) {
  const products = getProducts();
  product.id = 'p' + Date.now();
  product.createdAt = Date.now();
  product.images = (product.images || []).slice(0, MAX_PRODUCT_IMAGES);
  product.stock = (product.stock === '' || product.stock === undefined) ? null : Number(product.stock);
  products.push(product);
  return saveProducts(products);
}

function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  return saveProducts(products);
}

// ---------------- Cart ----------------

function getCart() {
  const raw = storageGet('thorn_cart');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveCart(cart) {
  return storageSet('thorn_cart', JSON.stringify(cart));
}

function addToCart(productId, qty) {
  const addQty = qty || 1;
  const cart = getCart();
  const product = getProducts().find(p => p.id === productId);
  const maxQty = product ? getProductStock(product) : Infinity;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + addQty, maxQty);
  } else {
    cart.push({ id: productId, qty: Math.min(addQty, maxQty) });
  }
  return saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  return saveCart(cart);
}

// Sets an exact quantity for a line (used by the +/- controls). Clamps
// to 1..stock, and removes the line entirely if qty is pushed to 0.
function setCartQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  const product = getProducts().find(p => p.id === productId);
  const maxQty = product ? getProductStock(product) : Infinity;
  const clamped = Math.max(0, Math.min(qty, maxQty));
  if (clamped <= 0) {
    return saveCart(cart.filter(i => i.id !== productId));
  }
  item.qty = clamped;
  return saveCart(cart);
}

function clearCart() {
  storageRemove('thorn_cart');
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

// ---------------- Wishlist ----------------

function getWishlist() {
  const raw = storageGet('thorn_wishlist');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function isInWishlist(productId) {
  return getWishlist().includes(productId);
}

// Returns the new saved/not-saved state so callers can update UI.
function toggleWishlist(productId) {
  let list = getWishlist();
  const inList = list.includes(productId);
  list = inList ? list.filter(id => id !== productId) : [...list, productId];
  storageSet('thorn_wishlist', JSON.stringify(list));
  return !inList;
}

// ---------------- Coupons ----------------
// Simple demo codes — a real store would validate these server-side.
const COUPONS = {
  THORN10: { type: 'percent', value: 10, label: '10% off' },
  WELCOME5: { type: 'flat', value: 5, label: '$5 off' }
};

function getCoupon(code) {
  return COUPONS[(code || '').trim().toUpperCase()] || null;
}

// ---------------- Delivery ----------------

const DELIVERY_FEE = 5; // flat fee, same currency units as displayed total
const ESTIMATED_DELIVERY = '2–4 days';

// ---------------- Orders (so the owner could review them later) ----------------

// Returns { id, saved } — id always exists so the confirmation screen
// works even if this session's browser can't persist orders; `saved`
// tells the caller whether it will actually survive a refresh.
function saveOrder(order) {
  const raw = storageGet('thorn_orders');
  let orders = [];
  if (raw) { try { orders = JSON.parse(raw); } catch (e) { orders = []; } }
  order.id = 'ord' + Date.now();
  order.date = new Date().toISOString();
  orders.push(order);
  const saved = storageSet('thorn_orders', JSON.stringify(orders));
  decrementStock(order.items);
  return { id: order.id, saved };
}

// ---------------- Hero video (set from admin.html — no code editing needed) ----------------
// Shape: { dataUrl, start, end, fit: 'cover'|'contain', brightness: 0-100, name }
function getHeroVideo() {
  const raw = storageGet('thorn_hero_video');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// Returns true if it actually persisted.
function saveHeroVideo(config) {
  return storageSet('thorn_hero_video', JSON.stringify(config));
}

function removeHeroVideo() {
  storageRemove('thorn_hero_video');
}
