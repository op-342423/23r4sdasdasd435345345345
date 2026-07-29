/* ==========================================================
   editorial.js — Editorial section (brief Part 10): campaign
   photography, runway/BTS stills or clips, and quotes. Pure
   storytelling — deliberately has no price field anywhere in
   this route or its table. Multi-row, admin-editable, same
   pattern as collections.js / products.js.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    kind: row.kind || 'image', // 'image' | 'video' | 'quote'
    mediaDataUrl: row.media_data_url || '',
    caption: row.caption || '',
    quoteText: row.quote_text || '',
    quoteAuthor: row.quote_author || '',
    size: row.size || 'normal', // 'normal' | 'large' — for grid variety
    enabled: !!row.enabled,
    displayOrder: row.display_order || 0
  };
}

// ---------- Public ----------

router.get('/', async (req, res) => {
  try {
    if (req.query.all === '1' && req.user && req.user.isAdmin) {
      const { rows } = await pool.query('SELECT * FROM editorial_items ORDER BY display_order ASC, created_at ASC');
      return res.json(rows.map(serialize));
    }
    const { rows } = await pool.query(
      'SELECT * FROM editorial_items WHERE enabled=TRUE ORDER BY display_order ASC, created_at ASC'
    );
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

// ---------- Admin ----------

router.post('/', requireAdmin, async (req, res) => {
  let { kind, mediaDataUrl, caption, quoteText, quoteAuthor, size, enabled, displayOrder } = req.body;
  kind = ['image', 'video', 'quote'].includes(kind) ? kind : 'image';

  if (kind === 'quote') {
    quoteText = (quoteText || '').trim();
    if (!quoteText) return res.status(400).json({ error: 'Please write the quote text.' });
  } else if (!mediaDataUrl) {
    return res.status(400).json({ error: 'Please choose a photo or video.' });
  }

  caption = (caption || '').trim();
  quoteAuthor = (quoteAuthor || '').trim();
  size = size === 'large' ? 'large' : 'normal';
  enabled = enabled === undefined ? true : !!enabled;
  displayOrder = Number.isFinite(Number(displayOrder)) ? parseInt(displayOrder, 10) : 0;

  try {
    const { rows } = await pool.query(
      `INSERT INTO editorial_items (kind, media_data_url, caption, quote_text, quote_author, size, enabled, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [kind, mediaDataUrl || null, caption || null, quoteText || null, quoteAuthor || null, size, enabled, displayOrder]
    );
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save that — try a smaller/shorter file.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM editorial_items WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
