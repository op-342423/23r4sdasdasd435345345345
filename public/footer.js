/* ==========================================================
   footer.js — brief item 4 (this batch): a site-wide footer with
   links to the four policy pages, plus shop/account shortcuts and
   whatever contact/social info the owner has set in the admin
   dashboard (reuses the existing site_settings data — no
   duplicate fields). Included as a plain <script> tag on every
   storefront page, same pattern as announcement.js — it builds
   and appends itself, so no page's HTML needs to hand-author a
   footer or keep policy links in sync manually.
   ========================================================== */
(function () {
  async function init() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <span class="site-footer__mark chrome-text" data-brand>THORN</span>
          <p class="site-footer__tagline">Jewelry and clothing that isn't made for everyone.</p>
        </div>
        <div class="site-footer__col">
          <h3>Shop</h3>
          <a href="index.html#products">All products</a>
          <a href="wishlist.html">Wishlist</a>
          <a href="my-orders.html">Your orders</a>
        </div>
        <div class="site-footer__col">
          <h3>Policies</h3>
          <a href="privacy.html">Privacy Policy</a>
          <a href="shipping.html">Shipping Policy</a>
          <a href="refund-return.html">Refund &amp; Return Policy</a>
          <a href="terms.html">Terms &amp; Conditions</a>
        </div>
        <div class="site-footer__col" id="footerContact">
          <h3>Contact</h3>
        </div>
      </div>
      <p class="site-footer__bottom">&copy; ${new Date().getFullYear()} <span data-brand>THORN</span>. All rights reserved.</p>
    `;
    document.body.appendChild(footer);

    try {
      const settings = await getSiteSettings();
      const contact = document.getElementById('footerContact');
      let links = '';
      if (settings.tiktokUrl) links += `<a href="${settings.tiktokUrl}" target="_blank" rel="noopener">TikTok</a>`;
      if (settings.facebookUrl) links += `<a href="${settings.facebookUrl}" target="_blank" rel="noopener">Facebook</a>`;
      if (settings.phone) links += `<a href="tel:${settings.phone.replace(/\s+/g, '')}">${settings.phone}</a>`;
      if (contact) contact.innerHTML += links || '<p style="color:var(--muted);font-size:0.82rem;">Details coming soon.</p>';
    } catch (e) {
      // Non-critical — the footer still shows shop/policy links without contact info.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
