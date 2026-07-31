const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serializeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    currency: p.currency,
    description: p.description,
    badge: p.badge,
    stock: p.stock, // null = unlimited
    images: p.images || [],
    createdAt: p.created_at,
    // Part 3 (this batch) — Product Details page fields. All optional;
    // '' instead of null so the frontend never has to null-check them.
    sku: p.sku || '',
    material: p.material || '',
    size: p.size_info || '',
    weight: p.weight || '',
    warranty: p.warranty_text || '',
    deliveryInfo: p.delivery_info || ''
  };
}

// ---------- Public ----------

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(rows.map(serializeProduct));
});

router.get('/hero-video', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM hero_video WHERE id=1');
  if (!rows.length || !rows[0].data_url) return res.json(null);
  const r = rows[0];
  res.json({ dataUrl: r.data_url, start: Number(r.start_s), end: Number(r.end_s), fit: r.fit, brightness: r.brightness });
});

// ---------- Admin ----------

// Kept in one place so the create and edit routes (and the 5→8 cap
// raise from item 2 of this batch) can't drift apart.
const MAX_PRODUCT_IMAGES = 8;

router.post('/', requireAdmin, async (req, res) => {
  const { name, category, price, currency, description, badge, stock, images, sku, material, size, weight, warranty, deliveryInfo } = req.body;
  if (!name || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Please provide a name and a valid price.' });
  }
  const stockVal = (stock === '' || stock === undefined || stock === null) ? null : Math.max(0, parseInt(stock, 10));
  const imgs = Array.isArray(images) ? images.slice(0, MAX_PRODUCT_IMAGES) : [];
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, category, price, currency, description, badge, stock, images, sku, material, size_info, weight, warranty_text, delivery_info)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, category || null, price, currency || 'USD', description || '', badge || null, stockVal, JSON.stringify(imgs),
       (sku || '').trim() || null, (material || '').trim() || null, (size || '').trim() || null, (weight || '').trim() || null, (warranty || '').trim() || null, (deliveryInfo || '').trim() || null]
    );
    res.json(serializeProduct(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save product.' });
  }
});

// Single-product fetch — powers /product.html?id=. Registered below
// the literal '/hero-video' routes (see the note above the DELETE
// '/:id' route) since ':id' would otherwise swallow that path first.
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
  res.json(serializeProduct(rows[0]));
});

// Edit an existing product — same field set as create, so every new
// Product Details field is editable after the fact from the admin
// "add/edit item" form, not just settable once at creation.
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, category, price, currency, description, badge, stock, images, sku, material, size, weight, warranty, deliveryInfo } = req.body;
  if (!name || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Please provide a name and a valid price.' });
  }
  const stockVal = (stock === '' || stock === undefined || stock === null) ? null : Math.max(0, parseInt(stock, 10));
  const imgs = Array.isArray(images) ? images.slice(0, MAX_PRODUCT_IMAGES) : [];
  try {
    const { rows } = await pool.query(
      `UPDATE products SET name=$1, category=$2, price=$3, currency=$4, description=$5, badge=$6, stock=$7, images=$8,
         sku=$9, material=$10, size_info=$11, weight=$12, warranty_text=$13, delivery_info=$14
       WHERE id=$15 RETURNING *`,
      [name, category || null, price, currency || 'USD', description || '', badge || null, stockVal, JSON.stringify(imgs),
       (sku || '').trim() || null, (material || '').trim() || null, (size || '').trim() || null, (weight || '').trim() || null, (warranty || '').trim() || null, (deliveryInfo || '').trim() || null,
       req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(serializeProduct(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save changes.' });
  }
});

router.delete('/hero-video', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM hero_video WHERE id=1');
  res.json({ ok: true });
});

router.post('/hero-video', requireAdmin, async (req, res) => {
  const { dataUrl, start, end, fit, brightness } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'No video provided.' });
  try {
    await pool.query(
      `INSERT INTO hero_video (id, data_url, start_s, end_s, fit, brightness)
       VALUES (1,$1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET data_url=$1, start_s=$2, end_s=$3, fit=$4, brightness=$5`,
      [dataUrl, start || 0, end || 0, fit || 'cover', brightness || 45]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    // Most likely cause: the video is too large for the database row/plan.
    res.status(500).json({ error: 'Could not save video — try a shorter/more compressed clip.' });
  }
});

// NOTE: this generic '/:id' route must stay BELOW every other literal
// path this router defines (e.g. '/hero-video'). Express matches routes
// in registration order, and ':id' matches any single path segment —
// so if this were registered first, DELETE /api/products/hero-video
// would be caught here with id="hero-video" and crash trying to parse
// it as an integer (that was exactly the bug: hero-video removal was
// hitting this handler instead of the one below, before this fix).
router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
