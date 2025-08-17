const { db } = require('../db');

function getAdminStats() {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const revenueCents = db.prepare("SELECT COALESCE(SUM(total_cents), 0) as s FROM orders WHERE status IN ('paid','shipped','completed')").get().s;
  const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock_qty < 5').get().c;

  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.image_url, SUM(oi.quantity) as sold_qty, SUM(oi.quantity * oi.price_cents) as revenue_cents
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    GROUP BY oi.product_id
    ORDER BY sold_qty DESC
    LIMIT 5
  `).all();

  return { totalUsers, totalProducts, totalOrders, revenueCents, lowStock, topProducts };
}

module.exports = { getAdminStats };