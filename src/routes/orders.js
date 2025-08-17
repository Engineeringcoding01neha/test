const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, getOrCreateCartIdForUser } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}

router.get('/checkout', requireAuth, (req, res) => {
  const cartId = getOrCreateCartIdForUser(req.user.id);
  const items = db.prepare(`
    SELECT ci.quantity, p.id as product_id, p.name, p.price_cents, p.image_url
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = ?
  `).all(cartId);
  const subtotal = items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0);
  res.render('orders/checkout', { title: 'Checkout', items, subtotal, formatPrice, errors: [], values: {} });
});

router.post(
  '/checkout',
  requireAuth,
  body('payment_method').isIn(['cod', 'card']).withMessage('Select payment method'),
  body('delivery_name').notEmpty(),
  body('delivery_phone').notEmpty(),
  body('delivery_address1').notEmpty(),
  body('delivery_city').notEmpty(),
  body('delivery_state').notEmpty(),
  body('delivery_postal_code').notEmpty(),
  body('delivery_country').notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    const cartId = getOrCreateCartIdForUser(req.user.id);
    const items = db.prepare(`
      SELECT ci.quantity, p.id as product_id, p.name, p.price_cents, p.stock_qty
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?
    `).all(cartId);
    const subtotal = items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0);
    if (!errors.isEmpty()) {
      return res.status(422).render('orders/checkout', { title: 'Checkout', items, subtotal, formatPrice, errors: errors.array(), values: req.body });
    }
    if (items.length === 0) {
      return res.redirect('/cart');
    }

    // Validate stock
    for (const it of items) {
      if (it.quantity > it.stock_qty) {
        return res.status(400).render('orders/checkout', { title: 'Checkout', items, subtotal, formatPrice, errors: [{ msg: `Insufficient stock for ${it.name}` }], values: req.body });
      }
    }

    // Create order
    const info = db.prepare(`
      INSERT INTO orders (
        user_id, total_cents, payment_method, status, delivery_name, delivery_phone, delivery_address1, delivery_address2,
        delivery_city, delivery_state, delivery_postal_code, delivery_country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      subtotal,
      req.body.payment_method,
      req.body.payment_method === 'card' ? 'paid' : 'pending',
      req.body.delivery_name,
      req.body.delivery_phone,
      req.body.delivery_address1,
      req.body.delivery_address2 || null,
      req.body.delivery_city,
      req.body.delivery_state,
      req.body.delivery_postal_code,
      req.body.delivery_country
    );

    const orderId = info.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)');
    const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?');

    const tx = db.transaction((list) => {
      for (const it of list) {
        insertItem.run(orderId, it.product_id, it.quantity, it.price_cents);
        updateStock.run(it.quantity, it.product_id);
      }
      db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
    });
    tx(items);

    res.redirect(`/orders/${orderId}`);
  }
);

router.get('/orders', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.render('orders/list', { title: 'Your Orders', orders, formatPrice });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).render('404', { title: 'Not Found' });
  const items = db.prepare(`
    SELECT oi.quantity, oi.price_cents, p.name, p.image_url
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(order.id);
  res.render('orders/detail', { title: `Order #${order.id}`, order, items, formatPrice });
});

module.exports = router;