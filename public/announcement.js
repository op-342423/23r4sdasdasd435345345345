/* ==========================================================
   announcement.js — brief item 11 (this batch): a slim,
   admin-controlled bar shown above the nav on every storefront
   page. Fully optional and hidden by default — only appears once
   the owner has enabled it and given it text from the admin
   dashboard's "Announcement bar" panel (routes/announcement.js /
   api.js#getAnnouncementBar).

   Dismissing it is per-browser-session (sessionStorage) and keyed
   to the *current* announcement text, so closing an old message
   doesn't hide a new one the owner publishes later.

   Layout: the bar is inserted as the very first element in <body>
   and is fixed at the top of the viewport. It never repositions or
   restyles the hero/nav directly — it only sets a single CSS
   variable (--announcement-h) that styles.css uses to nudge the
   fixed nav down and add matching top padding to <body>, so
   nothing else about the hero intro's layout or timing changes.
   ========================================================== */
(function () {
  const STORAGE_PREFIX = 'thorn_announcement_dismissed_';

  function hashText(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function setAnnouncementHeight(px) {
    document.documentElement.style.setProperty('--announcement-h', px + 'px');
  }

  async function init() {
    let data;
    try {
      data = await getAnnouncementBar();
    } catch (e) {
      return; // network hiccup — non-critical, page works fine without it
    }
    if (!data || !data.enabled || !data.text || !data.text.trim()) return;

    const dismissKey = STORAGE_PREFIX + hashText(data.text.trim());
    try {
      if (sessionStorage.getItem(dismissKey) === '1') return;
    } catch (e) { /* storage unavailable — just show it */ }

    const bar = document.createElement('div');
    bar.className = 'announcement-bar';
    bar.id = 'announcementBar';
    bar.style.setProperty('--ann-bg', data.bgColor || '#0A0A0A');
    bar.style.setProperty('--ann-text', data.textColor || '#F2EEE7');

    const safeText = escapeHtml(data.text.trim());
    const linkUrl = (data.linkUrl || '').trim();
    const contentHtml = linkUrl
      ? `<a class="announcement-bar__link" href="${escapeHtml(linkUrl)}">${safeText}</a>`
      : `<span class="announcement-bar__text">${safeText}</span>`;

    bar.innerHTML = `
      ${contentHtml}
      <button type="button" class="announcement-bar__close" aria-label="Dismiss announcement">&times;</button>
    `;

    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-announcement');

    function updateHeight() { setAnnouncementHeight(bar.offsetHeight); }
    updateHeight();
    window.addEventListener('resize', updateHeight);

    bar.querySelector('.announcement-bar__close').addEventListener('click', () => {
      bar.remove();
      document.body.classList.remove('has-announcement');
      setAnnouncementHeight(0);
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
