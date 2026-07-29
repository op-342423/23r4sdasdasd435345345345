/* ==========================================================
   payment-methods.js — Part 3 of the brief: admin-controlled
   payment methods, extending the existing `payment_method` field
   already stored on orders (routes/orders.js).

   Fixed set of 5 methods (id is a stable key: cod, vodafone_cash,
   instapay, visa, mastercard) stored in their own table so nothing
   is hardcoded in the frontend — the admin dashboard enables/
   disables each one, reorders them (that order is what checkout
   renders), and edits their config (phone/QR, username/QR, etc).
   Visa/Mastercard ship with an empty config, ready for Stripe keys
   later — no live payment flow is faked for them here.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// The only ids this system knows about — admins edit these, they
// don't create arbitrary new payment methods.
const KNOWN_IDS = ['cod', 'vodafone_cash', 'instapay', 'visa', 'mastercard'];

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: row.config || {}
  };
}

// ---------- Public ----------

// Checkout only ever needs the enabled methods, already in the
// admin-defined order — never the disabled ones.
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payment_methods WHERE enabled = TRUE ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

// ---------- Admin ----------

// The admin dashboard's editor needs every method, enabled or not,
// so the owner can flip one on for the first time.
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payment_methods ORDER BY sort_order ASC, id ASC');
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load payment methods.' });
  }
});

// Body: [{ id, enabled, sortOrder, config }, ...] — the whole list,
// same "save everything at once" pattern as site_settings. Order in
// the array also becomes sort_order, so drag/reorder-then-save just
// works without a separate endpoint.
router.put('/', requireAdmin, async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Expected a list of payment methods.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (!m || !KNOWN_IDS.includes(m.id)) continue; // ignore anything unexpected rather than erroring the whole save
      const enabled = !!m.enabled;
      const sortOrder = Number.isFinite(m.sortOrder) ? m.sortOrder : i;
      // TODO: switch to Media Library once Section 12 ships — QR images
      // (config.qrDataUrl for vodafone_cash/instapay) are currently saved
      // as direct-upload data URLs here instead of Media Library refs.
      const config = (m.config && typeof m.config === 'object') ? m.config : {};
      await client.query(
        `UPDATE payment_methods SET enabled=$1, sort_order=$2, config=$3 WHERE id=$4`,
        [enabled, sortOrder, JSON.stringify(config), m.id]
      );
    }
    await client.query('COMMIT');
    const { rows } = await client.query('SELECT * FROM payment_methods ORDER BY sort_order ASC, id ASC');
    res.json(rows.map(serialize));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Could not save payment methods.' });
  } finally {
    client.release();
  }
});

module.exports = router;
