const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { title: 'Login', errors: [], values: {} });
});

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password required'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', { title: 'Login', errors: errors.array(), values: req.body });
    }
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).render('auth/login', { title: 'Login', errors: [{ msg: 'Invalid credentials' }], values: { email } });
    }
    bcrypt.compare(password, user.password_hash).then((ok) => {
      if (!ok) {
        return res.status(401).render('auth/login', { title: 'Login', errors: [{ msg: 'Invalid credentials' }], values: { email } });
      }
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: true });
      if (user.role === 'admin') return res.redirect('/admin');
      return res.redirect('/');
    });
  }
);

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { title: 'Register', errors: [], values: {} });
});

router.post(
  '/register',
  body('name').notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Minimum 6 chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/register', { title: 'Register', errors: errors.array(), values: req.body });
    }
    const { name, email, password } = req.body;
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) {
      return res.status(400).render('auth/register', { title: 'Register', errors: [{ msg: 'Email already registered' }], values: req.body });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, passwordHash, 'user');
    const token = jwt.sign({ id: info.lastInsertRowid, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/');
  }
);

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;