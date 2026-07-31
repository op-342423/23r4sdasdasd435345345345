/* ==========================================================
   coupon-banner.js — the "show this coupon nicely at the top
   of the screen" option from the admin Coupons panel. Mirrors
   announcement.js's stacking approach (its own --coupon-h CSS var)
   so the two can be live at the same time without overlapping.

   Tapping the code copies it to the clipboard — no need to retype
   it at checkout. Dismissing is per-browser-session and keyed to
   the coupon's code, so closing one banner doesn't hide a different
   coupon the owner turns on later.
   ========================================================== */
(function () {
  const STORAGE_PREFIX = 'thorn_coupon_dismissed_';

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function setCouponHeight(px) {
    document.documentElement.style.setProperty('--coupon-h', px + 'px');
  }

  async function resolveEmail() {
    try {
      const me = await apiMe();
      return me.loggedIn ? me.email : null;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    let data;
    try {
      const email = await resolveEmail();
      data = await apiGetCouponBanner(email);
    } catch (e) {
      return; // network hiccup — non-critical, page works fine without it
    }
    if (!data || !data.code) return;

    const dismissKey = STORAGE_PREFIX + data.code;
    try {
      if (sessionStorage.getItem(dismissKey) === '1') return;
    } catch (e) { /* storage unavailable — just show it */ }

    const bar = document.createElement('div');
    bar.className = 'coupon-banner';
    bar.id = 'couponBanner';

    const safeText = escapeHtml(data.bannerText || `Use code ${data.code}`);
    const safeCode = escapeHtml(data.code);
    bar.innerHTML = `
      <span>${safeText}</span>
      <button type="button" class="coupon-banner__code" id="couponBannerCode">${safeCode} · tap to copy</button>
      <button type="button" class="coupon-banner__close" aria-label="Dismiss coupon">&times;</button>
    `;

    // Insert after the announcement bar if one exists, otherwise as
    // the first element in <body> — same fixed-strip stacking model.
    const existingAnnouncement = document.getElementById('announcementBar');
    if (existingAnnouncement) existingAnnouncement.insertAdjacentElement('afterend', bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-coupon-banner');

    function updateHeight() { setCouponHeight(bar.offsetHeight); }
    updateHeight();
    window.addEventListener('resize', updateHeight);

    bar.querySelector('#couponBannerCode').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.code);
        if (typeof showToast === 'function') showToast(`Copied: ${data.code}`, 'success');
      } catch (e) {
        if (typeof showToast === 'function') showToast(data.code, 'success');
      }
    });

    bar.querySelector('.coupon-banner__close').addEventListener('click', () => {
      bar.remove();
      document.body.classList.remove('has-coupon-banner');
      setCouponHeight(0);
      window.removeEventListener('resize', updateHeight);
      try { sessionStorage.setItem(dismissKey, '1'); } catch (e) { /* non-critical */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
