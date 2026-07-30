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
  setupMediaLibrary();
  renderAdminList();
  setupImageUpload();
  setupAddProduct();
  setupHeroVideo();
  setupAnnouncementBar();
  setupPaymentMethods();
  setupSocialSettings();
  setupLearnMoreSection();
  setupCollectionStories();
  setupEditorial();
  renderReviewsAdmin();
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
// Renders the customer's shared GPS pin (if any) as a clickable
// Google Maps link plus the reverse-geocoded address the checkout
// page resolved, so the owner can hand this straight to a courier
// instead of just seeing "(GPS shared)".
function orderLocationHtml(loc) {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return '';
  const mapsUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  return `
    <p style="color:var(--muted);font-size:0.8rem;background:rgba(10,10,10,0.04);border-left:2px solid var(--red);padding:0.4rem 0.6rem;border-radius:4px;">
      &#128205; <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:var(--red);font-weight:600;">Open exact location in Google Maps</a>
      ${loc.address ? `<br><span>${loc.address}</span>` : ''}
    </p>
  `;
}

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
          ${formatDate(o.createdAt)} &middot; ${o.phone} &middot; ${o.address}
        </p>
        ${orderLocationHtml(o.location)}
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

  addLibraryButton(uploadDrop, 'image', (item) => {
    if (pendingImages.length >= MAX_PRODUCT_IMAGES) { showToast(`Up to ${MAX_PRODUCT_IMAGES} photos per item.`, 'error'); return; }
    pendingImages.push(item.url);
    renderImagePreview();
  });
}

/* ---------------------------------------------------------
   ADD / EDIT PRODUCT
   --------------------------------------------------------- */
let editingProductId = null; // null = "add" mode, otherwise editing this product's id

function fillProductForm(p) {
  document.getElementById('name').value = p.name || '';
  document.getElementById('category').value = p.category || 'Rings';
  document.getElementById('price').value = p.price != null ? p.price : '';
  document.getElementById('currency').value = p.currency || 'USD';
  document.getElementById('stock').value = (p.stock === null || p.stock === undefined) ? '' : p.stock;
  document.getElementById('description').value = p.description || '';
  document.getElementById('badge').value = p.badge || '';
  document.getElementById('sku').value = p.sku || '';
  document.getElementById('material').value = p.material || '';
  document.getElementById('size').value = p.size || '';
  document.getElementById('weight').value = p.weight || '';
  document.getElementById('warranty').value = p.warranty || '';
  document.getElementById('deliveryInfo').value = p.deliveryInfo || '';
  pendingImages = getProductImages(p).slice();
  window._renderImagePreview();
}

function clearProductForm() {
  ['name', 'price', 'description', 'badge', 'stock', 'sku', 'material', 'size', 'weight', 'warranty', 'deliveryInfo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('category').value = 'Rings';
  document.getElementById('currency').value = 'USD';
  pendingImages = [];
  window._renderImagePreview();
  document.getElementById('imageInput').value = '';
}

function enterEditMode(p) {
  editingProductId = p.id;
  fillProductForm(p);
  document.getElementById('productFormHeading').textContent = `Editing "${p.name}"`;
  document.getElementById('addBtn').textContent = 'Save changes';
  document.getElementById('cancelEditBtn').style.display = '';
  document.getElementById('productFormHeading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  editingProductId = null;
  clearProductForm();
  document.getElementById('productFormHeading').textContent = 'Add an item';
  document.getElementById('addBtn').textContent = 'Add to shop';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

function setupAddProduct() {
  document.getElementById('cancelEditBtn').addEventListener('click', exitEditMode);

  document.getElementById('addBtn').addEventListener('click', async () => {
    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const currency = document.getElementById('currency').value;
    const description = document.getElementById('description').value.trim();
    const badge = document.getElementById('badge').value;
    const stockRaw = document.getElementById('stock').value;
    const sku = document.getElementById('sku').value.trim();
    const material = document.getElementById('material').value.trim();
    const size = document.getElementById('size').value.trim();
    const weight = document.getElementById('weight').value.trim();
    const warranty = document.getElementById('warranty').value.trim();
    const deliveryInfo = document.getElementById('deliveryInfo').value.trim();

    if (!name || isNaN(price) || price <= 0) { showToast('Please add a name and a valid price.', 'error'); return; }

    const payload = { name, category, price, currency, description, badge, stock: stockRaw === '' ? null : stockRaw, images: pendingImages, sku, material, size, weight, warranty, deliveryInfo };

    const addBtn = document.getElementById('addBtn');
    addBtn.disabled = true;
    try {
      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        showToast('Item updated', 'success');
        exitEditMode();
      } else {
        await addProduct(payload);
        clearProductForm();
        showToast('Item added to the shop', 'success');
      }
      renderAdminList();
    } catch (e) {
      showToast(e.message || 'Could not save item.', 'error');
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
          <span style="display:flex;gap:0.5rem;">
            <button type="button" class="btn btn--ghost edit-btn" data-id="${p.id}" style="width:auto;padding:0.4rem 0.9rem;">Edit</button>
            <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
          </span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const p = await getProduct(btn.dataset.id);
          enterEditMode(p);
        } catch (e) {
          showToast('Could not load that item for editing.', 'error');
        }
      });
    });
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteProduct(btn.dataset.id);
        if (editingProductId === Number(btn.dataset.id)) exitEditMode();
        renderAdminList();
        showToast('Item removed');
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load items.</p>';
  }
}

/* ---------------------------------------------------------
   REVIEWS MODERATION (Part 3, this batch)
   --------------------------------------------------------- */
async function renderReviewsAdmin() {
  const listEl = document.getElementById('reviewsAdminList');
  if (!listEl) return;
  try {
    const reviews = await getReviewsAdmin();
    if (!reviews.length) { listEl.innerHTML = '<p style="color:var(--muted);">No reviews yet.</p>'; return; }
    listEl.innerHTML = reviews.map(r => `
      <div class="admin-row" style="flex-direction:column;align-items:stretch;gap:0.4rem;padding:0.8rem;border:1px solid #2a2a2a;border-radius:6px;margin-bottom:0.6rem;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
          <strong>${r.name} &mdash; ${'&#9733;'.repeat(r.rating)}${'&#9734;'.repeat(5 - r.rating)}</strong>
          <span class="stock-pill${r.approved ? '' : ' stock-pill--out'}">${r.approved ? 'Approved' : 'Pending'}</span>
        </div>
        <p style="color:var(--muted);font-size:0.78rem;">${r.productName || 'Unknown item'} &middot; ${formatDate(r.createdAt)}</p>
        ${r.comment ? `<p style="font-size:0.85rem;">${r.comment}</p>` : ''}
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="btn btn--ghost approve-review-btn" data-id="${r.id}" data-approved="${r.approved}" style="width:auto;padding:0.35rem 0.8rem;font-size:0.78rem;">${r.approved ? 'Unapprove' : 'Approve'}</button>
          <button type="button" class="delete-btn delete-review-btn" data-id="${r.id}">Delete</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.approve-review-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await setReviewApproved(btn.dataset.id, btn.dataset.approved !== 'true');
          renderReviewsAdmin();
        } catch (e) {
          showToast('Could not update that review.', 'error');
        }
      });
    });
    listEl.querySelectorAll('.delete-review-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteReview(btn.dataset.id);
        renderReviewsAdmin();
        showToast('Review removed');
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load reviews.</p>';
  }
}

/* ---------------------------------------------------------
   SOCIAL & CONTACT SETTINGS
   --------------------------------------------------------- */
async function setupSocialSettings() {
  const facebookInput = document.getElementById('facebookUrl');
  const instagramInput = document.getElementById('instagramUrl');
  const phoneInput = document.getElementById('contactPhone');
  const aboutInput = document.getElementById('aboutText');
  const brandNameInput = document.getElementById('brandNameInput');
  const heroTaglineInput = document.getElementById('heroTaglineInput');
  const saveBtn = document.getElementById('saveSocialBtn');

  try {
    const settings = await getSiteSettings();
    facebookInput.value = settings.facebookUrl || '';
    instagramInput.value = settings.instagramUrl || '';
    phoneInput.value = settings.phone || '';
    aboutInput.value = settings.aboutText || '';
    brandNameInput.value = settings.brandName || '';
    heroTaglineInput.value = settings.heroTagline || '';
  } catch (e) {
    showToast('Could not load contact info.', 'error');
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await saveSiteSettings({
        facebookUrl: facebookInput.value.trim(),
        instagramUrl: instagramInput.value.trim(),
        phone: phoneInput.value.trim(),
        aboutText: aboutInput.value.trim(),
        brandName: brandNameInput.value.trim(),
        heroTagline: heroTaglineInput.value.trim()
      });
      // Clear the client-side session cache so this tab's own nav/logo
      // (and any other THORN tab open in this session) picks up the
      // change on next reload instead of showing the stale cached name.
      try { sessionStorage.removeItem('thornBrandSettingsCache'); } catch (e) {}
      showToast('Contact info saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save contact info.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   LEARN MORE SECTION
   --------------------------------------------------------- */
function setupLearnMoreSection() {
  const enabledInput = document.getElementById('lmEnabled');
  const titleInput = document.getElementById('lmTitleInput');
  const subtitleInput = document.getElementById('lmSubtitleInput');
  const descriptionInput = document.getElementById('lmDescriptionInput');
  const quoteInput = document.getElementById('lmQuoteInput');
  const buttonTextInput = document.getElementById('lmButtonTextInput');
  const buttonUrlInput = document.getElementById('lmButtonUrlInput');
  const displayOrderInput = document.getElementById('lmDisplayOrderInput');
  const accentColorInput = document.getElementById('lmAccentColorInput');
  const bgTypeImageBtn = document.getElementById('lmBgTypeImageBtn');
  const bgTypeVideoBtn = document.getElementById('lmBgTypeVideoBtn');
  const bgImageWrap = document.getElementById('lmBgImageWrap');
  const bgVideoWrap = document.getElementById('lmBgVideoWrap');
  const imageInput = document.getElementById('lmImageInput');
  const imageDrop = document.getElementById('lmImageDrop');
  const videoInput = document.getElementById('lmVideoInput');
  const videoDrop = document.getElementById('lmVideoDrop');
  const saveBtn = document.getElementById('saveLearnMoreBtn');

  const preview = document.getElementById('lmPreview');
  const previewBg = document.getElementById('lmPreviewBg');
  const previewSubtitle = document.getElementById('lmPreviewSubtitle');
  const previewTitle = document.getElementById('lmPreviewTitle');
  const previewDescription = document.getElementById('lmPreviewDescription');
  const previewQuote = document.getElementById('lmPreviewQuote');
  const previewBtn = document.getElementById('lmPreviewBtn');

  let bgType = 'image';
  let bgDataUrl = '';

  function setBgType(type) {
    bgType = type;
    bgTypeImageBtn.classList.toggle('is-active', type === 'image');
    bgTypeVideoBtn.classList.toggle('is-active', type === 'video');
    bgImageWrap.style.display = type === 'image' ? '' : 'none';
    bgVideoWrap.style.display = type === 'video' ? '' : 'none';
    refreshPreview();
  }

  function refreshPreview() {
    previewSubtitle.textContent = subtitleInput.value.trim();
    previewTitle.textContent = titleInput.value.trim() || 'Section title';
    previewDescription.textContent = descriptionInput.value.trim();
    previewQuote.textContent = quoteInput.value.trim() ? `\u201C${quoteInput.value.trim()}\u201D` : '';
    previewBtn.textContent = buttonTextInput.value.trim();
    preview.style.setProperty('--lm-accent', accentColorInput.value || '#ffffff');
    // The mini preview only visualizes image backgrounds — a real
    // video background is easiest to judge live on the actual page.
    previewBg.style.backgroundImage = (bgType === 'image' && bgDataUrl) ? `url("${bgDataUrl}")` : 'none';
  }

  [titleInput, subtitleInput, descriptionInput, quoteInput, buttonTextInput, accentColorInput].forEach(el => {
    el.addEventListener('input', refreshPreview);
  });

  bgTypeImageBtn.addEventListener('click', () => setBgType('image'));
  bgTypeVideoBtn.addEventListener('click', () => setBgType('video'));

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    compressImageFile(file, 1920, 0.85)
      .then(dataUrl => { bgDataUrl = dataUrl; refreshPreview(); })
      .catch(() => showToast('Could not process that photo.', 'error'));
  }
  imageInput.addEventListener('change', () => loadImageFile(imageInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.remove('is-dragover'); }));
  imageDrop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) loadImageFile(e.dataTransfer.files[0]); });

  function loadVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) { if (file) showToast('Please choose a video file.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('That video is over 20MB — compress it first or it may fail to save.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { bgDataUrl = e.target.result; refreshPreview(); showToast('Video ready — click Save to publish it.'); };
    reader.readAsDataURL(file);
  }
  videoInput.addEventListener('change', () => loadVideoFile(videoInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.remove('is-dragover'); }));
  videoDrop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; loadVideoFile(f); });

  addLibraryButton(imageDrop, 'image', (item) => { bgDataUrl = item.url; refreshPreview(); });
  addLibraryButton(videoDrop, 'video', (item) => { bgDataUrl = item.url; refreshPreview(); showToast('Video ready — click Save to publish it.'); });

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (enabledInput.checked && !title) {
      showToast('Add a section title before enabling it.', 'error');
      return;
    }
    saveBtn.disabled = true;
    try {
      await saveLearnMoreSection({
        title,
        subtitle: subtitleInput.value.trim(),
        description: descriptionInput.value.trim(),
        quote: quoteInput.value.trim(),
        buttonText: buttonTextInput.value.trim(),
        buttonUrl: buttonUrlInput.value.trim(),
        bgType,
        bgDataUrl,
        enabled: enabledInput.checked,
        displayOrder: parseInt(displayOrderInput.value, 10) || 0,
        accentColor: accentColorInput.value || ''
      });
      showToast('Learn More section saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save — try a smaller background file.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  (async function loadExisting() {
    try {
      const data = await getLearnMoreSection();
      if (!data) return;
      enabledInput.checked = !!data.enabled;
      titleInput.value = data.title || '';
      subtitleInput.value = data.subtitle || '';
      descriptionInput.value = data.description || '';
      quoteInput.value = data.quote || '';
      buttonTextInput.value = data.buttonText || '';
      buttonUrlInput.value = data.buttonUrl || '';
      displayOrderInput.value = data.displayOrder || 0;
      accentColorInput.value = data.accentColor || '#ffffff';
      bgDataUrl = data.bgDataUrl || '';
      setBgType(data.bgType === 'video' ? 'video' : 'image');
      refreshPreview();
    } catch (e) {
      showToast('Could not load the Learn More section.', 'error');
    }
  })();
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

  addLibraryButton(videoDrop, 'video', (item) => loadVideoIntoPreview(item.url, null));
}

/* ---------------------------------------------------------
   PAYMENT METHODS (brief Part 3)
   Cash on Delivery / Vodafone Cash / InstaPay / Visa / Mastercard —
   enable, reorder (up/down), and edit each method's own config.
   The whole list is re-rendered from `pmState` on every change so
   the up/down buttons and disabled-first/last states stay correct,
   then saved to the server as one array via PUT /api/payment-methods.
   --------------------------------------------------------- */
let pmState = [];

const PM_LABELS = {
  cod: { label: 'Cash on Delivery', hint: 'Always available — no extra configuration needed.' },
  vodafone_cash: { label: 'Vodafone Cash', hint: 'Customers pay to this number, then can attach a reference/screenshot with their order.' },
  instapay: { label: 'InstaPay', hint: 'Customers pay to this username, then can attach a reference/screenshot with their order.' },
  visa: { label: 'Visa', hint: 'Placeholder only — shows as "coming soon" to customers until Stripe keys are added.' },
  mastercard: { label: 'Mastercard', hint: 'Placeholder only — shows as "coming soon" to customers until Stripe keys are added.' }
};

function pmFieldsHtml(m) {
  const cfg = m.config || {};
  if (m.id === 'vodafone_cash') {
    return `
      <div class="field field--inline-select">
        <div>
          <label>Phone number</label>
          <input type="text" class="pm-input" data-field="phone" value="${(cfg.phone || '').replace(/"/g, '&quot;')}" placeholder="e.g. 010 1234 5678">
        </div>
        <div>
          <label>Account holder name</label>
          <input type="text" class="pm-input" data-field="accountHolder" value="${(cfg.accountHolder || '').replace(/"/g, '&quot;')}" placeholder="Name on the account">
        </div>
      </div>
      ${pmQrHtml(m, cfg)}
    `;
  }
  if (m.id === 'instapay') {
    return `
      <div class="field">
        <label>InstaPay username</label>
        <input type="text" class="pm-input" data-field="username" value="${(cfg.username || '').replace(/"/g, '&quot;')}" placeholder="e.g. @yourbrand">
      </div>
      ${pmQrHtml(m, cfg)}
    `;
  }
  return `<p style="color:var(--muted);font-size:0.82rem;">${PM_LABELS[m.id] ? PM_LABELS[m.id].hint : ''}</p>`;
}

function pmQrHtml(m, cfg) {
  return `
    <div class="field">
      <label>QR code image (optional)</label>
      <div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">
        ${cfg.qrDataUrl ? `<img src="${cfg.qrDataUrl}" alt="" style="width:64px;height:64px;object-fit:contain;background:#111;border-radius:6px;">` : ''}
        <label class="btn btn--ghost" style="width:auto;cursor:pointer;">
          Upload QR
          <input type="file" accept="image/*" class="pm-qr-input" style="display:none;">
        </label>
        <button type="button" class="btn btn--ghost pm-qr-library" style="width:auto;">Choose from library</button>
        ${cfg.qrDataUrl ? `<button type="button" class="btn btn--ghost pm-qr-remove" style="width:auto;">Remove</button>` : ''}
      </div>
    </div>
  `;
}

function renderPaymentMethods() {
  const list = document.getElementById('paymentMethodsList');
  if (!list) return;
  list.innerHTML = pmState.map((m, i) => `
    <div class="panel" style="background:var(--surface);border:1px solid #2a2a2a;margin-bottom:0.8rem;padding:1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:0.6rem;font-weight:600;">
          <input type="checkbox" class="pm-enabled" ${m.enabled ? 'checked' : ''}>
          ${PM_LABELS[m.id] ? PM_LABELS[m.id].label : m.name}
        </label>
        <div style="display:flex;gap:0.4rem;">
          <button type="button" class="btn btn--ghost pm-up" style="width:auto;padding:0.3rem 0.6rem;" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
          <button type="button" class="btn btn--ghost pm-down" style="width:auto;padding:0.3rem 0.6rem;" ${i === pmState.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
        </div>
      </div>
      <div style="margin-top:0.8rem;">
        ${pmFieldsHtml(m)}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.panel').forEach((card, i) => {
    const m = pmState[i];
    card.querySelector('.pm-enabled').addEventListener('change', (e) => { m.enabled = e.target.checked; });
    card.querySelector('.pm-up').addEventListener('click', () => {
      if (i === 0) return;
      [pmState[i - 1], pmState[i]] = [pmState[i], pmState[i - 1]];
      renderPaymentMethods();
    });
    card.querySelector('.pm-down').addEventListener('click', () => {
      if (i === pmState.length - 1) return;
      [pmState[i + 1], pmState[i]] = [pmState[i], pmState[i + 1]];
      renderPaymentMethods();
    });
    card.querySelectorAll('.pm-input').forEach((input) => {
      input.addEventListener('input', () => {
        m.config = m.config || {};
        m.config[input.dataset.field] = input.value;
      });
    });
    const qrInput = card.querySelector('.pm-qr-input');
    if (qrInput) {
      qrInput.addEventListener('change', async () => {
        const file = qrInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please choose an image file.', 'error'); return; }
        try {
          const dataUrl = await compressImageFile(file, 500, 0.85);
          m.config = m.config || {};
          m.config.qrDataUrl = dataUrl;
          renderPaymentMethods();
        } catch (e) {
          showToast('Could not read that image.', 'error');
        }
      });
    }
    const qrRemove = card.querySelector('.pm-qr-remove');
    if (qrRemove) {
      qrRemove.addEventListener('click', () => {
        m.config = m.config || {};
        m.config.qrDataUrl = '';
        renderPaymentMethods();
      });
    }
    // Media Library (item 12): reuse an already-uploaded QR image
    // instead of uploading the same file again.
    const qrLibraryBtn = card.querySelector('.pm-qr-library');
    if (qrLibraryBtn) {
      qrLibraryBtn.addEventListener('click', () => {
        openMediaPicker((item) => {
          m.config = m.config || {};
          m.config.qrDataUrl = item.url;
          renderPaymentMethods();
        }, 'image');
      });
    }
  });
}

function setupPaymentMethods() {
  const saveBtn = document.getElementById('savePaymentMethodsBtn');
  if (!saveBtn) return;

  (async function initPaymentMethods() {
    try {
      pmState = await getPaymentMethodsAdmin();
      renderPaymentMethods();
    } catch (e) {
      showToast('Could not load payment methods.', 'error');
    }
  })();

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      pmState = await savePaymentMethods(pmState.map((m, i) => ({ id: m.id, enabled: m.enabled, sortOrder: i, config: m.config || {} })));
      renderPaymentMethods();
      showToast('Payment methods saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save payment methods.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   COLLECTION STORIES (brief Part 9)
   --------------------------------------------------------- */
let csMediaType = 'image';
let csMediaDataUrl = '';
let csSecondaryDataUrl = '';

function setupCollectionStories() {
  const titleInput = document.getElementById('csTitleInput');
  const moodInput = document.getElementById('csMoodInput');
  const storyInput = document.getElementById('csStoryInput');
  const displayOrderInput = document.getElementById('csDisplayOrderInput');
  const linkUrlInput = document.getElementById('csLinkUrlInput');
  const enabledInput = document.getElementById('csEnabled');
  const mediaTypeImageBtn = document.getElementById('csMediaTypeImageBtn');
  const mediaTypeVideoBtn = document.getElementById('csMediaTypeVideoBtn');
  const mediaImageWrap = document.getElementById('csMediaImageWrap');
  const mediaVideoWrap = document.getElementById('csMediaVideoWrap');
  const imageInput = document.getElementById('csImageInput');
  const imageDrop = document.getElementById('csImageDrop');
  const videoInput = document.getElementById('csVideoInput');
  const videoDrop = document.getElementById('csVideoDrop');
  const mediaPreview = document.getElementById('csMediaPreview');
  const secondaryInput = document.getElementById('csSecondaryImageInput');
  const secondaryDrop = document.getElementById('csSecondaryImageDrop');
  const secondaryPreview = document.getElementById('csSecondaryPreview');
  const addBtn = document.getElementById('addCollectionStoryBtn');

  function setMediaType(type) {
    csMediaType = type;
    mediaTypeImageBtn.classList.toggle('is-active', type === 'image');
    mediaTypeVideoBtn.classList.toggle('is-active', type === 'video');
    mediaImageWrap.style.display = type === 'image' ? '' : 'none';
    mediaVideoWrap.style.display = type === 'video' ? '' : 'none';
  }
  mediaTypeImageBtn.addEventListener('click', () => setMediaType('image'));
  mediaTypeVideoBtn.addEventListener('click', () => setMediaType('video'));

  function renderMediaPreview() {
    mediaPreview.innerHTML = csMediaDataUrl ? `<div class="image-thumb"><img src="${csMediaDataUrl}" alt=""></div>` : '';
  }
  function renderSecondaryPreview() {
    secondaryPreview.innerHTML = csSecondaryDataUrl ? `<div class="image-thumb"><img src="${csSecondaryDataUrl}" alt=""></div>` : '';
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    compressImageFile(file, 1920, 0.85)
      .then(url => { csMediaDataUrl = url; renderMediaPreview(); })
      .catch(() => showToast('Could not process that photo.', 'error'));
  }
  imageInput.addEventListener('change', () => loadImage(imageInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.remove('is-dragover'); }));
  imageDrop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) loadImage(e.dataTransfer.files[0]); });

  function loadVideo(file) {
    if (!file || !file.type.startsWith('video/')) { if (file) showToast('Please choose a video file.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('That video is over 20MB — compress it first.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { csMediaDataUrl = e.target.result; renderMediaPreview(); };
    reader.readAsDataURL(file);
  }
  videoInput.addEventListener('change', () => loadVideo(videoInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.remove('is-dragover'); }));
  videoDrop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; loadVideo(f); });

  secondaryInput.addEventListener('change', () => {
    const file = secondaryInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    compressImageFile(file, 1200, 0.82)
      .then(url => { csSecondaryDataUrl = url; renderSecondaryPreview(); })
      .catch(() => showToast('Could not process that photo.', 'error'));
  });
  ['dragover', 'dragenter'].forEach(evt => secondaryDrop.addEventListener(evt, (e) => { e.preventDefault(); secondaryDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => secondaryDrop.addEventListener(evt, (e) => { e.preventDefault(); secondaryDrop.classList.remove('is-dragover'); }));
  secondaryDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    compressImageFile(file, 1200, 0.82)
      .then(url => { csSecondaryDataUrl = url; renderSecondaryPreview(); })
      .catch(() => showToast('Could not process that photo.', 'error'));
  });

  addLibraryButton(imageDrop, 'image', (item) => { csMediaDataUrl = item.url; renderMediaPreview(); });
  addLibraryButton(videoDrop, 'video', (item) => { csMediaDataUrl = item.url; renderMediaPreview(); });
  addLibraryButton(secondaryDrop, 'image', (item) => { csSecondaryDataUrl = item.url; renderSecondaryPreview(); });

  addBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { showToast('Give the collection a title.', 'error'); return; }
    addBtn.disabled = true;
    try {
      await addCollectionStory({
        title,
        mood: moodInput.value.trim(),
        story: storyInput.value.trim(),
        mediaType: csMediaType,
        mediaDataUrl: csMediaDataUrl,
        secondaryImageDataUrl: csSecondaryDataUrl,
        linkUrl: linkUrlInput.value.trim(),
        enabled: enabledInput.checked,
        displayOrder: parseInt(displayOrderInput.value, 10) || 0
      });
      titleInput.value = ''; moodInput.value = ''; storyInput.value = ''; linkUrlInput.value = ''; displayOrderInput.value = '';
      csMediaDataUrl = ''; csSecondaryDataUrl = '';
      renderMediaPreview(); renderSecondaryPreview();
      imageInput.value = ''; videoInput.value = ''; secondaryInput.value = '';
      showToast('Collection added', 'success');
      renderCollectionStoriesAdminList();
    } catch (e) {
      showToast(e.message || 'Could not add collection.', 'error');
    } finally {
      addBtn.disabled = false;
    }
  });

  renderCollectionStoriesAdminList();
}

async function renderCollectionStoriesAdminList() {
  const listEl = document.getElementById('collectionStoriesAdminList');
  try {
    const stories = await getCollectionStories(true);
    if (!stories.length) { listEl.innerHTML = '<p style="color:var(--muted);">No collections added yet.</p>'; return; }
    listEl.innerHTML = stories.map(s => `
      <div class="admin-row" data-id="${s.id}">
        <span style="display:flex;align-items:center;gap:0.6rem;">
          ${s.mediaDataUrl ? `<img src="${s.mediaDataUrl}" class="admin-row__thumb" alt="">` : `<span class="admin-row__thumb admin-row__thumb--empty" style="display:inline-block;"></span>`}
          ${s.title}${s.enabled ? '' : ' <span class="stock-pill stock-pill--out">Hidden</span>'}
        </span>
        <button type="button" class="delete-btn" data-id="${s.id}">Delete</button>
      </div>
    `).join('');
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteCollectionStory(btn.dataset.id);
        renderCollectionStoriesAdminList();
        showToast('Collection removed');
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load collections.</p>';
  }
}

/* ---------------------------------------------------------
   EDITORIAL (brief Part 10)
   --------------------------------------------------------- */
let edKind = 'image';
let edMediaDataUrl = '';

function setupEditorial() {
  const kindImageBtn = document.getElementById('edKindImageBtn');
  const kindVideoBtn = document.getElementById('edKindVideoBtn');
  const kindQuoteBtn = document.getElementById('edKindQuoteBtn');
  const mediaWrap = document.getElementById('edMediaWrap');
  const imageField = document.getElementById('edImageField');
  const videoField = document.getElementById('edVideoField');
  const quoteWrap = document.getElementById('edQuoteWrap');
  const imageInput = document.getElementById('edImageInput');
  const imageDrop = document.getElementById('edImageDrop');
  const videoInput = document.getElementById('edVideoInput');
  const videoDrop = document.getElementById('edVideoDrop');
  const mediaPreview = document.getElementById('edMediaPreview');
  const captionInput = document.getElementById('edCaptionInput');
  const quoteTextInput = document.getElementById('edQuoteTextInput');
  const quoteAuthorInput = document.getElementById('edQuoteAuthorInput');
  const sizeInput = document.getElementById('edSizeInput');
  const displayOrderInput = document.getElementById('edDisplayOrderInput');
  const enabledInput = document.getElementById('edEnabled');
  const addBtn = document.getElementById('addEditorialItemBtn');

  function setKind(kind) {
    edKind = kind;
    kindImageBtn.classList.toggle('is-active', kind === 'image');
    kindVideoBtn.classList.toggle('is-active', kind === 'video');
    kindQuoteBtn.classList.toggle('is-active', kind === 'quote');
    mediaWrap.style.display = kind === 'quote' ? 'none' : '';
    quoteWrap.style.display = kind === 'quote' ? '' : 'none';
    imageField.style.display = kind === 'image' ? '' : 'none';
    videoField.style.display = kind === 'video' ? '' : 'none';
  }
  kindImageBtn.addEventListener('click', () => setKind('image'));
  kindVideoBtn.addEventListener('click', () => setKind('video'));
  kindQuoteBtn.addEventListener('click', () => setKind('quote'));

  function renderMediaPreview() {
    mediaPreview.innerHTML = edMediaDataUrl ? `<div class="image-thumb"><img src="${edMediaDataUrl}" alt=""></div>` : '';
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    compressImageFile(file, 1920, 0.85)
      .then(url => { edMediaDataUrl = url; renderMediaPreview(); })
      .catch(() => showToast('Could not process that photo.', 'error'));
  }
  imageInput.addEventListener('change', () => loadImage(imageInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => imageDrop.addEventListener(evt, (e) => { e.preventDefault(); imageDrop.classList.remove('is-dragover'); }));
  imageDrop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) loadImage(e.dataTransfer.files[0]); });

  function loadVideo(file) {
    if (!file || !file.type.startsWith('video/')) { if (file) showToast('Please choose a video file.', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('That video is over 20MB — compress it first.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { edMediaDataUrl = e.target.result; renderMediaPreview(); };
    reader.readAsDataURL(file);
  }
  videoInput.addEventListener('change', () => loadVideo(videoInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.remove('is-dragover'); }));
  videoDrop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; loadVideo(f); });

  addLibraryButton(imageDrop, 'image', (item) => { edMediaDataUrl = item.url; renderMediaPreview(); });
  addLibraryButton(videoDrop, 'video', (item) => { edMediaDataUrl = item.url; renderMediaPreview(); });

  addBtn.addEventListener('click', async () => {
    if (edKind === 'quote') {
      if (!quoteTextInput.value.trim()) { showToast('Write the quote text.', 'error'); return; }
    } else if (!edMediaDataUrl) {
      showToast('Choose a photo or video first.', 'error');
      return;
    }
    addBtn.disabled = true;
    try {
      await addEditorialItem({
        kind: edKind,
        mediaDataUrl: edMediaDataUrl,
        caption: captionInput.value.trim(),
        quoteText: quoteTextInput.value.trim(),
        quoteAuthor: quoteAuthorInput.value.trim(),
        size: sizeInput.value,
        enabled: enabledInput.checked,
        displayOrder: parseInt(displayOrderInput.value, 10) || 0
      });
      captionInput.value = ''; quoteTextInput.value = ''; quoteAuthorInput.value = ''; displayOrderInput.value = '';
      edMediaDataUrl = '';
      renderMediaPreview();
      imageInput.value = ''; videoInput.value = '';
      showToast('Added to editorial', 'success');
      renderEditorialAdminList();
    } catch (e) {
      showToast(e.message || 'Could not add that.', 'error');
    } finally {
      addBtn.disabled = false;
    }
  });

  renderEditorialAdminList();
}

async function renderEditorialAdminList() {
  const listEl = document.getElementById('editorialAdminList');
  try {
    const items = await getEditorialItems(true);
    if (!items.length) { listEl.innerHTML = '<p style="color:var(--muted);">No editorial items added yet.</p>'; return; }
    listEl.innerHTML = items.map(it => {
      const label = it.kind === 'quote'
        ? `&ldquo;${(it.quoteText || '').slice(0, 40)}${it.quoteText && it.quoteText.length > 40 ? '…' : ''}&rdquo;`
        : (it.caption || (it.kind === 'video' ? 'Video' : 'Photo'));
      const thumb = it.kind !== 'quote' && it.mediaDataUrl
        ? `<img src="${it.mediaDataUrl}" class="admin-row__thumb" alt="">`
        : `<span class="admin-row__thumb admin-row__thumb--empty" style="display:inline-block;"></span>`;
      return `
        <div class="admin-row" data-id="${it.id}">
          <span style="display:flex;align-items:center;gap:0.6rem;">${thumb}${label}${it.enabled ? '' : ' <span class="stock-pill stock-pill--out">Hidden</span>'}</span>
          <button type="button" class="delete-btn" data-id="${it.id}">Delete</button>
        </div>
      `;
    }).join('');
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteEditorialItem(btn.dataset.id);
        renderEditorialAdminList();
        showToast('Item removed');
      });
    });
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--muted);">Could not load editorial items.</p>';
  }
}

/* ---------------------------------------------------------
   MEDIA LIBRARY (brief item 12, this batch)
   Upload once here, then reuse everywhere else in this dashboard
   via the "Choose from library" picker instead of re-uploading
   duplicates. addLibraryButton() is the one bit every other panel
   below (product photos, hero video, Learn More, collections,
   editorial, payment QR) calls to wire itself into this picker.
   --------------------------------------------------------- */
let mediaLibraryCache = [];

async function refreshMediaLibrary() {
  try { mediaLibraryCache = await getMediaLibrary(); } catch (e) { mediaLibraryCache = []; }
  return mediaLibraryCache;
}

function mediaThumbHtml(item, opts) {
  opts = opts || {};
  const inner = item.type === 'video'
    ? `<video src="${item.url}" muted playsinline></video>`
    : `<img src="${item.url}" alt="${(item.filename || '').replace(/"/g, '&quot;')}">`;
  return `
    <div class="media-library-item" data-id="${item.id}" title="${(item.filename || '').replace(/"/g, '&quot;')}">
      ${inner}
      ${opts.selectable ? '' : `<button type="button" class="media-library-item__remove" data-id="${item.id}" aria-label="Delete from library">&times;</button>`}
    </div>
  `;
}

async function renderMediaLibraryGrid() {
  const grid = document.getElementById('mediaLibraryGrid');
  if (!grid) return;
  await refreshMediaLibrary();
  if (!mediaLibraryCache.length) {
    grid.innerHTML = '<p style="color:var(--muted);">No media uploaded yet.</p>';
    return;
  }
  grid.innerHTML = mediaLibraryCache.map(m => mediaThumbHtml(m)).join('');
  grid.querySelectorAll('.media-library-item__remove').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteMedia(btn.dataset.id); });
  });
}

async function confirmDeleteMedia(id) {
  try {
    await deleteMedia(id, false);
    showToast('Deleted from library');
    renderMediaLibraryGrid();
  } catch (e) {
    if (e.status === 409 && e.data && Array.isArray(e.data.usages) && e.data.usages.length) {
      const list = e.data.usages.join(', ');
      const proceed = confirm(
        `Still used by: ${list}.\n\nDelete from the library anyway? Those spots will keep showing it until you replace it there.`
      );
      if (proceed) {
        try {
          await deleteMedia(id, true);
          showToast('Deleted from library');
          renderMediaLibraryGrid();
        } catch (e2) {
          showToast(e2.message || 'Could not delete that file.', 'error');
        }
      }
    } else {
      showToast(e.message || 'Could not delete that file.', 'error');
    }
  }
}

function setupMediaLibrary() {
  const input = document.getElementById('mediaLibraryInput');
  const drop = document.getElementById('mediaLibraryDrop');
  if (!input || !drop) return;

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      try {
        let dataUrl, type;
        if (file.type.startsWith('image/')) {
          dataUrl = await compressImageFile(file, 1600, 0.85);
          type = 'image';
        } else if (file.type.startsWith('video/')) {
          if (file.size > 20 * 1024 * 1024) { showToast(`"${file.name}" is over 20MB — compress it first.`, 'error'); continue; }
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          type = 'video';
        } else {
          continue; // not an image/video — skip silently
        }
        await uploadMedia({ filename: file.name, type, dataUrl, size: file.size });
      } catch (e) {
        showToast(`Could not upload "${file.name}".`, 'error');
      }
    }
    renderMediaLibraryGrid();
  }

  input.addEventListener('change', () => handleFiles(input.files));
  ['dragover', 'dragenter'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove('is-dragover'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files); });

  renderMediaLibraryGrid();

  const closeBtn = document.getElementById('mediaPickerClose');
  const modal = document.getElementById('mediaPickerModal');
  if (closeBtn) closeBtn.addEventListener('click', closeMediaPicker);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeMediaPicker(); });
}

// Opens the shared "Choose from library" modal, optionally filtered
// to one media type, and calls onSelect(item) with whatever the
// admin clicks. Every upload panel below wires a button into this
// instead of re-implementing its own picker.
function openMediaPicker(onSelect, filterType) {
  const modal = document.getElementById('mediaPickerModal');
  const grid = document.getElementById('mediaPickerGrid');
  if (!modal || !grid) return;

  grid.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  modal.classList.add('is-open');

  refreshMediaLibrary().then(() => {
    const items = filterType ? mediaLibraryCache.filter(m => m.type === filterType) : mediaLibraryCache;
    grid.innerHTML = items.length
      ? items.map(m => mediaThumbHtml(m, { selectable: true })).join('')
      : `<p style="color:var(--muted);">No ${filterType || 'media'} in the library yet — upload some in the Media Library panel above.</p>`;
    grid.querySelectorAll('.media-library-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = mediaLibraryCache.find(m => String(m.id) === el.dataset.id);
        if (item) { onSelect(item); closeMediaPicker(); }
      });
    });
  });
}

function closeMediaPicker() {
  const modal = document.getElementById('mediaPickerModal');
  if (modal) modal.classList.remove('is-open');
}

// Injects a "Choose from library" button right after an existing
// upload-drop element (idempotent — safe to call more than once).
function addLibraryButton(dropEl, filterType, onSelect) {
  if (!dropEl) return;
  const existing = dropEl.parentNode.querySelector(`.choose-from-library-btn[data-for="${dropEl.id}"]`);
  if (existing) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--ghost choose-from-library-btn';
  btn.dataset.for = dropEl.id;
  btn.style.cssText = 'width:auto;margin-top:0.6rem;';
  btn.textContent = 'Choose from library';
  btn.addEventListener('click', () => openMediaPicker(onSelect, filterType));
  dropEl.insertAdjacentElement('afterend', btn);
}

/* ---------------------------------------------------------
   ANNOUNCEMENT BAR (brief item 11, this batch)
   --------------------------------------------------------- */
function setupAnnouncementBar() {
  const enabledInput = document.getElementById('annEnabled');
  const textInput = document.getElementById('annTextInput');
  const linkInput = document.getElementById('annLinkInput');
  const bgColorInput = document.getElementById('annBgColorInput');
  const textColorInput = document.getElementById('annTextColorInput');
  const preview = document.getElementById('annPreview');
  const previewText = document.getElementById('annPreviewText');
  const saveBtn = document.getElementById('saveAnnouncementBtn');
  if (!saveBtn) return;

  function refreshPreview() {
    previewText.textContent = textInput.value.trim() || 'Announcement text';
    preview.style.setProperty('--ann-bg', bgColorInput.value || '#0a0a0a');
    preview.style.setProperty('--ann-text', textColorInput.value || '#f2eee7');
  }
  [textInput, bgColorInput, textColorInput].forEach(el => el.addEventListener('input', refreshPreview));

  saveBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (enabledInput.checked && !text) {
      showToast('Add some text before enabling the announcement bar.', 'error');
      return;
    }
    saveBtn.disabled = true;
    try {
      await saveAnnouncementBar({
        text,
        enabled: enabledInput.checked,
        linkUrl: linkInput.value.trim(),
        bgColor: bgColorInput.value,
        textColor: textColorInput.value
      });
      showToast('Announcement bar saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save the announcement bar.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  (async function loadExisting() {
    try {
      const data = await getAnnouncementBar();
      if (!data) return;
      enabledInput.checked = !!data.enabled;
      textInput.value = data.text || '';
      linkInput.value = data.linkUrl || '';
      bgColorInput.value = data.bgColor || '#0a0a0a';
      textColorInput.value = data.textColor || '#f2eee7';
      refreshPreview();
    } catch (e) {
      showToast('Could not load the announcement bar.', 'error');
    }
  })();
}
