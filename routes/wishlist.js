const express = require('express');
const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.* FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id=$1 ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map(p => ({
    id: p.id, name: p.name, category: p.category, price: Number(p.price), currency: p.currency,
    description: p.description, badge: p.badge, stock: p.stock, images: p.images || []
  })));
});

// Toggle a product in/out of the wishlist. Body: { productId }
router.post('/toggle', requireAuth, async (req, res) => {
  const productId = req.body.productId;
  const existing = await pool.query('SELECT 1 FROM wishlist WHERE user_id=$1 AND product_id=$2', [req.user.id, productId]);
  if (existing.rows.length) {
    await pool.query('DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2', [req.user.id, productId]);
    return res.json({ inWishlist: false });
  }
  await pool.query('INSERT INTO wishlist (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, productId]);
  res.json({ inWishlist: true });
});

router.get('/mine-ids', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT product_id FROM wishlist WHERE user_id=$1', [req.user.id]);
  res.json(rows.map(r => r.product_id));
});

module.exports = router;
