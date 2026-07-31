/* ==========================================================
   coupons.js — admin-controlled discount coupons.

   Two ways a coupon can reach a customer:
   - Code: the owner shares it (privately, or via the on-site
     banner) and the shopper types it in at checkout.
   - Auto-apply: applied automatically at checkout with no code,
     for everyone (or for a specific list of emails).

   target_emails (comma-separated, case-insensitive) lets the owner
   restrict a coupon to specific people instead of the whole site —
   e.g. sending a code to a few customers directly. Leave it blank
   for "anyone can use this."

   A coupon stops working automatically once it's outside its
   [starts_at, expires_at] window or has hit usage_limit — no cron
   job needed, isLive() below is checked on every read. The owner can
   still delete it outright from the dashboard at any time.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    code: row.code,
    label: row.label || '',
    discountType: row.discount_type === 'flat' ? 'flat' : 'percent',
    discountValue: Number(row.discount_value),
    autoApply: !!row.auto_apply,
    showBanner: !!row.show_banner,
    bannerText: row.banner_text || '',
    targetEmails: row.target_emails || '',
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    enabled: !!row.enabled,
    usageLimit: row.usage_limit,
    usedCount: row.used_count || 0,
    // Convenience flag for the admin list — same rule as isLive()
    // below, computed here so the dashboard doesn't reimplement it.
    isLive: isLive(row)
  };
}

function isLive(row, now) {
  now = now || new Date();
  if (!row.enabled) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.expires_at && new Date(row.expires_at) < now) return false;
  if (row.usage_limit != null && row.used_count >= row.usage_limit) return false;
  return true;
}

function emailAllowed(row, email) {
  const list = (row.target_emails || '').trim();
  if (!list) return true; // no restriction — anyone can use it
  const allowed = list.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(String(email).toLowerCase());
}

function computeDiscount(row, subtotal) {
  const value = Number(row.discount_value);
  const discount = row.discount_type === 'flat' ? value : subtotal * (value / 100);
  return Math.max(0, Math.min(discount, subtotal));
}

// Shared by routes/orders.js so order placement re-validates against
// the same rules a preview used, instead of trusting the client.
async function findValidCoupon(code, email) {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return null;
  const { rows } = await pool.query('SELECT * FROM coupons WHERE UPPER(code)=$1', [normalized]);
  const row = rows[0];
  if (!row || !isLive(row) || !emailAllowed(row, email)) return null;
  return row;
}

async function findAutoCoupon(email) {
  const { rows } = await pool.query('SELECT * FROM coupons WHERE auto_apply=TRUE ORDER BY created_at DESC');
  return rows.find(row => isLive(row) && emailAllowed(row, email)) || null;
}

async function incrementUsage(id) {
  await pool.query('UPDATE coupons SET used_count = used_count + 1 WHERE id=$1', [id]);
}

// ---------- Public ----------

// The elegant top-of-site banner (coupon-banner.js). Only ever
// surfaces a coupon the owner explicitly opted into showing.
router.get('/banner', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM coupons WHERE show_banner=TRUE ORDER BY created_at DESC'
    );
    const row = rows.find(r => isLive(r) && emailAllowed(r, req.query.email));
    if (!row) return res.json(null);
    res.json({
      code: row.code,
      bannerText: row.banner_text || row.label || `Use code ${row.code}`,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value)
    });
  } catch (e) {
    console.error(e);
    res.json(null);
  }
});

// Auto-applied coupon for the logged-in shopper's email (if any).
router.get('/auto', async (req, res) => {
  try {
    const row = await findAutoCoupon(req.query.email);
    if (!row) return res.json(null);
    res.json({ code: row.code, label: row.label, discountType: row.discount_type, discountValue: Number(row.discount_value) });
  } catch (e) {
    console.error(e);
    res.json(null);
  }
});

// Live preview at checkout when a shopper types a code in manually.
router.post('/validate', async (req, res) => {
  try {
    const row = await findValidCoupon(req.body.code, req.body.email);
    if (!row) return res.status(404).json({ error: "That code isn't valid." });
    res.json({ code: row.code, label: row.label, discountType: row.discount_type, discountValue: Number(row.discount_value) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not check that code — try again.' });
  }
});

// ---------- Admin ----------

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

router.post('/', requireAdmin, async (req, res) => {
  let { code, label, discountType, discountValue, autoApply, showBanner, bannerText, targetEmails, startsAt, expiresAt, enabled, usageLimit } = req.body;

  code = (code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Give the coupon a code.' });
  discountValue = Number(discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return res.status(400).json({ error: 'Enter a valid discount amount.' });
  discountType = discountType === 'flat' ? 'flat' : 'percent';
  if (discountType === 'percent' && discountValue > 100) return res.status(400).json({ error: "A percentage discount can't be over 100%." });

  try {
    const { rows } = await pool.query(
      `INSERT INTO coupons (code, label, discount_type, discount_value, auto_apply, show_banner, banner_text, target_emails, starts_at, expires_at, enabled, usage_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [code, (label || '').trim() || null, discountType, discountValue, !!autoApply, !!showBanner,
       (bannerText || '').trim() || null, (targetEmails || '').trim() || null,
       startsAt || null, expiresAt || null, enabled === undefined ? true : !!enabled,
       usageLimit ? parseInt(usageLimit, 10) : null]
    );
    res.json(serialize(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A coupon with that code already exists.' });
    console.error(e);
    res.status(500).json({ error: 'Could not save the coupon.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  let { code, label, discountType, discountValue, autoApply, showBanner, bannerText, targetEmails, startsAt, expiresAt, enabled, usageLimit } = req.body;

  code = (code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Give the coupon a code.' });
  discountValue = Number(discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return res.status(400).json({ error: 'Enter a valid discount amount.' });
  discountType = discountType === 'flat' ? 'flat' : 'percent';

  try {
    const { rows } = await pool.query(
      `UPDATE coupons SET code=$1, label=$2, discount_type=$3, discount_value=$4, auto_apply=$5, show_banner=$6,
         banner_text=$7, target_emails=$8, starts_at=$9, expires_at=$10, enabled=$11, usage_limit=$12
       WHERE id=$13 RETURNING *`,
      [code, (label || '').trim() || null, discountType, discountValue, !!autoApply, !!showBanner,
       (bannerText || '').trim() || null, (targetEmails || '').trim() || null,
       startsAt || null, expiresAt || null, !!enabled,
       usageLimit ? parseInt(usageLimit, 10) : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Coupon not found.' });
    res.json(serialize(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A coupon with that code already exists.' });
    console.error(e);
    res.status(500).json({ error: 'Could not update the coupon.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.findValidCoupon = findValidCoupon;
module.exports.findAutoCoupon = findAutoCoupon;
module.exports.incrementUsage = incrementUsage;
module.exports.computeDiscount = computeDiscount;
