/* ==========================================================
   media.js — the Media Library (brief item 12, this batch).
   Admin-only: uploads are stored once here, then referenced by
   value (the same data_url string) from products, hero_video,
   learn_more_section, collection_stories, editorial_items, and
   payment_methods' QR fields — instead of re-uploading the same
   file into each of those. Deleting an item that's still
   referenced elsewhere warns the owner first (findUsages) unless
   they explicitly force it.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    filename: row.filename || '',
    type: row.type === 'video' ? 'video' : 'image',
    url: row.data_url,
    size: row.size || 0,
    uploadedAt: row.uploaded_at
  };
}

// Checks every table that can hold a media data_url by value and
// returns a plain-language list of where it's still used, so the
// admin dashboard can warn before deleting a library item.
async function findUsages(dataUrl) {
  const usages = [];

  const prod = await pool.query(
    `SELECT id, name FROM products WHERE images @> $1::jsonb`,
    [JSON.stringify([dataUrl])]
  );
  prod.rows.forEach(r => usages.push(`Product "${r.name}"`));

  const hero = await pool.query(`SELECT 1 FROM hero_video WHERE data_url = $1`, [dataUrl]);
  if (hero.rows.length) usages.push('Homepage hero video');

  const lm = await pool.query(`SELECT 1 FROM learn_more_section WHERE bg_data_url = $1`, [dataUrl]);
  if (lm.rows.length) usages.push('Learn More section background');

  const cs = await pool.query(
    `SELECT id, title FROM collection_stories WHERE media_data_url = $1 OR secondary_image_data_url = $1`,
    [dataUrl]
  );
  cs.rows.forEach(r => usages.push(`Collection "${r.title || ('#' + r.id)}"`));

  const ed = await pool.query(`SELECT id FROM editorial_items WHERE media_data_url = $1`, [dataUrl]);
  ed.rows.forEach(r => usages.push(`Editorial item #${r.id}`));

  const pm = await pool.query(`SELECT id, name FROM payment_methods WHERE config->>'qrDataUrl' = $1`, [dataUrl]);
  pm.rows.forEach(r => usages.push(`"${r.name}" payment QR code`));

  return usages;
}

// ---------- Admin only — this is a dashboard tool, not a public feed ----------

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM media ORDER BY uploaded_at DESC, id DESC');
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load the media library.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { filename, type, dataUrl, size } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'No file data received.' });
  const kind = type === 'video' ? 'video' : 'image';
  try {
    const { rows } = await pool.query(
      `INSERT INTO media (filename, type, data_url, size) VALUES ($1,$2,$3,$4) RETURNING *`,
      [(filename || '').slice(0, 200), kind, dataUrl, Number(size) || null]
    );
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save that file — try a smaller one.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM media WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });

    const force = req.query.force === '1';
    if (!force) {
      const usages = await findUsages(rows[0].data_url);
      if (usages.length) {
        return res.status(409).json({ error: 'This file is still in use.', inUse: true, usages });
      }
    }

    await pool.query('DELETE FROM media WHERE id=$1', [req.params.id]);
    res.json({ id: Number(req.params.id), deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not delete that file.' });
  }
});

module.exports = router;
