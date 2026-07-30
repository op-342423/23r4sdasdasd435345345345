/* ==========================================================
   announcement.js — the admin-controlled announcement bar shown
   above the nav on every storefront page (brief item 11, this
   batch). Single-row table, same pattern as hero_video /
   site_settings / learn_more_section: the owner edits it from the
   admin dashboard and every page re-fetches it on load.
   ========================================================== */
const express = require('express');
const { pool } = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_BG = '#0A0A0A';
const DEFAULT_TEXT = '#F2EEE7';

function serialize(row) {
  return {
    text: (row && row.text) || '',
    enabled: !!(row && row.enabled),
    linkUrl: (row && row.link_url) || '',
    bgColor: (row && row.bg_color) || DEFAULT_BG,
    textColor: (row && row.text_color) || DEFAULT_TEXT
  };
}

// ---------- Public ----------

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM announcement_bar WHERE id=1');
    res.json(serialize(rows[0]));
  } catch (e) {
    console.error(e);
    res.json(serialize(null));
  }
});

// ---------- Admin ----------

router.post('/', requireAdmin, async (req, res) => {
  let { text, enabled, linkUrl, bgColor, textColor } = req.body;

  text = (text || '').trim();
  enabled = !!enabled;
  linkUrl = (linkUrl || '').trim();
  bgColor = (bgColor || '').trim();
  textColor = (textColor || '').trim();

  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith('#') && !linkUrl.startsWith('/')) {
    linkUrl = 'https://' + linkUrl;
  }
  if (enabled && !text) {
    return res.status(400).json({ error: 'Add some text before enabling the announcement bar.' });
  }

  try {
    await pool.query(
      `INSERT INTO announcement_bar (id, text, enabled, link_url, bg_color, text_color)
       VALUES (1,$1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET text=$1, enabled=$2, link_url=$3, bg_color=$4, text_color=$5`,
      [text || null, enabled, linkUrl || null, bgColor || null, textColor || null]
    );
    res.json(serialize({ text, enabled, link_url: linkUrl, bg_color: bgColor, text_color: textColor }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save the announcement bar.' });
  }
});

module.exports = router;
