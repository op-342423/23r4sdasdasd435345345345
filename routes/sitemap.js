/* ==========================================================
   sitemap.js — generates /sitemap.xml on every request instead of
   shipping a static file. Product pages are added/removed from
   admin all the time, so a static sitemap would go stale within a
   day; querying the DB each time keeps it accurate for free (it's
   a cheap, infrequent, crawler-only request).
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');

const router = express.Router();

// TODO: update to the real production domain once the site is live.
const SITE_URL = process.env.SITE_URL || 'https://thorn-store.example.com';

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shipping.html', priority: '0.3', changefreq: 'monthly' },
  { path: '/privacy.html', priority: '0.3', changefreq: 'monthly' },
  { path: '/refund-return.html', priority: '0.3', changefreq: 'monthly' },
  { path: '/terms.html', priority: '0.3', changefreq: 'monthly' },
];

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, created_at FROM products ORDER BY created_at DESC');

    const entries = [
      ...STATIC_PAGES.map(p => urlEntry(SITE_URL + p.path, null, p.changefreq, p.priority)),
      ...rows.map(p => urlEntry(
        `${SITE_URL}/product.html?id=${p.id}`,
        new Date(p.created_at).toISOString().split('T')[0],
        'weekly',
        '0.8'
      )),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    console.error('Failed to generate sitemap:', e);
    res.status(500).send('Could not generate sitemap.');
  }
});

module.exports = router;
