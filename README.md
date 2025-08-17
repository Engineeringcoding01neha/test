# ShoeKart

A simple full-stack e-commerce site for shoes with user and admin roles.

- User: browse products, add to cart (multiple items), checkout with delivery address and payment method (COD/Card simulated)
- Admin: dashboard with stats, manage products (create/edit/delete), view and update order status

## Tech
- Node.js, Express, EJS
- SQLite (better-sqlite3)

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Seed database (creates demo admin and user + sample products)

```bash
node src/seed/seed.js
```

3. Run the app

```bash
npm run dev
```

Open http://localhost:3000

## Demo Accounts
- Admin: admin@shoekart.test / admin123
- User: user@shoekart.test / user123

## Environment
- Configure `PORT` and `JWT_SECRET` in `.env` (defaults provided).