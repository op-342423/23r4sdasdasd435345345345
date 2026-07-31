# THORN — real backend

This turns the shop from a browser-only demo into a real app: one shared
product catalog, real accounts, a wishlist, and order tracking that both
customers and the owner can see — no matter what device they're on.

## What changed

- **Database (Postgres)** stores products, users, orders, and wishlist.
- **Accounts** — email + password, used for wishlist and "Your orders".
- **`/wishlist.html`** — a customer's saved items.
- **`/my-orders.html`** — order status timeline (Pending → Accepted → Out
  for delivery → Delivered), updated live by you from the admin panel.
- **`/admin.html`** — now requires an admin login, and adds:
  - An **Orders** panel where you set each order's status.
  - An **Overview** panel: revenue, order counts, low stock, top sellers.
- The cart itself still lives in the browser (perfectly normal — it's just
  a temporary basket before checkout), but everything that needs to be
  shared (products, orders, wishlist, accounts) now lives in the database.

## 1. Set up a free database (Neon)

Render no longer offers a free managed Postgres, so we'll use
[Neon](https://neon.tech) — a free serverless Postgres that plugs in with
just a connection string.

1. Go to neon.tech → sign up (free) → **Create a project**.
2. Once created, open the project's **Connection Details** and copy the
   connection string. It looks like:
   `postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Keep that string handy — it goes into `DATABASE_URL` in step 2.

You don't need to run any SQL yourself — the server creates all the
tables automatically the first time it starts.

## 2. Deploy to Render

1. Push this project to a GitHub repo.
2. On Render: **New +** → **Web Service** → connect the repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add these **Environment Variables** (Render dashboard → Environment):
   - `DATABASE_URL` — the Neon connection string from step 1
   - `JWT_SECRET` — any long random string (e.g. generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `ADMIN_EMAIL` — the email you'll use to log into `/admin.html`
   - `ADMIN_PASSWORD` — the password for that account
   - `NODE_ENV` — `production`
5. Deploy. On first boot the server will:
   - Create all database tables
   - Seed the 3 default products
   - Create your admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

Visit your Render URL — the shop is now live, and `/admin.html` will ask
you to log in with the admin account you set.

## 3. Local development (optional)

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm start
```

Then open `http://localhost:3000`.

## Known limitations (things to grow into later, not blockers)

- Product photos and the hero video are stored as base64 text directly in
  Postgres. Fine for a small shop, but Neon's free tier has a storage cap
  (usually ~0.5GB) — keep the hero video short/compressed, and if you add
  a lot of products with 5 photos each you may eventually want to move
  images to a file host (e.g. Cloudinary/S3) instead of the database.
- There's one admin account, set via environment variables. If you want
  multiple staff logins, you'd promote more users by setting
  `is_admin = true` for them directly in the database.
- No password reset flow yet (would need an email-sending service).
- The cart itself is still per-device (localStorage) — standard for most
  e-commerce sites, but it means an in-progress cart won't follow a
  customer from their phone to their laptop.
