const express = require('express');
const { db } = require('../db');

const router = express.Router();

function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}

router.get('/products', (req, res) => {
  const q = (req.query.q || '').trim();
  let products = [];
  if (q) {
    products = db.prepare('SELECT * FROM products WHERE name LIKE ? ORDER BY created_at DESC').all(`%${q}%`);
  } else {
    products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  }
  res.render('products/list', { title: 'Products', products, formatPrice, q });
});

router.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).render('404', { title: 'Not Found' });
  res.render('products/detail', { title: product.name, product, formatPrice });
});

module.exports = router;