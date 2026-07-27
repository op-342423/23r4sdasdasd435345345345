/* ==========================================================
   server.js — entry point.
   Loads env vars, sets up middleware, mounts API routes,
   serves the /public frontend, and initializes the database
   schema on boot.
   ========================================================== */

// Load .env for local development. On Render, environment
// variables are set in the dashboard instead, and this simply
// finds no file and does nothing.
try {
  const fs = require('fs');
  if (fs.existsSync('.env')) {
    fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = process.env[match[1].trim()] || match[2].trim();
    });
  }
} catch (e) { /* ignore */ }

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { init } = require('./db/db');
const { attachUser } = require('./middleware/auth');

const app = express();
app.use(express.json({ limit: '15mb' })); // photos/video arrive as base64 in JSON
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wishlist', require('./routes/wishlist'));

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`THORN server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
