/* ==========================================================
   manifest.js — serves /manifest.json for "Add to Home Screen"
   support. Generated per-request (not a static file) so the app
   name always matches the owner's current brand name — a static
   file would have shipped a hardcoded "THORN" and reproduced the
   exact same stale-name problem brand.js already works around
   for the page itself.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');

const router = express.Router();

const DEFAULT_BRAND_NAME = 'THORN';

router.get('/manifest.json', async (req, res) => {
  let brandName = DEFAULT_BRAND_NAME;
  try {
    const { rows } = await pool.query('SELECT brand_name FROM site_settings WHERE id=1');
    if (rows[0] && rows[0].brand_name) brandName = rows[0].brand_name;
  } catch (e) {
    console.error(e);
    // fall through with the default — a broken manifest shouldn't 500 the page
  }

  res.set('Cache-Control', 'no-cache');
  res.json({
    name: brandName,
    short_name: brandName,
    description: `Shop ${brandName}'s statement rings, chains, and clothing.`,
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  });
});

module.exports = router;
