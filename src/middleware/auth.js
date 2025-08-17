const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

async function attachUser(req, res, next) {
	const token = req.cookies && req.cookies.token;
	if (!token) {
		req.user = null;
		return next();
	}
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		const db = await getDb();
		const user = db.prepare('SELECT id, email, role, name FROM users WHERE id = ?').get(payload.id);
		req.user = user || null;
	} catch (err) {
		req.user = null;
	}
	next();
}

function requireAuth(req, res, next) {
	if (!req.user) {
		return res.redirect('/login');
	}
	next();
}

function requireAdmin(req, res, next) {
	if (!req.user) {
		return res.redirect('/login');
	}
	if (req.user.role !== 'admin') {
		return res.status(403).send('Forbidden');
	}
	next();
}

module.exports = {
	attachUser,
	requireAuth,
	requireAdmin,
};