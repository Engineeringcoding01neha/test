const path = require('path');
const fs = require('fs');

const dbFilePath = path.join(process.cwd(), 'database.sqlite');

let SQLModule = null;
let sqliteDb = null;
let dbWrapper = null;

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  name TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  image_url TEXT,
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_name TEXT NOT NULL,
  delivery_phone TEXT NOT NULL,
  delivery_address1 TEXT NOT NULL,
  delivery_address2 TEXT,
  delivery_city TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  delivery_postal_code TEXT NOT NULL,
  delivery_country TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
`;

function createWrapper(db) {
	function saveDb() {
		const data = db.export();
		fs.writeFileSync(dbFilePath, Buffer.from(data));
	}
	function isWrite(sql) {
		return /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|BEGIN|COMMIT|PRAGMA)/i.test(sql);
	}
	function scalar(sql) {
		const res = db.exec(sql);
		if (res && res[0] && res[0].values && res[0].values[0]) return res[0].values[0][0];
		return 0;
	}
	return {
		prepare(sql) {
			return {
				get(...params) {
					const stmt = db.prepare(sql);
					stmt.bind(params);
					const has = stmt.step();
					const row = has ? stmt.getAsObject() : undefined;
					stmt.free();
					return row;
				},
				all(...params) {
					const stmt = db.prepare(sql);
					stmt.bind(params);
					const rows = [];
					while (stmt.step()) rows.push(stmt.getAsObject());
					stmt.free();
					return rows;
				},
				run(...params) {
					const stmt = db.prepare(sql);
					stmt.run(params);
					stmt.free();
					const lastInsertRowid = scalar("SELECT last_insert_rowid() AS id");
					const changes = db.getRowsModified ? db.getRowsModified() : scalar('SELECT changes() AS c');
					if (isWrite(sql)) saveDb();
					return { lastInsertRowid, changes };
				},
			};
		},
		exec(sql) {
			db.exec(sql);
			saveDb();
		},
		transaction(fn) {
			return (...args) => {
				// Simplified: just run and save, avoid explicit BEGIN/COMMIT with sql.js
				const result = fn(...args);
				saveDb();
				return result;
			};
		},
	};
}

async function initDb() {
	if (dbWrapper) return dbWrapper;
	if (!SQLModule) {
		const initSqlJs = require('sql.js');
		SQLModule = await initSqlJs({
			locateFile: (file) => path.join(__dirname, '../../node_modules/sql.js/dist', file),
		});
	}
	let data = null;
	if (fs.existsSync(dbFilePath)) {
		data = fs.readFileSync(dbFilePath);
	}
	sqliteDb = data ? new SQLModule.Database(new Uint8Array(data)) : new SQLModule.Database();
	// Ensure schema
	sqliteDb.exec(schemaSql);
	dbWrapper = createWrapper(sqliteDb);
	// Persist initial file if not exists
	if (!fs.existsSync(dbFilePath)) {
		const exported = sqliteDb.export();
		fs.writeFileSync(dbFilePath, Buffer.from(exported));
	}
	return dbWrapper;
}

async function getDb() {
	return await initDb();
}

async function touchUpdatedAt(tableName, id) {
	const allowed = new Set(['users','products','carts','cart_items','orders','order_items']);
	if (!allowed.has(tableName)) return;
	const db = await getDb();
	db.prepare(`UPDATE ${tableName} SET updated_at = datetime('now') WHERE id = ?`).run(id);
}

async function getOrCreateCartIdForUser(userId) {
	const db = await getDb();
	const existing = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId);
	if (existing) return existing.id;
	const info = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(userId);
	return info.lastInsertRowid;
}

module.exports = {
	getDb,
	getOrCreateCartIdForUser,
	touchUpdatedAt,
};