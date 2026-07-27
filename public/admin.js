/* ==========================================================
   admin.js — powers the owner dashboard. Gated behind admin
   login; talks to the real API for products, hero video,
   orders, and stats instead of localStorage.
   ========================================================== */

const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['accepted', 'Accepted'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['rejected', 'Rejected']
];

async function apiAdminGetOrders() { return apiCall('GET', '/api/orders'); }
async function apiAdminUpdateStatus(id, status) { return apiCall('PATCH', `/api/orders/${id}/status`, { status }); }
async function apiAdminGetStats() { return apiCall('GET', '/api/orders/stats'); }

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ---------------------------------------------------------
   AUTH GATE
   --------------------------------------------------------- */
(async function gate() {
  renderAccountBar();
  const me = await apiMe();
  if (!me.loggedIn || !me.isAdmin) {
    document.getElementById('lockedPanel').style.display = '';
    return;
  }
  document.getElementById('adminContent').style.display = '';
  initAdmin();
})();

function initAdmin() {
  renderStats();
  renderOrders();
  renderAdminList();
  setupImageUpload();
  setupAddProduct();
  setupHeroVideo();
  setupSocialSettings();
}

/* ---------------------------------------------------------
   OVERVIEW / STATS
   --------------------------------------------------------- */
async function renderStats() {
  const grid = document.getElementById('statsGrid');
  try {
    const stats = await apiAdminGetStats();
    const cards = [
      { label: 'Total revenue', value: formatPrice(stats.revenue, 'USD') },
      { label: 'Orders', value: stats.orderCount },
      { label: 'Pending', value: stats.byStatus.pending || 0 },
      { label: 'Out for delivery', value: stats.byStatus.out_for_delivery || 0 },
      { label: 'Delivered', value: stats.byStatus.delivered || 0 }
    ];
    let html = cards.map(c => `
      <div class="stat-card">
        <span class="stat-card__value">${c.value}</span>
        <span class="stat-card__label">${c.label}</span>
      </div>
    `).join('');

    if (stats.lowStock.length) {
      html += `<div class="stat-card stat-card--wide">
        <span class="stat-card__label">Low stock</span>
        <div>${stats.lowStock.map(p => `<span class="stock-pill stock-pill--out">${p.name}: ${p.stock}</span>`).join(' ')}</div>
      </div>`;
    }
    if (stats.topProducts.length) {
      html += `<div class="stat-card stat-card--wide">
        <span class="stat-card__label">Top sellers</span>
        <div>${stats.topProducts.map(p => `<span class="stock-pill">${p.name}: ${p.units} sold</span>`).join(' ')}</div>
      </div>`;
    }
    grid.innerHTML = html;
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--muted);">Could not load stats.</p>';
  }
}

/* ---------------------------------------------------------
   ORDERS
   --------------------------------------------------------- */
async function renderOrders() {
  const listEl = document.getElementById('ordersList');
  try {
    const orders = await apiAdminGetOrders();
    if (!orders.length) {
      listEl.innerHTML = '<p style="color:var(--muted);">No orders yet.</p>';
      return;
    }
    listEl.innerHTML = orders.map(o => `
      <div class="admin-row" style="flex-direction:column;align-items:stretch;gap:0.5rem;padding:0.9rem;border:1px solid #2a2a2a;border-radius:6px;margin-bottom:0.7rem;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
          <strong>#${String(o.id).padStart(6, '0')} &mdash; ${o.name}</strong>
          <span>${formatPrice(o.total, o.currency)}</span>
        </div>
        <p style="color:var(--muted);font-size:0.8rem;">
          ${formatDate(o.createdAt)} &middot; ${o.phone} &middot; ${o.address}${o.location ? ' (GPS shared)' : ''}
        </p>
        <p style="color:var(--muted);font-size:0.8rem;">${o.items.map(i => `${i.name} &times;${i.qty}`).join(', ')}</p>
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <label style="font-size:0.8rem;color:var(--muted);">Status</label>
          <select class="order-status-select" data-id="${o.id}">
            ${STATUS_OPTIONS.map(([val, label]) => `<option value="${val}"${o.status === val ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await apiAdminUpdateStatus(sel.dataset.id, sel.value);
          showToast('Order status updated', 'success');
          renderStats();
        } catch (e) {
          showToast(e.message || 'Could not update status.', 'error');
        }
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load orders.</p>';
  }
}

/* ---------------------------------------------------------
   PRODUCT PHOTO UPLOAD
   --------------------------------------------------------- */
let pendingImages = [];

function setupImageUpload() {
  const imageInput = document.getElementById('imageInput');
  const uploadDrop = document.getElementById('uploadDrop');
  const imagePreview = document.getElementById('imagePreview');

  function renderImagePreview() {
    imagePreview.innerHTML = pendingImages.map((src, i) => `
      <div class="image-thumb" data-i="${i}">
        <img src="${src}" alt="">
        ${i === 0 ? '<span class="image-thumb__main">MAIN</span>' : ''}
        <button type="button" class="image-thumb__remove" data-i="${i}" aria-label="Remove photo">&times;</button>
      </div>
    `).join('');
    imagePreview.querySelectorAll('.image-thumb__remove').forEach(btn => {
      btn.addEventListener('click', () => { pendingImages.splice(Number(btn.dataset.i), 1); renderImagePreview(); });
    });
  }
  window._renderImagePreview = renderImagePreview;

  function readFilesAsDataURLs(fileList) {
    const files = Array.from(fileList).slice(0, MAX_PRODUCT_IMAGES - pendingImages.length);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      compressImageFile(file, 1280, 0.82)
        .then(dataUrl => { pendingImages.push(dataUrl); renderImagePreview(); })
        .catch(() => showToast('Could not process that photo.', 'error'));
    });
  }

  imageInput.addEventListener('change', () => readFilesAsDataURLs(imageInput.files));
  ['dragover', 'dragenter'].forEach(evt => uploadDrop.addEventListener(evt, (e) => { e.preventDefault(); uploadDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => uploadDrop.addEventListener(evt, (e) => { e.preventDefault(); uploadDrop.classList.remove('is-dragover'); }));
  uploadDrop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) readFilesAsDataURLs(e.dataTransfer.files); });
}

/* ---------------------------------------------------------
   ADD PRODUCT
   --------------------------------------------------------- */
function setupAddProduct() {
  document.getElementById('addBtn').addEventListener('click', async () => {
    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const currency = document.getElementById('currency').value;
    const description = document.getElementById('description').value.trim();
    const badge = document.getElementById('badge').value;
    const stockRaw = document.getElementById('stock').value;

    if (!name || isNaN(price) || price <= 0) { showToast('Please add a name and a valid price.', 'error'); return; }

    const addBtn = document.getElementById('addBtn');
    addBtn.disabled = true;
    try {
      await addProduct({ name, category, price, currency, description, badge, stock: stockRaw === '' ? null : stockRaw, images: pendingImages });
      document.getElementById('name').value = '';
      document.getElementById('price').value = '';
      document.getElementById('description').value = '';
      document.getElementById('badge').value = '';
      document.getElementById('stock').value = '';
      pendingImages = [];
      window._renderImagePreview();
      document.getElementById('imageInput').value = '';
      showToast('Item added to the shop', 'success');
      renderAdminList();
    } catch (e) {
      showToast(e.message || 'Could not add item.', 'error');
    } finally {
      addBtn.disabled = false;
    }
  });
}

async function renderAdminList() {
  const listEl = document.getElementById('adminList');
  try {
    const products = await getProducts();
    if (!products.length) { listEl.innerHTML = '<p style="color:var(--muted);">No items yet.</p>'; return; }

    listEl.innerHTML = products.map(p => {
      const images = getProductImages(p);
      const thumb = images[0]
        ? `<img src="${images[0]}" class="admin-row__thumb" alt="">`
        : `<span class="admin-row__thumb admin-row__thumb--empty" style="display:inline-block;"></span>`;
      const stock = getProductStock(p);
      const stockLabel = stock === Infinity ? '' : stock > 0
        ? ` <span class="stock-pill">${stock} in stock</span>`
        : ` <span class="stock-pill stock-pill--out">Out of stock</span>`;
      return `
        <div class="admin-row" data-id="${p.id}">
          <span style="display:flex;align-items:center;gap:0.6rem;">${thumb}${p.name} — ${formatPrice(p.price, p.currency)}${stockLabel}</span>
          <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteProduct(btn.dataset.id);
        renderAdminList();
        showToast('Item removed');
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load items.</p>';
  }
}

/* ---------------------------------------------------------
   SOCIAL & CONTACT SETTINGS
   --------------------------------------------------------- */
async function setupSocialSettings() {
  const facebookInput = document.getElementById('facebookUrl');
  const instagramInput = document.getElementById('instagramUrl');
  const phoneInput = document.getElementById('contactPhone');
  const saveBtn = document.getElementById('saveSocialBtn');

  try {
    const settings = await getSiteSettings();
    facebookInput.value = settings.facebookUrl || '';
    instagramInput.value = settings.instagramUrl || '';
    phoneInput.value = settings.phone || '';
  } catch (e) {
    showToast('Could not load contact info.', 'error');
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await saveSiteSettings({
        facebookUrl: facebookInput.value.trim(),
        instagramUrl: instagramInput.value.trim(),
        phone: phoneInput.value.trim()
      });
      showToast('Contact info saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save contact info.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   HERO VIDEO
   --------------------------------------------------------- */
function setupHeroVideo() {
  const videoInput = document.getElementById('videoInput');
  const videoDrop = document.getElementById('videoDrop');
  const videoPreviewWrap = document.getElementById('videoPreviewWrap');
  const videoPreview = document.getElementById('videoPreview');
  const videoControls = document.getElementById('videoControls');
  const trimStart = document.getElementById('trimStart');
  const trimEnd = document.getElementById('trimEnd');
  const trimStartLabel = document.getElementById('trimStartLabel');
  const trimEndLabel = document.getElementById('trimEndLabel');
  const videoFit = document.getElementById('videoFit');
  const videoBrightness = document.getElementById('videoBrightness');
  const saveVideoBtn = document.getElementById('saveVideoBtn');
  const removeVideoBtn = document.getElementById('removeVideoBtn');

  let pendingVideoDataUrl = null;

  function fmtSecs(s) { return Math.round(s * 10) / 10 + 's'; }
  function applyPreviewStyle() {
    videoPreview.style.objectFit = videoFit.value;
    videoPreview.style.filter = `brightness(${videoBrightness.value / 100})`;
  }
  function showVideoControls() { videoPreviewWrap.style.display = ''; videoControls.style.display = ''; }

  function loadVideoIntoPreview(dataUrl, existingConfig) {
    pendingVideoDataUrl = dataUrl;
    videoPreview.src = dataUrl;
    showVideoControls();
    videoPreview.addEventListener('loadedmetadata', function onMeta() {
      videoPreview.removeEventListener('loadedmetadata', onMeta);
      const duration = videoPreview.duration || 0;
      trimStart.max = duration;
      trimEnd.max = duration;
      if (existingConfig) {
        trimStart.value = Math.min(existingConfig.start || 0, duration);
        trimEnd.value = Math.min(existingConfig.end || duration, duration);
        videoFit.value = existingConfig.fit || 'cover';
        videoBrightness.value = existingConfig.brightness ?? 45;
      } else {
        trimStart.value = 0;
        trimEnd.value = duration;
      }
      trimStartLabel.textContent = fmtSecs(Number(trimStart.value));
      trimEndLabel.textContent = fmtSecs(Number(trimEnd.value));
      applyPreviewStyle();
    }, { once: true });
  }

  videoInput.addEventListener('change', () => {
    const file = videoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { showToast('Please choose a video file.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('That video is over 20MB — compress it first or it may fail to save.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => loadVideoIntoPreview(e.target.result, null);
    reader.readAsDataURL(file);
  });

  ['dragover', 'dragenter'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.remove('is-dragover'); }));
  videoDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('video/')) return;
    if (file.size > 20 * 1024 * 1024) { showToast('That video is over 20MB — compress it first.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => loadVideoIntoPreview(ev.target.result, null);
    reader.readAsDataURL(file);
  });

  trimStart.addEventListener('input', () => {
    if (Number(trimStart.value) >= Number(trimEnd.value)) trimStart.value = Math.max(0, Number(trimEnd.value) - 0.5);
    trimStartLabel.textContent = fmtSecs(Number(trimStart.value));
    videoPreview.currentTime = Number(trimStart.value);
  });
  trimEnd.addEventListener('input', () => {
    if (Number(trimEnd.value) <= Number(trimStart.value)) trimEnd.value = Number(trimStart.value) + 0.5;
    trimEndLabel.textContent = fmtSecs(Number(trimEnd.value));
  });
  videoFit.addEventListener('change', applyPreviewStyle);
  videoBrightness.addEventListener('input', applyPreviewStyle);
  videoPreview.addEventListener('timeupdate', () => {
    const end = Number(trimEnd.value);
    if (end && videoPreview.currentTime >= end) videoPreview.currentTime = Number(trimStart.value);
  });

  saveVideoBtn.addEventListener('click', async () => {
    if (!pendingVideoDataUrl) { showToast('Choose a video first.', 'error'); return; }
    saveVideoBtn.disabled = true;
    try {
      await saveHeroVideo({
        dataUrl: pendingVideoDataUrl,
        start: Number(trimStart.value),
        end: Number(trimEnd.value),
        fit: videoFit.value,
        brightness: Number(videoBrightness.value)
      });
      showToast('Homepage video saved', 'success');
    } catch (e) {
      showToast(e.message || 'Video is too large — try a shorter/more compressed clip.', 'error');
    } finally {
      saveVideoBtn.disabled = false;
    }
  });

  removeVideoBtn.addEventListener('click', async () => {
    await removeHeroVideo();
    pendingVideoDataUrl = null;
    videoInput.value = '';
    videoPreview.src = '';
    videoPreviewWrap.style.display = 'none';
    videoControls.style.display = 'none';
    showToast('Homepage video removed — the placeholder will show instead');
  });

  (async function initExistingVideo() {
    const existing = await getHeroVideo();
    if (existing && existing.dataUrl) loadVideoIntoPreview(existing.dataUrl, existing);
  })();
}
