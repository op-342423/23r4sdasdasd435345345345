/* ==========================================================
   settings.js — site-wide contact/social settings (Facebook
   page, Instagram page, phone number), the dynamic brand name
   (Part 8), and the editable hero tagline (Part 10). The owner
   sets these once from the admin dashboard and every visitor
   sees them applied site-wide. Single-row table, same pattern
   as hero_video.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Shipped defaults — used whenever the owner hasn't set a value yet,
// so a brand-new install (or a field left blank) never shows up empty.
const DEFAULT_BRAND_NAME = 'THORN';
const DEFAULT_HERO_TAGLINE = 'NOT MADE FOR EVERYONE.';

function serialize(row) {
  return {
    facebookUrl: (row && row.facebook_url) || '',
    instagramUrl: (row && row.instagram_url) || '',
    phone: (row && row.phone) || '',
    aboutText: (row && row.about_text) || '',
    brandName: (row && row.brand_name) || DEFAULT_BRAND_NAME,
    heroTagline: (row && row.hero_tagline) || DEFAULT_HERO_TAGLINE
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
  let { facebookUrl, instagramUrl, phone, aboutText, brandName, heroTagline } = req.body;

  facebookUrl = (facebookUrl || '').trim();
  instagramUrl = (instagramUrl || '').trim();
  phone = (phone || '').trim();
  aboutText = (aboutText || '').trim();
  brandName = (brandName || '').trim();
  heroTagline = (heroTagline || '').trim();

  // Be forgiving about URLs typed without a protocol (e.g. "facebook.com/thorn").
  if (facebookUrl && !/^https?:\/\//i.test(facebookUrl)) facebookUrl = 'https://' + facebookUrl;
  if (instagramUrl && !/^https?:\/\//i.test(instagramUrl)) instagramUrl = 'https://' + instagramUrl;

  try {
    await pool.query(
      `INSERT INTO site_settings (id, facebook_url, instagram_url, phone, about_text, brand_name, hero_tagline)
       VALUES (1,$1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET facebook_url=$1, instagram_url=$2, phone=$3, about_text=$4, brand_name=$5, hero_tagline=$6`,
      [facebookUrl || null, instagramUrl || null, phone || null, aboutText || null, brandName || null, heroTagline || null]
    );
    res.json(serialize({
      facebook_url: facebookUrl, instagram_url: instagramUrl, phone, about_text: aboutText,
      brand_name: brandName, hero_tagline: heroTagline
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

module.exports = router;
