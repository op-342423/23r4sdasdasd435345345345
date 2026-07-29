/* ==========================================================
   reviews.js — Part 3 (this batch) of the brief: ratings +
   customer reviews for the Product Details page. Guest-friendly
   (no account needed to leave one, matching the rest of the
   storefront), but every review starts unapproved — only rows
   the owner approves from the admin dashboard ever show up on
   the product page or count toward the average rating.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name, // only present on the admin/join query
    name: row.name,
    rating: row.rating,
    comment: row.comment || '',
    approved: !!row.approved,
    createdAt: row.created_at
  };
}

// ---------- Public ----------

// Approved reviews for one product, plus the aggregate the product
// page needs for its star rating (average + count) — computed here
// so the frontend never has to fetch every review just to show a
// summary.
router.get('/', async (req, res) => {
  const productId = parseInt(req.query.productId, 10);
  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reviews WHERE product_id=$1 AND approved=TRUE ORDER BY created_at DESC`,
      [productId]
    );
    const count = rows.length;
    const average = count ? rows.reduce((sum, r) => sum + r.rating, 0) / count : 0;
    res.json({ reviews: rows.map(serialize), average, count });
  } catch (e) {
    console.error(e);
    res.json({ reviews: [], average: 0, count: 0 });
  }
});

// Anyone can leave a review — it just won't be visible to other
// shoppers until an admin approves it below.
router.post('/', async (req, res) => {
  const { productId, name, rating, comment } = req.body;
  const pid = parseInt(productId, 10);
  const r = parseInt(rating, 10);
  const trimmedName = (name || '').trim();
  if (!pid) return res.status(400).json({ error: 'Missing product.' });
  if (!trimmedName) return res.status(400).json({ error: 'Please add your name.' });
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Please choose a rating from 1 to 5.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO reviews (product_id, name, rating, comment, approved)
       VALUES ($1,$2,$3,$4,FALSE) RETURNING *`,
      [pid, trimmedName, r, (comment || '').trim() || null]
    );
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not submit your review.' });
  }
});

// ---------- Admin ----------

// Every review, newest first, with the product's name joined in so
// the moderation panel doesn't need a second round-trip per row.
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT reviews.*, products.name AS product_name
       FROM reviews LEFT JOIN products ON products.id = reviews.product_id
       ORDER BY reviews.created_at DESC`
    );
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

router.patch('/:id/approve', requireAdmin, async (req, res) => {
  const approved = !!req.body.approved;
  try {
    const { rows } = await pool.query(
      'UPDATE reviews SET approved=$1 WHERE id=$2 RETURNING *',
      [approved, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Review not found.' });
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update that review.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
