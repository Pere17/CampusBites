const express = require('express');
const bcrypt = require('bcryptjs');
const { tx, load } = require('../data/store');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { name, email, password, role, businessName, description } = req.body;

  if (!name || !email || !password || !role) {
    return res.render('register', { error: 'All fields are required.' });
  }
  if (!['student', 'vendor'].includes(role)) {
    return res.render('register', { error: 'Invalid role.' });
  }
  if (role === 'vendor' && !businessName) {
    return res.render('register', { error: 'Business name is required for vendors.' });
  }

  const result = tx((db) => {
    const exists = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { error: 'An account with that email already exists.' };

    const user = {
      id: db.counters.users + 1,
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 8),
      role,
      status: role === 'vendor' ? 'pending' : 'active',
      createdAt: new Date().toISOString()
    };
    db.counters.users += 1;
    db.users.push(user);

    if (role === 'vendor') {
      db.counters.vendors += 1;
      db.vendors.push({
        id: db.counters.vendors,
        userId: user.id,
        businessName,
        description: description || ''
      });
    }

    return { user };
  });

  if (result.error) {
    return res.render('register', { error: result.error });
  }

  if (result.user.role === 'vendor') {
    return res.render('login', {
      error: null,
      notice: 'Vendor account created! It is pending admin approval before you can receive orders. You can log in once approved.'
    });
  }

  req.session.user = {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    role: result.user.role
  };
  res.redirect('/vendors');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null, notice: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = load();
  const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.render('login', { error: 'Invalid email or password.', notice: null });
  }

  if (user.role === 'vendor' && user.status === 'pending') {
    return res.render('login', {
      error: 'Your vendor account is still pending admin approval.',
      notice: null
    });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };

  if (user.role === 'student') return res.redirect('/vendors');
  if (user.role === 'vendor') return res.redirect('/vendor/dashboard');
  return res.redirect('/admin/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
