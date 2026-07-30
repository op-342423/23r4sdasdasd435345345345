/* ==========================================================
   learn-more.js — the dynamic "Learn More" section shown on the
   homepage. Single-row table, same pattern as hero_video /
   site_settings: the owner edits everything from the admin
   dashboard and the homepage re-fetches it on load. Content is
   never hardcoded in the frontend.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return {
    title: (row && row.title) || '',
    subtitle: (row && row.subtitle) || '',
    description: (row && row.description) || '',
    quote: (row && row.quote) || '',
    buttonText: (row && row.button_text) || '',
    buttonUrl: (row && row.button_url) || '',
    bgType: (row && row.bg_type) || 'image',
    bgDataUrl: (row && row.bg_data_url) || '',
    enabled: !!(row && row.enabled),
    displayOrder: (row && row.display_order) || 0,
    accentColor: (row && row.accent_color) || ''
  };
}

// ---------- Public (also used by the admin dashboard to load the
// current values into the editor — same GET, no auth required to
// read, same as hero-video / site settings) ----------

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM learn_more_section WHERE id=1');
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.json(serialize(null));
  }
});

// ---------- Admin ----------

router.post('/', requireAdmin, async (req, res) => {
  let { title, subtitle, description, quote, buttonText, buttonUrl, bgType, bgDataUrl, enabled, displayOrder, accentColor } = req.body;

  title = (title || '').trim();
  subtitle = (subtitle || '').trim();
  description = (description || '').trim();
  quote = (quote || '').trim();
  buttonText = (buttonText || '').trim();
  buttonUrl = (buttonUrl || '').trim();
  bgType = bgType === 'video' ? 'video' : 'image';
  bgDataUrl = bgDataUrl || '';
  enabled = !!enabled;
  displayOrder = Number.isFinite(Number(displayOrder)) ? parseInt(displayOrder, 10) : 0;
  accentColor = (accentColor || '').trim();

  if (buttonUrl && !/^https?:\/\//i.test(buttonUrl) && !buttonUrl.startsWith('#') && !buttonUrl.startsWith('/')) {
    buttonUrl = 'https://' + buttonUrl;
  }

  try {
    await pool.query(
      `INSERT INTO learn_more_section
         (id, title, subtitle, description, quote, button_text, button_url, bg_type, bg_data_url, enabled, display_order, accent_color)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         title=$1, subtitle=$2, description=$3, quote=$4, button_text=$5, button_url=$6,
         bg_type=$7, bg_data_url=$8, enabled=$9, display_order=$10, accent_color=$11`,
      [title || null, subtitle || null, description || null, quote || null, buttonText || null, buttonUrl || null,
        bgType, bgDataUrl || null, enabled, displayOrder, accentColor || null]
    );
    res.json(serialize({
      title, subtitle, description, quote, button_text: buttonText, button_url: buttonUrl,
      bg_type: bgType, bg_data_url: bgDataUrl, enabled, display_order: displayOrder, accent_color: accentColor
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save the Learn More section — try a smaller background file.' });
  }
});

module.exports = router;
