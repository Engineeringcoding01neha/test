require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

async function seed() {
	const db = await getDb();
	const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
	if (userCount === 0) {
		const passwordHash = await bcrypt.hash('admin123', 10);
		db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)')
			.run('admin@shoekart.test', passwordHash, 'admin', 'Admin');
		const userHash = await bcrypt.hash('user123', 10);
		db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)')
			.run('user@shoekart.test', userHash, 'user', 'Demo User');
		// Sample products
		const sampleProducts = [
			{ name: 'Air Runner Pro', description: 'Lightweight running shoes with breathable mesh and responsive cushioning.', price_cents: 6999, image_url: 'https://images.unsplash.com/photo-1542293787938-c9e299b88054', stock_qty: 25 },
			{ name: 'Street Sneak Classic', description: 'Timeless low-top sneakers with durable canvas and rubber sole.', price_cents: 4999, image_url: 'https://images.unsplash.com/photo-1514986888952-8cd320577b68', stock_qty: 40 },
			{ name: 'Trail Master GTX', description: 'Waterproof trail shoes with aggressive grip and protective toe cap.', price_cents: 8999, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', stock_qty: 15 },
			{ name: 'Court Ace 2.0', description: 'All-court tennis shoes offering stability and comfort.', price_cents: 7999, image_url: 'https://images.unsplash.com/photo-1520256862855-398228c41684', stock_qty: 18 },
		];

		const insert = db.prepare('INSERT INTO products (name, description, price_cents, image_url, stock_qty) VALUES (?, ?, ?, ?, ?)');
		const tx = db.transaction((items) => {
			for (const p of items) insert.run(p.name, p.description, p.price_cents, p.image_url, p.stock_qty);
		});
		tx(sampleProducts);

		console.log('Seeded admin and sample products.');
	} else {
		console.log('Seed skipped; users already exist.');
	}
}

seed().then(() => process.exit(0));