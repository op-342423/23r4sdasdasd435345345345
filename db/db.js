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
