/* ==========================================================
   admin.js — powers the owner dashboard (admin.html).
   Was missing entirely before, so the "Add to shop" button,
   photo upload, item list, and hero video controls did nothing.
   Everything here reads/writes through data.js so the shop page
   (index.html) picks up changes automatically — no server needed.
   ========================================================== */

/* ==========================================================
   0) STORAGE CHECK
   ========================================================== */
if (typeof checkStorageAndWarn === 'function') checkStorageAndWarn();

/* ---------------------------------------------------------
   1) PRODUCT PHOTO UPLOAD
   Reads each chosen file into a base64 data URL with FileReader
   (this is what lets a photo live entirely in localStorage,
   with no server to upload to) and shows a thumbnail preview.
   --------------------------------------------------------- */
let pendingImages = []; // base64 data URLs, in upload order (first = main)

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
    btn.addEventListener('click', () => {
      pendingImages.splice(Number(btn.dataset.i), 1);
      renderImagePreview();
    });
  });
}

function readFilesAsDataURLs(fileList) {
  const files = Array.from(fileList).slice(0, MAX_PRODUCT_IMAGES - pendingImages.length);
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    compressImageFile(file, 1280, 0.82)
      .then(dataUrl => {
        pendingImages.push(dataUrl);
        renderImagePreview();
      })
      .catch(() => showToast('Could not process that photo.', 'error'));
  });
}

// Resizes an image to maxDim on its longest side and re-encodes as JPEG.
// A full-resolution phone photo (often 3-8MB) becomes ~150-400KB, which
// is what actually makes pages slow/laggy and can silently blow past
// localStorage's mobile quota — this is the fix for both.
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

imageInput.addEventListener('change', () => readFilesAsDataURLs(imageInput.files));

// Drag & drop onto the dropzone
['dragover', 'dragenter'].forEach(evt => {
  uploadDrop.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadDrop.classList.add('is-dragover');
  });
});
['dragleave', 'drop'].forEach(evt => {
  uploadDrop.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadDrop.classList.remove('is-dragover');
  });
});
uploadDrop.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) readFilesAsDataURLs(e.dataTransfer.files);
});


/* ---------------------------------------------------------
   2) ADD PRODUCT
   --------------------------------------------------------- */
document.getElementById('addBtn').addEventListener('click', () => {
  const name = document.getElementById('name').value.trim();
  const category = document.getElementById('category').value;
  const price = parseFloat(document.getElementById('price').value);
  const currency = document.getElementById('currency').value;
  const description = document.getElementById('description').value.trim();
  const badge = document.getElementById('badge').value;
  const stockRaw = document.getElementById('stock').value;
  const stock = stockRaw === '' ? null : Math.max(0, parseInt(stockRaw, 10));

  if (!name || isNaN(price) || price <= 0) {
    showToast('Please add a name and a valid price.', 'error');
    return;
  }
  if (stockRaw !== '' && isNaN(stock)) {
    showToast('Stock must be a number, or left blank.', 'error');
    return;
  }

  const saved = addProduct({ name, category, price, currency, description, badge, stock, images: pendingImages });

  // Reset the form for the next item
  document.getElementById('name').value = '';
  document.getElementById('price').value = '';
  document.getElementById('description').value = '';
  document.getElementById('badge').value = '';
  document.getElementById('stock').value = '';
  pendingImages = [];
  renderImagePreview();
  imageInput.value = '';

  if (saved) {
    showToast('Item added to the shop', 'success');
  } else {
    showToast('Item added for this session, but did NOT save permanently — see the banner above.', 'error');
  }
  renderAdminList();
});


/* ---------------------------------------------------------
   3) CURRENT ITEMS LIST
   --------------------------------------------------------- */
function renderAdminList() {
  const products = getProducts();
  const listEl = document.getElementById('adminList');

  if (!products.length) {
    listEl.innerHTML = '<p style="color:var(--muted);">No items yet.</p>';
    return;
  }

  listEl.innerHTML = products.map(p => {
    const images = getProductImages(p);
    const thumb = images[0]
      ? `<img src="${images[0]}" class="admin-row__thumb" alt="">`
      : `<span class="admin-row__thumb admin-row__thumb--empty" style="display:inline-block;"></span>`;
    const stock = getProductStock(p);
    const stockLabel = stock === Infinity
      ? ''
      : stock > 0
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
    btn.addEventListener('click', () => {
      deleteProduct(btn.dataset.id);
      renderAdminList();
      showToast('Item removed');
    });
  });
}
renderAdminList();


/* ---------------------------------------------------------
   4) HERO VIDEO — upload, trim, display style, brightness
   Stored as a base64 data URL in localStorage via data.js, so
   the owner never edits index.html to change the homepage clip.
   --------------------------------------------------------- */
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

function fmtSecs(s) {
  return Math.round(s * 10) / 10 + 's';
}

function applyPreviewStyle() {
  videoPreview.style.objectFit = videoFit.value;
  videoPreview.style.filter = `brightness(${videoBrightness.value / 100})`;
}

function showVideoControls() {
  videoPreviewWrap.style.display = '';
  videoControls.style.display = '';
}

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
  if (!file.type.startsWith('video/')) {
    showToast('Please choose a video file.', 'error');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('That video is over 20MB — compress it first (e.g. HandBrake or an online compressor) or it will make the site slow and may fail to save.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => loadVideoIntoPreview(e.target.result, null);
  reader.readAsDataURL(file);
});

['dragover', 'dragenter'].forEach(evt => {
  videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.add('is-dragover'); });
});
['dragleave', 'drop'].forEach(evt => {
  videoDrop.addEventListener(evt, (e) => { e.preventDefault(); videoDrop.classList.remove('is-dragover'); });
});
videoDrop.addEventListener('drop', (e) => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('video/')) return;
  if (file.size > 20 * 1024 * 1024) {
    showToast('That video is over 20MB — compress it first or it will make the site slow and may fail to save.', 'error');
    return;
  }
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

// Loop the preview between the chosen trim points, same as the live site
videoPreview.addEventListener('timeupdate', () => {
  const end = Number(trimEnd.value);
  if (end && videoPreview.currentTime >= end) {
    videoPreview.currentTime = Number(trimStart.value);
  }
});

saveVideoBtn.addEventListener('click', () => {
  if (!pendingVideoDataUrl) {
    showToast('Choose a video first.', 'error');
    return;
  }
  const config = {
    dataUrl: pendingVideoDataUrl,
    start: Number(trimStart.value),
    end: Number(trimEnd.value),
    fit: videoFit.value,
    brightness: Number(videoBrightness.value)
  };
  const saved = saveHeroVideo(config);
  if (saved) {
    showToast('Homepage video saved', 'success');
  } else {
    // localStorage has a size limit (usually 5-10MB, often less on
    // mobile) — a long or high-resolution video can exceed it, or
    // storage may be blocked entirely in this context.
    showToast('Video is too large (or storage is blocked here) — it will show for this session only. Try a shorter/more compressed clip.', 'error');
  }
});

removeVideoBtn.addEventListener('click', () => {
  removeHeroVideo();
  pendingVideoDataUrl = null;
  videoInput.value = '';
  videoPreview.src = '';
  videoPreviewWrap.style.display = 'none';
  videoControls.style.display = 'none';
  showToast('Homepage video removed — the placeholder will show instead');
});

// If a video was already saved in an earlier session, load it in now
(function initExistingVideo() {
  const existing = getHeroVideo();
  if (existing && existing.dataUrl) {
    loadVideoIntoPreview(existing.dataUrl, existing);
  }
})();
