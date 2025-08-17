const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb, getOrCreateCartIdForUser, touchUpdatedAt } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function formatPrice(cents) {
	return (cents / 100).toFixed(2);
}

router.get('/cart', requireAuth, async (req, res) => {
	const db = await getDb();
	const cartId = await getOrCreateCartIdForUser(req.user.id);
	const items = db.prepare(`
		SELECT ci.id as cart_item_id, ci.quantity, p.id as product_id, p.name, p.price_cents, p.image_url, p.stock_qty
		FROM cart_items ci
		JOIN products p ON p.id = ci.product_id
		WHERE ci.cart_id = ?
	`).all(cartId);
	const subtotal = items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0);
	res.render('cart/view', { title: 'Your Cart', items, subtotal, formatPrice });
});

router.post(
	'/cart/add',
	requireAuth,
	body('product_id').isInt({ min: 1 }),
	body('quantity').isInt({ min: 1 }),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(422).send('Invalid');
		const { product_id, quantity } = req.body;
		const db = await getDb();
		const product = db.prepare('SELECT id, stock_qty FROM products WHERE id = ?').get(product_id);
		if (!product) return res.status(404).send('Not found');
		const qty = Math.min(Number(quantity), product.stock_qty);
		const cartId = await getOrCreateCartIdForUser(req.user.id);
		const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, product_id);
		if (existing) {
			db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(existing.quantity + qty, existing.id);
			await touchUpdatedAt('cart_items', existing.id);
		} else {
			db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(cartId, product_id, qty);
		}
		await touchUpdatedAt('carts', cartId);
		res.redirect('/cart');
	}
);

router.post('/cart/item/:id/update', requireAuth, body('quantity').isInt({ min: 1 }), async (req, res) => {
	const db = await getDb();
	const ci = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(req.params.id);
	if (!ci) return res.status(404).send('Not found');
	const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(ci.product_id);
	const qty = Math.min(Number(req.body.quantity), product.stock_qty);
	db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(qty, ci.id);
	await touchUpdatedAt('cart_items', ci.id);
	res.redirect('/cart');
});

router.post('/cart/item/:id/delete', requireAuth, async (req, res) => {
	const db = await getDb();
	const ci = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(req.params.id);
	if (!ci) return res.redirect('/cart');
	db.prepare('DELETE FROM cart_items WHERE id = ?').run(ci.id);
	res.redirect('/cart');
});

module.exports = router;