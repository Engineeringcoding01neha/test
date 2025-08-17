const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../utils/stats');

const router = express.Router();

function formatPrice(cents) {
	return (cents / 100).toFixed(2);
}

router.get('/', requireAdmin, (req, res) => {
	const stats = getAdminStats();
	res.render('admin/dashboard', { title: 'Admin Dashboard', stats, formatPrice });
});

router.get('/products', requireAdmin, async (req, res) => {
	const db = await getDb();
	const products = db.prepare('SELECT * FROM products ORDER BY updated_at DESC').all();
	res.render('admin/products', { title: 'Manage Products', products, formatPrice });
});

router.get('/products/new', requireAdmin, (req, res) => {
	res.render('admin/product_form', { title: 'New Product', product: null, errors: [], values: {} });
});

router.post(
	'/products',
	requireAdmin,
	body('name').notEmpty(),
	body('description').notEmpty(),
	body('price_cents').isInt({ min: 0 }),
	body('stock_qty').isInt({ min: 0 }),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(422).render('admin/product_form', { title: 'New Product', product: null, errors: errors.array(), values: req.body });
		}
		const db = await getDb();
		const { name, description, price_cents, image_url, stock_qty } = req.body;
		db.prepare('INSERT INTO products (name, description, price_cents, image_url, stock_qty) VALUES (?, ?, ?, ?, ?)')
			.run(name, description, Number(price_cents), image_url || null, Number(stock_qty));
		res.redirect('/admin/products');
	}
);

router.get('/products/:id/edit', requireAdmin, async (req, res) => {
	const db = await getDb();
	const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
	if (!product) return res.redirect('/admin/products');
	res.render('admin/product_form', { title: `Edit ${product.name}`, product, errors: [], values: product });
});

router.post(
	'/products/:id',
	requireAdmin,
	body('name').notEmpty(),
	body('description').notEmpty(),
	body('price_cents').isInt({ min: 0 }),
	body('stock_qty').isInt({ min: 0 }),
	async (req, res) => {
		const db = await getDb();
		const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
		if (!product) return res.redirect('/admin/products');
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(422).render('admin/product_form', { title: `Edit ${product.name}`, product, errors: errors.array(), values: req.body });
		}
		const { name, description, price_cents, image_url, stock_qty } = req.body;
		db.prepare("UPDATE products SET name = ?, description = ?, price_cents = ?, image_url = ?, stock_qty = ?, updated_at = datetime('now') WHERE id = ?")
			.run(name, description, Number(price_cents), image_url || null, Number(stock_qty), product.id);
		res.redirect('/admin/products');
	}
);

router.post('/products/:id/delete', requireAdmin, async (req, res) => {
	const db = await getDb();
	db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
	res.redirect('/admin/products');
});

router.get('/orders', requireAdmin, async (req, res) => {
	const db = await getDb();
	const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
	res.render('admin/orders', { title: 'All Orders', orders, formatPrice });
});

router.post('/orders/:id/status', requireAdmin, body('status').isIn(['pending', 'paid', 'shipped', 'completed', 'cancelled']), async (req, res) => {
	const db = await getDb();
	db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, req.params.id);
	res.redirect('/admin/orders');
});

module.exports = router;