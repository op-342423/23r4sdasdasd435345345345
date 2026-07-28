/* ==========================================================
   db.js — Postgres connection pool + schema bootstrap.
   Runs the CREATE TABLE IF NOT EXISTS statements on startup,
   so a fresh Neon database wires itself up automatically the
   first time the server boots — no manual SQL needed.
   ========================================================== */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to your .env / Render environment.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  badge TEXT,
  stock INTEGER,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT, email TEXT, phone TEXT, address TEXT, notes TEXT,
  location JSONB,
  coupon TEXT,
  subtotal NUMERIC, discount NUMERIC, delivery_fee NUMERIC, total NUMERIC,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  name TEXT, price NUMERIC, currency TEXT, qty INTEGER
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS hero_video (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data_url TEXT,
  start_s NUMERIC,
  end_s NUMERIC,
  fit TEXT,
  brightness INTEGER
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  facebook_url TEXT,
  instagram_url TEXT,
  phone TEXT
);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS about_text TEXT;
-- Part 8/10 of the brief: dynamic brand name + editable hero tagline,
-- same single-row settings pattern. NULL means "use the shipped
-- default", so existing installs keep working with no migration step.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_tagline TEXT;

-- Single-row pattern, same as hero_video / site_settings: the owner
-- edits this from the admin dashboard "Learn More" panel and it
-- drives the dynamic Learn More section on the homepage.
CREATE TABLE IF NOT EXISTS learn_more_section (
  id INTEGER PRIMARY KEY DEFAULT 1,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  quote TEXT,
  button_text TEXT,
  button_url TEXT,
  bg_type TEXT DEFAULT 'image',
  bg_data_url TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  accent_color TEXT
);

-- Part 9 of the brief: collections as storytelling, not just a grid.
-- Each row is one collection "chapter" — title, story, mood, hero
-- media, and an optional second photo — admin-managed, multi-row.
CREATE TABLE IF NOT EXISTS collection_stories (
  id SERIAL PRIMARY KEY,
  title TEXT,
  mood TEXT,
  story TEXT,
  media_type TEXT DEFAULT 'image',
  media_data_url TEXT,
  secondary_image_data_url TEXT,
  link_url TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Part 10 of the brief: pure storytelling — campaign photography,
-- runway/BTS stills or clips, and quotes. No prices, ever (enforced
-- by the schema simply not having a price column). Admin-managed,
-- multi-row, rendered as an editorial grid.
CREATE TABLE IF NOT EXISTS editorial_items (
  id SERIAL PRIMARY KEY,
  kind TEXT DEFAULT 'image',
  media_data_url TEXT,
  caption TEXT,
  quote_text TEXT,
  quote_author TEXT,
  size TEXT DEFAULT 'normal',
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const DEFAULT_PRODUCTS = [
  { name: 'Vein Ring', price: 45, currency: 'USD', category: 'Rings', stock: 12, description: 'Cast in blackened silver — a single vein of red runs through the band.' },
  { name: 'Ash Hoodie', price: 60, currency: 'USD', category: 'Clothing', stock: 8, description: 'Heavyweight fleece, oversized fit, faded like it survived something.' },
  { name: 'Root Chain', price: 850, currency: 'EGP', category: 'Accessories', stock: 5, description: 'Hand-linked chain with a matte-black finish. Not made for everyone.' }
];

async function init() {
  await pool.query(SCHEMA);

  // Seed default products only if the table is empty.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (rows[0].count === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      await pool.query(
        `INSERT INTO products (name, price, currency, category, stock, description, images)
         VALUES ($1,$2,$3,$4,$5,$6,'[]')`,
        [p.name, p.price, p.currency, p.category, p.stock, p.description]
      );
    }
    console.log('Seeded default products.');
  }

  // Create or promote the admin account from env vars.
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (email, password_hash, is_admin) VALUES ($1,$2,TRUE)',
        [email, hash]
      );
      console.log(`Admin account created: ${email}`);
    } else {
      await pool.query('UPDATE users SET is_admin=TRUE WHERE email=$1', [email]);
    }
  }
}

module.exports = { pool, init };
