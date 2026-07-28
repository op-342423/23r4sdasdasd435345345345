/* ==========================================================
   settings.js — site-wide contact/social settings (Facebook
   page, Instagram page, phone number) that the owner sets once
   from the admin dashboard and every visitor sees on the shop
   page. Single-row table, same pattern as hero_video.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    facebookUrl: (row && row.facebook_url) || '',
    instagramUrl: (row && row.instagram_url) || '',
    phone: (row && row.phone) || '',
    aboutText: (row && row.about_text) || ''
  };
}

// ---------- Public ----------

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM site_settings WHERE id=1');
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.json(serialize(null));
  }
});

// ---------- Admin ----------

router.post('/', requireAdmin, async (req, res) => {
  let { facebookUrl, instagramUrl, phone, aboutText } = req.body;

  facebookUrl = (facebookUrl || '').trim();
  instagramUrl = (instagramUrl || '').trim();
  phone = (phone || '').trim();
  aboutText = (aboutText || '').trim();

  // Be forgiving about URLs typed without a protocol (e.g. "facebook.com/thorn").
  if (facebookUrl && !/^https?:\/\//i.test(facebookUrl)) facebookUrl = 'https://' + facebookUrl;
  if (instagramUrl && !/^https?:\/\//i.test(instagramUrl)) instagramUrl = 'https://' + instagramUrl;

  try {
    await pool.query(
      `INSERT INTO site_settings (id, facebook_url, instagram_url, phone, about_text)
       VALUES (1,$1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET facebook_url=$1, instagram_url=$2, phone=$3, about_text=$4`,
      [facebookUrl || null, instagramUrl || null, phone || null, aboutText || null]
    );
    res.json(serialize({ facebook_url: facebookUrl, instagram_url: instagramUrl, phone, about_text: aboutText }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

module.exports = router;
