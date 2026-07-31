/* ==========================================================
   server.js — entry point.
   Loads env vars, sets up middleware, mounts API routes,
   serves the /public frontend, and initializes the database
   schema on boot.
   ========================================================== */

// Load .env for local development. On Render, environment
// variables are set in the dashboard instead, and this simply
// finds no file and does nothing.
try {
  const fs = require('fs');
  if (fs.existsSync('.env')) {
    fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = process.env[match[1].trim()] || match[2].trim();
    });
  }
} catch (e) { /* ignore */ }

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { init } = require('./db/db');
const { attachUser } = require('./middleware/auth');
const { pool } = require('./db/db');

const app = express();

// ---------- Server-side brand-name injection for <title>/meta tags ----------
// See note above: brand.js can only swap these client-side, which link-
// preview crawlers never see. These pages ship with the literal default
// "THORN" in their <title>/meta description/Open Graph/Twitter tags and
// (for index.html) the hero wordmark — read once at boot and re-stamped
// with the real brand name on every request below.
const DEFAULT_BRAND_NAME = 'THORN';
const PUBLIC_DIR = path.join(__dirname, 'public');
const BRANDED_PAGES = [
  'index.html', 'product.html', 'checkout.html', 'login.html', 'register.html',
  'my-orders.html', 'wishlist.html', 'privacy.html', 'terms.html', 'shipping.html',
  'refund-return.html'
];
const htmlTemplates = new Map();
for (const file of BRANDED_PAGES) {
  try {
    htmlTemplates.set(file, fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8'));
  } catch (e) {
    console.error(`Could not preload ${file} for brand injection:`, e.message);
  }
}

async function getBrandName() {
  try {
    const { rows } = await pool.query('SELECT brand_name FROM site_settings WHERE id=1');
    return (rows[0] && rows[0].brand_name) || DEFAULT_BRAND_NAME;
  } catch (e) {
    return DEFAULT_BRAND_NAME;
  }
}
app.use(express.json({ limit: '15mb' })); // photos/video arrive as base64 in JSON
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/learn-more', require('./routes/learn-more'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/editorial', require('./routes/editorial'));
app.use('/api/payment-methods', require('./routes/payment-methods'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/media', require('./routes/media'));
app.use('/api/announcement', require('./routes/announcement'));
app.use('/api/coupons', require('./routes/coupons'));
app.use(require('./routes/manifest')); // serves /manifest.json, generated with the current brand name
app.use(require('./routes/sitemap')); // serves /sitemap.xml, generated fresh from current products

app.get(['/', '/:page'], async (req, res, next) => {
  const file = req.path === '/' ? 'index.html' : req.params.page;
  const template = htmlTemplates.get(file);
  if (!template) return next(); // not a branded page (css/js/images/robots.txt/etc.) — fall through to express.static
  const brandName = await getBrandName();
  const html = (brandName && brandName !== DEFAULT_BRAND_NAME)
    ? template.split(DEFAULT_BRAND_NAME).join(brandName)
    : template;
  res.set('Content-Type', 'text/html; charset=UTF-8');
  res.send(html);
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`THORN server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
