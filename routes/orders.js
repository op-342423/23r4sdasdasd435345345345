const express = require('express');
const { pool } = require('../db/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const COUPONS = {
  THORN10: { type: 'percent', value: 10, label: '10% off' },
  WELCOME5: { type: 'flat', value: 5, label: '$5 off' }
};
const DELIVERY_FEE = 5;

const STATUSES = ['pending', 'accepted', 'out_for_delivery', 'delivered', 'rejected'];
const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rejected: 'Rejected'
};

function serializeOrder(o, items) {
  return {
    id: o.id,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status] || o.status,
    name: o.name, email: o.email, phone: o.phone, address: o.address, notes: o.notes,
    location: o.location,
    coupon: o.coupon,
    subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryFee: Number(o.delivery_fee), total: Number(o.total),
    currency: o.currency,
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: items.map(i => ({ productId: i.product_id, name: i.name, price: Number(i.price), currency: i.currency, qty: i.qty }))
  };
}

// ---------- Customer ----------

// Body: { items: [{id, qty}], name, email, phone, address, notes, location, couponCode }
router.post('/', requireAuth, async (req, res) => {
  const { items, name, email, phone, address, notes, location, couponCode } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!name || !phone || !address) return res.status(400).json({ error: 'Please fill in your name, phone, and address.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ids = items.map(i => i.id);
    const { rows: products } = await client.query('SELECT * FROM products WHERE id = ANY($1::int[])', [ids]);

    let subtotal = 0;
    let currency = 'USD';
    const lineItems = [];
    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      if (product.stock !== null && qty > product.stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Only ${product.stock} of "${product.name}" left in stock.` });
      }
      subtotal += Number(product.price) * qty;
      currency = product.currency;
      lineItems.push({ product, qty });
    }
    if (!lineItems.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Those items are no longer available.' });
    }

    let discount = 0;
    let couponLabel = null;
    const coupon = COUPONS[(couponCode || '').trim().toUpperCase()];
    if (coupon) {
      discount = coupon.type === 'percent' ? subtotal * (coupon.value / 100) : coupon.value;
      discount = Math.min(discount, subtotal);
      couponLabel = coupon.label;
    }
    const deliveryFee = DELIVERY_FEE;
    const total = Math.max(0, subtotal - discount + deliveryFee);

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, name, email, phone, address, notes, location, coupon, subtotal, discount, delivery_fee, total, currency, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Cash on delivery','pending') RETURNING *`,
      [req.user.id, name, email || null, phone, address, notes || '', location ? JSON.stringify(location) : null, couponLabel, subtotal, discount, deliveryFee, total, currency]
    );
    const order = orderRows[0];

    for (const { product, qty } of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, currency, qty) VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, product.id, product.name, product.price, product.currency, qty]
      );
      if (product.stock !== null) {
        await client.query('UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id=$2', [qty, product.id]);
      }
    }

    await client.query('COMMIT');
    res.json(serializeOrder(order, lineItems.map(li => ({ product_id: li.product.id, name: li.product.name, price: li.product.price, currency: li.product.currency, qty: li.qty }))));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Could not place order.' });
  } finally {
    client.release();
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  const { rows: orders } = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  const { rows: items } = await pool.query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::int[])',
    [orders.map(o => o.id)]
  );
  res.json(orders.map(o => serializeOrder(o, items.filter(i => i.order_id === o.id))));
});

// ---------- Admin ----------

router.get('/', requireAdmin, async (req, res) => {
  const { rows: orders } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  const { rows: items } = await pool.query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::int[])',
    [orders.map(o => o.id)]
  );
  res.json(orders.map(o => serializeOrder(o, items.filter(i => i.order_id === o.id))));
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const { rows } = await pool.query(
    'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [status, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
  res.json(serializeOrder(rows[0], []));
});

router.get('/stats', requireAdmin, async (req, res) => {
  const [{ rows: totals }, { rows: byStatus }, { rows: lowStock }, { rows: topProducts }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS order_count, COALESCE(SUM(total),0)::numeric AS revenue FROM orders WHERE status != 'rejected'`),
    pool.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`),
    pool.query(`SELECT id, name, stock FROM products WHERE stock IS NOT NULL AND stock <= 3 ORDER BY stock ASC`),
    pool.query(`SELECT name, SUM(qty)::int AS units FROM order_items GROUP BY name ORDER BY units DESC LIMIT 5`)
  ]);
  res.json({
    orderCount: totals[0].order_count,
    revenue: Number(totals[0].revenue),
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    lowStock: lowStock,
    topProducts: topProducts
  });
});

module.exports = router;
