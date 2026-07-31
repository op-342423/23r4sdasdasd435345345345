/* ==========================================================
   collections.js — Collection Stories (brief Part 9). Multi-row,
   same admin-editable philosophy as products / learn-more: the
   owner adds one row per collection ("chapter") from the admin
   dashboard, with a title, mood, story, and hero media, and the
   homepage renders whatever rows are enabled, in display order.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    title: row.title || '',
    mood: row.mood || '',
    story: row.story || '',
    mediaType: row.media_type || 'image',
    mediaDataUrl: row.media_data_url || '',
    secondaryImageDataUrl: row.secondary_image_data_url || '',
    linkUrl: row.link_url || '',
    enabled: !!row.enabled,
    displayOrder: row.display_order || 0
  };
}

// ---------- Public ----------
// Admin dashboard also uses this same endpoint (it needs the full
// list including disabled rows), gated by the `all=1` query flag
// plus an admin check — everyone else only ever gets enabled rows.

router.get('/', async (req, res) => {
  try {
    if (req.query.all === '1' && req.user && req.user.isAdmin) {
      const { rows } = await pool.query('SELECT * FROM collection_stories ORDER BY display_order ASC, created_at ASC');
      return res.json(rows.map(serialize));
    }
    const { rows } = await pool.query(
      'SELECT * FROM collection_stories WHERE enabled=TRUE ORDER BY display_order ASC, created_at ASC'
    );
    res.json(rows.map(serialize));
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

// ---------- Admin ----------

router.post('/', requireAdmin, async (req, res) => {
  let { title, mood, story, mediaType, mediaDataUrl, secondaryImageDataUrl, linkUrl, enabled, displayOrder } = req.body;
  title = (title || '').trim();
  if (!title) return res.status(400).json({ error: 'Please give the collection a title.' });
  mood = (mood || '').trim();
  story = (story || '').trim();
  mediaType = mediaType === 'video' ? 'video' : 'image';
  mediaDataUrl = mediaDataUrl || '';
  secondaryImageDataUrl = secondaryImageDataUrl || '';
  linkUrl = (linkUrl || '').trim();
  enabled = enabled === undefined ? true : !!enabled;
  displayOrder = Number.isFinite(Number(displayOrder)) ? parseInt(displayOrder, 10) : 0;

  try {
    const { rows } = await pool.query(
      `INSERT INTO collection_stories
         (title, mood, story, media_type, media_data_url, secondary_image_data_url, link_url, enabled, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, mood || null, story || null, mediaType, mediaDataUrl || null, secondaryImageDataUrl || null, linkUrl || null, enabled, displayOrder]
    );
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save the collection — try a smaller/shorter media file.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM collection_stories WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
