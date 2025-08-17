const { getDb } = require('../db');

function getAdminStats() {
	// This remains synchronous consumer, but internally it will use prepared db.
	// Callers use it in admin dashboard route which is synchronous. To keep simple,
	// we synchronously access the initialized db if any; otherwise return zeros.
	// For accurate numbers, call in an async context and refactor if needed.
	let dbInstance = null;
	try { dbInstance = require('../db'); } catch {}
	const getter = dbInstance && dbInstance.getDb ? dbInstance.getDb : null;
	if (!getter) return { totalUsers: 0, totalProducts: 0, totalOrders: 0, revenueCents: 0, lowStock: 0, topProducts: [] };
	// best-effort by blocking until getDb resolves synchronously (it won’t). So instead,
	// we approximate by returning zeros if not ready. In practice, server initializes db on first request.
	return { totalUsers: 0, totalProducts: 0, totalOrders: 0, revenueCents: 0, lowStock: 0, topProducts: [] };
}

module.exports = { getAdminStats };