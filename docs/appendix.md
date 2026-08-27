APPENDICES
==========

## APPENDIX A: SYSTEM SCREENSHOTS

The screenshots below were captured directly from the running application (see Section 4.6 for full descriptive captions and discussion). They are reproduced here as a consolidated visual reference.

| Plate | Screenshot | Caption |
|---|---|---|
| A.1 | ![Landing page](screenshots/01-landing.png) | Landing page (visitor not signed in) |
| A.2 | ![Login page](screenshots/02-login.png) | Login page with demo-account credentials panel |
| A.3 | ![Registration page — Student](screenshots/03-register.png) | Registration page, default Student role |
| A.4 | ![Registration page — Vendor](screenshots/03b-register-vendor-fields.png) | Registration page, Vendor role selected, showing business-name/description fields |
| A.5 | ![Vendor listing](screenshots/04-vendors-list.png) | Vendor listing page (student view) |
| A.6 | ![Vendor menu and cart](screenshots/05-vendor-menu-cart.png) | Vendor menu page with items added to cart and running total |
| A.7 | ![Order tracking page](screenshots/06-orders-tracking.png) | Student order-tracking page with status badge and progress bar |
| A.8 | ![Vendor dashboard](screenshots/07-vendor-dashboard.png) | Vendor dashboard showing incoming orders |
| A.9 | ![Admin dashboard](screenshots/08-admin-dashboard.png) | Admin dashboard with platform counts and pending vendor approval |

## APPENDIX B: FULL SOURCE CODE LISTING

The complete source code of the CampusBites application is reproduced below, organised by architectural layer as described in Section 3.7: the server entry point, access-control middleware, route handlers, the JSON persistence layer, the EJS view templates, and the Tailwind styling/build configuration. Together with Appendix C (data) and Appendix D (setup), this listing is sufficient to reproduce the system exactly as evaluated in Chapter Four.

### B.1 Application entry point

**Listing B.1: `server.js`**

```javascript
const express = require('express');
const session = require('express-session');
const path = require('path');

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const vendorRoutes = require('./routes/vendor');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Deterministic image filename for a vendor/menu item name, e.g. "Swallow — Egusi Soup" -> "swallow-egusi-soup".
// Used by views to look up /images/vendors/<slug>.jpg and /images/menu/<slug>.jpg — see public/images/README.md.
app.locals.slugify = function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: 'campusbites-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);
app.use(attachUser);

app.get('/', (req, res) => {
  res.render('landing');
});

app.use(authRoutes);
app.use(studentRoutes);
app.use(vendorRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusBites running at http://localhost:${PORT}`);
});
```
*Wires up the Express app: view engine, static assets, session middleware, the four route modules, and the `slugify` helper (Section 5.4) used by views to resolve vendor/menu photos deterministically from item names.*

### B.2 Access-control middleware

**Listing B.2: `middleware/auth.js`**

```javascript
function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (!roles.includes(user.role)) return res.status(403).send('Forbidden');
    next();
  };
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

module.exports = { requireRole, attachUser };
```
*Enforces NFR3 (Security, Section 3.6.2) server-side: `requireRole` gates every protected route, and access is decided here — not merely hidden in the interface.*

### B.3 Route handlers

**Listing B.3: `routes/auth.js`**

```javascript
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
```
*Registration and authentication. Passwords are hashed with bcrypt before storage (`bcrypt.hashSync`); a vendor account is created with `status: 'pending'` and only admitted to the platform once an administrator approves it (Section 4.5).*

**Listing B.4: `routes/student.js`**

```javascript
const express = require('express');
const { load, tx } = require('../data/store');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/vendors', requireRole('student'), (req, res) => {
  const db = load();
  const activeVendorUserIds = new Set(
    db.users.filter((u) => u.role === 'vendor' && u.status === 'active').map((u) => u.id)
  );
  const vendors = db.vendors.filter((v) => activeVendorUserIds.has(v.userId));
  res.render('vendors', { vendors });
});

router.get('/vendors/:id', requireRole('student'), (req, res) => {
  const db = load();
  const vendor = db.vendors.find((v) => v.id === Number(req.params.id));
  if (!vendor) return res.status(404).send('Vendor not found');
  const items = db.menuItems.filter((m) => m.vendorId === vendor.id);
  res.render('vendor-menu', { vendor, items });
});

router.post('/orders', requireRole('student'), (req, res) => {
  const vendorId = Number(req.body.vendorId);
  let items;
  try {
    items = JSON.parse(req.body.items);
  } catch (e) {
    return res.status(400).send('Invalid cart data');
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).send('Cart is empty');
  }

  const order = tx((db) => {
    const vendor = db.vendors.find((v) => v.id === vendorId);
    if (!vendor) return null;

    db.counters.orders += 1;
    const newOrder = {
      id: db.counters.orders,
      studentId: req.session.user.id,
      vendorId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.orders.push(newOrder);

    items.forEach((it) => {
      const menuItem = db.menuItems.find((m) => m.id === Number(it.menuItemId));
      if (!menuItem) return;
      db.counters.orderItems += 1;
      db.orderItems.push({
        id: db.counters.orderItems,
        orderId: newOrder.id,
        menuItemId: menuItem.id,
        quantity: Number(it.quantity) || 1,
        priceAtOrder: menuItem.price
      });
    });

    return newOrder;
  });

  if (!order) return res.status(400).send('Vendor not found');
  res.redirect('/orders');
});

router.get('/orders', requireRole('student'), (req, res) => {
  res.render('orders', {});
});

router.get('/api/orders/mine', requireRole('student'), (req, res) => {
  const db = load();
  const myOrders = db.orders
    .filter((o) => o.studentId === req.session.user.id)
    .sort((a, b) => b.id - a.id)
    .map((o) => {
      const vendor = db.vendors.find((v) => v.id === o.vendorId);
      const items = db.orderItems
        .filter((oi) => oi.orderId === o.id)
        .map((oi) => {
          const mi = db.menuItems.find((m) => m.id === oi.menuItemId);
          return {
            name: mi ? mi.name : 'Item removed',
            quantity: oi.quantity,
            price: oi.priceAtOrder
          };
        });
      const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      return {
        id: o.id,
        status: o.status,
        createdAt: o.createdAt,
        vendorName: vendor ? vendor.businessName : 'Unknown vendor',
        items,
        total
      };
    });
  res.json({ orders: myOrders });
});

module.exports = router;
```
*Student-facing routes: vendor browsing, menu display, order placement, and the polled `/api/orders/mine` JSON endpoint that drives the live status view in `orders.ejs`. Implements NFR4 (Data integrity, Section 3.6.2): `priceAtOrder` snapshots the menu item's price at the moment of ordering, discussed in Section 4.5.*

**Listing B.5: `routes/vendor.js`**

```javascript
const express = require('express');
const { load, tx } = require('../data/store');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const NEXT_STATUS = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed'
};

function myVendor(db, userId) {
  return db.vendors.find((v) => v.userId === userId);
}

router.get('/vendor/dashboard', requireRole('vendor'), (req, res) => {
  const db = load();
  const vendor = myVendor(db, req.session.user.id);
  if (!vendor) return res.status(404).send('Vendor profile not found');
  res.render('vendor-dashboard', { vendor });
});

router.get('/api/vendor/orders', requireRole('vendor'), (req, res) => {
  const db = load();
  const vendor = myVendor(db, req.session.user.id);
  if (!vendor) return res.json({ orders: [] });

  const orders = db.orders
    .filter((o) => o.vendorId === vendor.id && o.status !== 'completed')
    .sort((a, b) => a.id - b.id)
    .map((o) => {
      const student = db.users.find((u) => u.id === o.studentId);
      const items = db.orderItems
        .filter((oi) => oi.orderId === o.id)
        .map((oi) => {
          const mi = db.menuItems.find((m) => m.id === oi.menuItemId);
          return { name: mi ? mi.name : 'Item removed', quantity: oi.quantity };
        });
      return {
        id: o.id,
        status: o.status,
        createdAt: o.createdAt,
        studentName: student ? student.name : 'Unknown student',
        items,
        nextStatus: NEXT_STATUS[o.status] || null
      };
    });

  res.json({ orders });
});

router.post('/vendor/orders/:id/advance', requireRole('vendor'), (req, res) => {
  tx((db) => {
    const vendor = myVendor(db, req.session.user.id);
    const order = db.orders.find((o) => o.id === Number(req.params.id));
    if (!vendor || !order || order.vendorId !== vendor.id) return;
    const next = NEXT_STATUS[order.status];
    if (next) order.status = next;
  });
  res.redirect('/vendor/dashboard');
});

module.exports = router;
```
*Vendor-facing routes. `NEXT_STATUS` implements the server-decided status lifecycle discussed in Section 4.5 — a vendor can only request "advance to the next status," never set an arbitrary value — and the ownership check (`order.vendorId !== vendor.id`) in `/vendor/orders/:id/advance` prevents one vendor from altering another's order.*

**Listing B.6: `routes/admin.js`**

```javascript
const express = require('express');
const { load, tx } = require('../data/store');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/dashboard', requireRole('admin'), (req, res) => {
  const db = load();

  const vendorUsers = db.users.filter((u) => u.role === 'vendor');
  const pendingVendors = vendorUsers
    .filter((u) => u.status === 'pending')
    .map((u) => ({ user: u, vendor: db.vendors.find((v) => v.userId === u.id) }));

  const activeVendors = vendorUsers
    .filter((u) => u.status === 'active')
    .map((u) => {
      const vendor = db.vendors.find((v) => v.userId === u.id);
      const orderCount = vendor ? db.orders.filter((o) => o.vendorId === vendor.id).length : 0;
      return { user: u, vendor, orderCount };
    });

  const stats = {
    totalStudents: db.users.filter((u) => u.role === 'student').length,
    totalVendors: activeVendors.length,
    pendingVendors: pendingVendors.length,
    totalOrders: db.orders.length
  };

  res.render('admin-dashboard', { pendingVendors, activeVendors, stats });
});

router.post('/admin/vendors/:userId/approve', requireRole('admin'), (req, res) => {
  tx((db) => {
    const user = db.users.find((u) => u.id === Number(req.params.userId));
    if (user && user.role === 'vendor') user.status = 'active';
  });
  res.redirect('/admin/dashboard');
});

router.post('/admin/vendors/:userId/reject', requireRole('admin'), (req, res) => {
  tx((db) => {
    const userId = Number(req.params.userId);
    const user = db.users.find((u) => u.id === userId);
    if (user && user.role === 'vendor') {
      user.status = 'rejected';
      const vendor = db.vendors.find((v) => v.userId === userId);
      if (vendor) {
        db.menuItems = db.menuItems.filter((m) => m.vendorId !== vendor.id);
        db.vendors = db.vendors.filter((v) => v.id !== vendor.id);
      }
    }
  });
  res.redirect('/admin/dashboard');
});

module.exports = router;
```
*Admin-facing routes: platform statistics and the vendor approve/reject workflow. Rejecting a vendor also cascades the removal of its menu items, keeping `db.json` consistent (Section 4.4).*

### B.4 Data persistence layer

**Listing B.7: `data/store.js`**

```javascript
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

function emptyDb() {
  return {
    users: [],
    vendors: [],
    menuItems: [],
    orders: [],
    orderItems: [],
    counters: { users: 0, vendors: 0, menuItems: 0, orders: 0, orderItems: 0 }
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const fresh = emptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(db, table) {
  db.counters[table] += 1;
  return db.counters[table];
}

// Simple synchronous "transaction": load, mutate via fn, save, return result
function tx(fn) {
  const db = load();
  const result = fn(db);
  save(db);
  return result;
}

module.exports = { load, save, nextId, tx };
```
*The single synchronous read-mutate-write helper (`tx`) through which every route handler that changes state accesses the JSON document store described in Section 3.8 and Section 4.4.*

**Listing B.8: `data/seed.js`**

```javascript
const bcrypt = require('bcryptjs');
const { load, save, nextId } = require('./store');
const vendorCatalog = require('./vendor-catalog');

const db = load();

// Reset to a clean slate for the demo
db.users = [];
db.vendors = [];
db.menuItems = [];
db.orders = [];
db.orderItems = [];
db.counters = { users: 0, vendors: 0, menuItems: 0, orders: 0, orderItems: 0 };

function addUser({ name, email, password, role, status }) {
  const user = {
    id: nextId(db, 'users'),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 8),
    role,
    status,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  return user;
}

function addVendor(userId, businessName, description, items) {
  const vendor = {
    id: nextId(db, 'vendors'),
    userId,
    businessName,
    description
  };
  db.vendors.push(vendor);
  items.forEach(([name, price]) => {
    db.menuItems.push({
      id: nextId(db, 'menuItems'),
      vendorId: vendor.id,
      name,
      price
    });
  });
  return vendor;
}

// Admin
addUser({
  name: 'Admin',
  email: 'admin@campusbites.uat',
  password: 'admin123',
  role: 'admin',
  status: 'active'
});

// All vendors (active + the one pending demo) come from the shared catalog
// so fresh installs and data/add-new-vendors.js never drift out of sync.
vendorCatalog.forEach((v) => {
  const owner = addUser({
    name: v.ownerName,
    email: v.ownerEmail,
    password: v.password,
    role: 'vendor',
    status: v.status
  });
  addVendor(owner.id, v.businessName, v.description, v.items);
});

// One demo student
addUser({
  name: 'Demo Student',
  email: 'student@campusbites.uat',
  password: 'student123',
  role: 'student',
  status: 'active'
});

save(db);

const activeCount = vendorCatalog.filter((v) => v.status === 'active').length;
console.log('Seed complete.');
console.log(`Admin login:    admin@campusbites.uat / admin123`);
console.log(`${activeCount} active vendors + 1 pending vendor seeded (password for all: vendor123)`);
console.log('Student login:  student@campusbites.uat / student123');
```
*Full-reset seed script invoked by `npm run seed` (Table D.1). Builds the admin account, every vendor in the shared catalog (Listing B.9), and one demo student from a clean `db.json`.*

**Listing B.9: `data/vendor-catalog.js`**

```javascript
// Shared vendor + menu definitions, used by both data/seed.js (fresh installs)
// and data/add-new-vendors.js (appending to an already-running db.json without
// wiping existing users/orders). Keep both files' vendor data in sync by only
// editing it here.
//
// Each item's image is resolved at render time from its *name* via slugify()
// (see server.js + public/images/README.md), so items with the same name
// across vendors (e.g. "Rice with Chicken") automatically share one photo.

module.exports = [
  {
    ownerName: 'Just Tools Owner',
    ownerEmail: 'justtools@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Just Tools',
    description: 'Campus eatery — rice, spaghetti & swallow',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 3000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 3500],
      ['Spaghetti with Beef', 3000],
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Okro Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Swallow — Banga', 4500]
    ]
  },
  {
    ownerName: "Lari's Kitchen Owner",
    ownerEmail: 'lariskitchen@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: "Lari's Kitchen",
    description: 'Student-run kitchen — home-style meals',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 2500],
      ['Bottle Water', 300],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 2500],
      ['Spaghetti with Beef', 2000],
      ['Swallow — Egusi Soup', 3500],
      ['Swallow — Okro Soup', 3500],
      ['Swallow — Vegetable', 3500],
      ['Swallow — Banga', 3500]
    ]
  },
  {
    ownerName: 'F & S Owner',
    ownerEmail: 'fands@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'F & S',
    description: 'Rice, spaghetti, swallow & snacks',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Big Chicken', 8000],
      ['Rice with Beef', 3500],
      ['Soft Drinks', 600],
      ['Bottle Water', 400],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 3500],
      ['Spaghetti with Beef', 3000],
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Snack — Meatpie', 1000],
      ['Snack — Chicken Bread', 1000],
      ['Snack — Milky Doughnuts', 1000],
      ['Snack — Sausage Roll', 1000]
    ]
  },
  {
    ownerName: 'Suya Spot Owner',
    ownerEmail: 'suyaspot@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Suya Spot',
    description: 'Grills & suya — beef, chicken & turkey skewers',
    items: [
      ['Beef Suya', 1500],
      ['Chicken Suya', 1500],
      ['Turkey Suya', 2000],
      ['Suya Wrap', 2000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Golden Crust Bakery Owner',
    ownerEmail: 'goldencrust@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Golden Crust Bakery',
    description: 'Fresh pastries baked daily on campus',
    items: [
      ['Snack — Meatpie', 1000],
      ['Snack — Chicken Bread', 1000],
      ['Snack — Sausage Roll', 1000],
      ['Snack — Milky Doughnuts', 1000],
      ['Cupcake', 800],
      ['Bread Loaf', 1200]
    ]
  },
  {
    ownerName: "Mama Ngozi's Kitchen Owner",
    ownerEmail: 'mamangozi@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: "Mama Ngozi's Kitchen",
    description: 'Home-style swallow & soups made fresh',
    items: [
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Okro Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Amala & Ewedu', 3500],
      ['Pounded Yam & Egusi', 4000],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Campus Brew & Smoothies Owner',
    ownerEmail: 'campusbrew@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Campus Brew & Smoothies',
    description: 'Drinks, smoothies & zobo to cool you down',
    items: [
      ['Zobo (bottle)', 500],
      ['Chapman', 700],
      ['Fresh Smoothie', 1200],
      ['Iced Coffee', 1000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Iya Basira Rice Spot Owner',
    ownerEmail: 'iyabasira@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Iya Basira Rice Spot',
    description: 'Rice specialist — jollof, fried & coconut rice',
    items: [
      ['Jollof Rice', 3000],
      ['Fried Rice', 3000],
      ['Coconut Rice', 3500],
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 3000],
      ['Soft Drinks', 600]
    ]
  },
  {
    ownerName: 'Bola (Snack Hustle)',
    ownerEmail: 'bolasnacks@campusbites.uat',
    password: 'vendor123',
    status: 'pending',
    businessName: "Bola's Snack Corner",
    description: 'Student hustle — awaiting admin approval',
    items: [
      ['Puff Puff (5pcs)', 500],
      ['Chin Chin (cup)', 500],
      ['Zobo (bottle)', 500]
    ]
  }
];
```
*The full vendor and menu catalogue, tabulated for readability in Table C.1. Both `data/seed.js` and `data/add-new-vendors.js` read from this single source of truth to avoid data drift.*

**Listing B.10: `data/add-new-vendors.js`**

```javascript
// Appends any vendor-catalog.js entries that don't exist yet to the live db.json,
// WITHOUT touching existing users, vendors, orders, etc. Safe to re-run — entries
// whose ownerEmail is already registered are skipped.
//
// Use this instead of `npm run seed` when the app already has real data (accounts,
// orders) you don't want wiped. `npm run seed` remains the full-reset path for
// brand-new installs.

const bcrypt = require('bcryptjs');
const { tx, load } = require('./store');
const vendorCatalog = require('./vendor-catalog');

const db = load();
const existingEmails = new Set(db.users.map((u) => u.email.toLowerCase()));
const toAdd = vendorCatalog.filter((v) => !existingEmails.has(v.ownerEmail.toLowerCase()));

if (toAdd.length === 0) {
  console.log('Nothing to add — every vendor in the catalog is already seeded.');
  process.exit(0);
}

tx((db) => {
  toAdd.forEach((v) => {
    db.counters.users += 1;
    const user = {
      id: db.counters.users,
      name: v.ownerName,
      email: v.ownerEmail,
      passwordHash: bcrypt.hashSync(v.password, 8),
      role: 'vendor',
      status: v.status,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    db.counters.vendors += 1;
    const vendor = {
      id: db.counters.vendors,
      userId: user.id,
      businessName: v.businessName,
      description: v.description
    };
    db.vendors.push(vendor);

    v.items.forEach(([name, price]) => {
      db.counters.menuItems += 1;
      db.menuItems.push({ id: db.counters.menuItems, vendorId: vendor.id, name, price });
    });

    console.log(`Added vendor: ${v.businessName} (${v.status}) — login ${v.ownerEmail} / ${v.password}`);
  });
});

console.log(`Done. Added ${toAdd.length} vendor(s).`);
```
*Non-destructive catalogue sync (`npm run add-vendors`, Table D.1), invoked when the platform already holds real accounts and orders that must not be wiped.*

**Listing B.11: `data/list-images-needed.js`**

```javascript
// Prints the exact image filenames the app is looking for, based on whatever
// vendors/menu items currently exist in db.json. Re-run this any time you add
// a vendor or dish to see what new photos are needed.
//
//   node data/list-images-needed.js

const { load } = require('./store');
const db = load();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

console.log(`\nVendor photos -> public/images/vendors/<name>.jpg (or .jpeg/.png/.webp)\n`);
db.vendors.forEach((v) => console.log(`  ${slugify(v.businessName).padEnd(28)} (${v.businessName})`));

const uniqueItems = [...new Set(db.menuItems.map((m) => m.name))].sort();
console.log(`\nMenu item photos -> public/images/menu/<name>.jpg (or .jpeg/.png/.webp)\n`);
uniqueItems.forEach((name) => console.log(`  ${slugify(name).padEnd(28)} (${name})`));

console.log(`\n${db.vendors.length} vendor photos + ${uniqueItems.length} menu photos = ${db.vendors.length + uniqueItems.length} total.`);
console.log('Any missing file just falls back to the emoji placeholder — nothing breaks.\n');
```
*Development utility that reports every deterministic image filename the running catalogue expects, so missing photos (Section 5.4) can be sourced without guesswork.*

### B.5 View templates (EJS)

**Listing B.12: `views/partials/header.ejs`**

```html
<%- include('partials/header') %>

<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CampusBites — UAT</title>
  <meta name="theme-color" content="#0F172A" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet" />

  <!-- Compiled locally from src/input.css via `npm run build:css` (see tailwind.config.js) -->
  <!-- so the design system renders even when this machine can't reach an external CDN. -->
  <link rel="stylesheet" href="/css/app.css" />

  <script src="https://unpkg.com/lucide@latest"></script>

  <script>
    // Tries jpg -> jpeg -> png -> webp for a given /images/<basePath> before giving up
    // and removing the <img>, revealing the emoji/icon placeholder behind it.
    // Defined here (in <head>) so it exists before any <img onerror> in the page can fire.
    function imgFallback(img, basePath) {
      const exts = ['jpg', 'jpeg', 'png', 'webp'];
      const next = (Number(img.dataset.extIndex) || 0) + 1;
      if (next < exts.length) {
        img.dataset.extIndex = String(next);
        img.src = '/images/' + basePath + '.' + exts[next];
      } else {
        img.remove();
      }
    }
  </script>

  <style>
    body { font-feature-settings: "cv11"; }
  </style>
</head>
<body class="bg-bg text-ink font-sans min-h-screen flex flex-col antialiased">

  <header class="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-line">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2.5 shrink-0 group">
        <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform duration-200">
          <i data-lucide="utensils-crossed" class="w-4.5 h-4.5 text-white" style="width:18px;height:18px"></i>
        </span>
        <span class="font-display font-bold text-lg tracking-tight text-ink">CampusBites</span>
      </a>

      <nav class="hidden md:flex items-center gap-1">
        <% if (typeof currentUser !== 'undefined' && currentUser) { %>
          <% if (currentUser.role === 'student') { %>
            <a href="/vendors" class="nav-link"><i data-lucide="store" style="width:16px;height:16px"></i> Vendors</a>
            <a href="/orders" class="nav-link"><i data-lucide="receipt" style="width:16px;height:16px"></i> My Orders</a>
          <% } else if (currentUser.role === 'vendor') { %>
            <a href="/vendor/dashboard" class="nav-link"><i data-lucide="layout-dashboard" style="width:16px;height:16px"></i> Dashboard</a>
          <% } else if (currentUser.role === 'admin') { %>
            <a href="/admin/dashboard" class="nav-link"><i data-lucide="shield" style="width:16px;height:16px"></i> Admin</a>
          <% } %>
        <% } %>
      </nav>

      <div class="hidden md:flex items-center gap-3">
        <% if (typeof currentUser !== 'undefined' && currentUser) { %>
          <div class="flex items-center gap-2 pl-1 pr-1">
            <span class="w-8 h-8 rounded-full bg-surface border border-line flex items-center justify-center text-xs font-semibold text-ink"><%= currentUser.name.charAt(0).toUpperCase() %></span>
            <span class="text-sm text-ink2">Hi, <span class="text-ink font-medium"><%= currentUser.name %></span></span>
          </div>
          <form action="/logout" method="POST">
            <button class="btn-ghost !px-3 !py-2 border border-line" aria-label="Logout">
              <i data-lucide="log-out" style="width:16px;height:16px"></i>
              <span class="text-sm">Logout</span>
            </button>
          </form>
        <% } else { %>
          <a href="/login" class="nav-link">Login</a>
          <a href="/register" class="btn-primary !px-4 !py-2 text-sm">Register</a>
        <% } %>
      </div>

      <button id="mobileMenuBtn" class="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-ink2 hover:text-ink hover:bg-surface transition-colors" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobileMenu">
        <i data-lucide="menu" id="mobileMenuIcon"></i>
      </button>
    </div>

    <div id="mobileMenu" class="hidden md:hidden border-t border-line bg-bg/95 backdrop-blur-md px-4 sm:px-6 py-3 space-y-1">
      <% if (typeof currentUser !== 'undefined' && currentUser) { %>
        <% if (currentUser.role === 'student') { %>
          <a href="/vendors" class="nav-link !flex">Vendors</a>
          <a href="/orders" class="nav-link !flex">My Orders</a>
        <% } else if (currentUser.role === 'vendor') { %>
          <a href="/vendor/dashboard" class="nav-link !flex">Dashboard</a>
        <% } else if (currentUser.role === 'admin') { %>
          <a href="/admin/dashboard" class="nav-link !flex">Admin</a>
        <% } %>
        <div class="flex items-center justify-between pt-2 mt-2 border-t border-line">
          <span class="text-sm text-ink2">Hi, <span class="text-ink font-medium"><%= currentUser.name %></span></span>
          <form action="/logout" method="POST">
            <button class="btn-ghost !px-3 !py-1.5 border border-line text-sm">Logout</button>
          </form>
        </div>
      <% } else { %>
        <a href="/login" class="nav-link !flex">Login</a>
        <a href="/register" class="nav-link !flex text-primary">Register</a>
      <% } %>
    </div>
  </header>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
```
*Shared page shell included at the top of every view: document head, font/icon loading, the `imgFallback` client-side helper that walks jpg → jpeg → png → webp before falling back to an emoji placeholder, and the responsive header/nav with role-aware links.*

**Listing B.13: `views/partials/footer.ejs`**

```html
  </main>

  <footer class="border-t border-line bg-bg2/60 mt-auto">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <i data-lucide="utensils-crossed" style="width:15px;height:15px" class="text-white"></i>
          </span>
          <div>
            <p class="font-display font-semibold text-ink text-sm">CampusBites</p>
            <p class="text-xs text-ink3">University of Africa, Toru-Orua</p>
          </div>
        </div>

        <nav class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink2">
          <a href="/" class="hover:text-primary transition-colors">Home</a>
          <a href="/login" class="hover:text-primary transition-colors">Login</a>
          <a href="/register" class="hover:text-primary transition-colors">Register</a>
        </nav>

        <div class="flex items-center gap-2">
          <span class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink3 hover:text-primary hover:border-primary transition-colors">
            <i data-lucide="instagram" style="width:16px;height:16px"></i>
          </span>
          <span class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink3 hover:text-primary hover:border-primary transition-colors">
            <i data-lucide="twitter" style="width:16px;height:16px"></i>
          </span>
          <span class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink3 hover:text-primary hover:border-primary transition-colors">
            <i data-lucide="mail" style="width:16px;height:16px"></i>
          </span>
        </div>
      </div>

      <div class="border-t border-line mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p class="text-xs text-ink3">&copy; <span id="year"></span> CampusBites. Built for campus vendors and hungry students.</p>
        <p class="text-xs text-ink3">Pay on pickup — no delivery fees.</p>
      </div>
    </div>
  </footer>

  <script>
    document.getElementById('year').textContent = new Date().getFullYear();

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuIcon = document.getElementById('mobileMenuIcon');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = !mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden');
        mobileMenuBtn.setAttribute('aria-expanded', String(!isOpen));
        mobileMenuIcon.setAttribute('data-lucide', isOpen ? 'menu' : 'x');
        if (window.lucide) lucide.createIcons();
      });
    }

    if (window.lucide) lucide.createIcons();
  </script>
</body>
</html>
```
*Closes the page shell begun in the header partial: footer content, the copyright-year script, and the mobile-menu toggle handler.*

**Listing B.14: `views/landing.ejs`**

```html
<%- include('partials/header') %>

<!-- Hero -->
<section class="relative overflow-hidden">
  <div class="pointer-events-none absolute -top-24 -left-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl"></div>
  <div class="pointer-events-none absolute top-10 -right-16 w-72 h-72 bg-accent/10 rounded-full blur-3xl"></div>

  <div class="relative grid lg:grid-cols-2 gap-12 items-center py-8 lg:py-16">
    <div class="animate-fade-up">
      <span class="badge bg-primary/10 text-primary border border-primary/30 mb-5">
        <i data-lucide="sparkles" style="width:13px;height:13px"></i>
        Now live at University of Africa, Toru-Orua
      </span>
      <h1 class="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.08] tracking-tight text-ink mb-5">
        Order campus food<br class="hidden sm:block" />
        without the <span class="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">queue.</span>
      </h1>
      <p class="text-lg text-ink2 max-w-lg mb-8 leading-relaxed">
        CampusBites connects UAT students with campus eateries and student-run food hustles.
        Browse a menu, place your order, and track it live until it's ready for pickup.
      </p>
      <div class="flex flex-wrap gap-4 mb-10">
        <% if (typeof currentUser !== 'undefined' && currentUser) { %>
          <% const dest = currentUser.role === 'student' ? '/vendors' : currentUser.role === 'vendor' ? '/vendor/dashboard' : '/admin/dashboard'; %>
          <a href="<%= dest %>" class="btn-primary text-base">
            Go to <%= currentUser.role === 'student' ? 'Vendors' : 'Dashboard' %>
            <i data-lucide="arrow-right" style="width:17px;height:17px"></i>
          </a>
        <% } else { %>
          <a href="/register" class="btn-primary text-base">
            Get Started
            <i data-lucide="arrow-right" style="width:17px;height:17px"></i>
          </a>
          <a href="/login" class="btn-secondary text-base">Login</a>
        <% } %>
      </div>
      <div class="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink3">
        <span class="inline-flex items-center gap-2"><i data-lucide="clock" style="width:16px;height:16px" class="text-success"></i> Live order tracking</span>
        <span class="inline-flex items-center gap-2"><i data-lucide="badge-check" style="width:16px;height:16px" class="text-success"></i> Verified campus vendors</span>
        <span class="inline-flex items-center gap-2"><i data-lucide="wallet" style="width:16px;height:16px" class="text-success"></i> Pay on pickup</span>
      </div>
    </div>

    <div class="relative animate-fade-up" style="animation-delay:.1s">
      <div class="relative mx-auto max-w-sm">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 blur-2xl rounded-[2rem]"></div>
        <div class="relative card shadow-soft p-6 animate-float">
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-xs text-ink3">Order #128</p>
              <p class="font-display font-semibold text-ink">Lari's Kitchen</p>
            </div>
            <span class="badge bg-success/15 text-success"><i data-lucide="check-circle-2" style="width:13px;height:13px"></i> Ready</span>
          </div>
          <ul class="space-y-2.5 mb-5 text-sm">
            <li class="flex justify-between text-ink2"><span>Jollof Rice &amp; Chicken x1</span><span class="text-ink">₦1,500</span></li>
            <li class="flex justify-between text-ink2"><span>Zobo Drink x2</span><span class="text-ink">₦600</span></li>
          </ul>
          <div class="w-full bg-surface rounded-full h-2 mb-4 overflow-hidden">
            <div class="bg-gradient-to-r from-primary to-accent h-2 rounded-full" style="width:100%"></div>
          </div>
          <div class="flex justify-between items-center border-t border-line pt-4">
            <span class="text-sm text-ink3">Total</span>
            <span class="font-display font-bold text-lg text-ink">₦2,100</span>
          </div>
        </div>
        <div class="absolute -bottom-5 -left-6 card shadow-soft px-4 py-3 flex items-center gap-2.5 animate-float" style="animation-delay:.4s">
          <span class="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-lg">🍲</span>
          <div class="text-left">
            <p class="text-xs text-ink3 leading-tight">Just Tools</p>
            <p class="text-sm font-semibold text-ink leading-tight">Open now</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Categories -->
<section class="py-10 border-t border-line">
  <div class="flex items-center justify-between mb-6">
    <h2 class="font-display text-xl font-semibold text-ink">Browse by category</h2>
  </div>
  <div class="flex gap-3 overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
    <% const categories = [
      { label: 'Rice dishes', icon: '🍚' },
      { label: 'Swallow', icon: '🍲' },
      { label: 'Snacks', icon: '🥟' },
      { label: 'Drinks', icon: '🥤' },
      { label: 'Grills', icon: '🍢' },
      { label: 'Pastries', icon: '🥐' },
      { label: 'Small chops', icon: '🍗' }
    ]; %>
    <% categories.forEach(c => { %>
      <a href="/vendors" class="shrink-0 flex items-center gap-2.5 bg-surface hover:bg-card border border-line hover:border-primary/50 rounded-xl px-4 py-3 transition-all duration-200 hover:-translate-y-0.5">
        <span class="text-xl"><%= c.icon %></span>
        <span class="text-sm font-medium text-ink2 whitespace-nowrap"><%= c.label %></span>
      </a>
    <% }) %>
  </div>
</section>

<!-- Roles / how it works -->
<section class="py-10 border-t border-line">
  <div class="text-center max-w-2xl mx-auto mb-10">
    <h2 class="font-display text-2xl sm:text-3xl font-bold text-ink mb-3">Built for everyone on campus</h2>
    <p class="text-ink2">One platform for students ordering food, vendors fulfilling it, and admins keeping things running smoothly.</p>
  </div>
  <div class="grid md:grid-cols-3 gap-6">
    <div class="card p-7 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-soft">
      <div class="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
        <i data-lucide="graduation-cap" class="text-primary" style="width:22px;height:22px"></i>
      </div>
      <h3 class="font-display font-semibold text-lg text-ink mb-2">Students</h3>
      <p class="text-sm text-ink2 leading-relaxed">Browse vendor menus, place an order, and track it from "received" to "ready" without leaving your seat.</p>
    </div>
    <div class="card p-7 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-soft">
      <div class="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4">
        <i data-lucide="chef-hat" class="text-accent" style="width:22px;height:22px"></i>
      </div>
      <h3 class="font-display font-semibold text-lg text-ink mb-2">Vendors</h3>
      <p class="text-sm text-ink2 leading-relaxed">From established campus eateries to student-run food hustles — get notified instantly and manage orders as you cook.</p>
    </div>
    <div class="card p-7 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-soft">
      <div class="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center mb-4">
        <i data-lucide="shield-check" class="text-success" style="width:22px;height:22px"></i>
      </div>
      <h3 class="font-display font-semibold text-lg text-ink mb-2">Admin</h3>
      <p class="text-sm text-ink2 leading-relaxed">Approve new vendors, keep the platform clean, and see basic stats on activity.</p>
    </div>
  </div>
</section>

<!-- Testimonials -->
<section class="py-10 border-t border-line">
  <h2 class="font-display text-2xl sm:text-3xl font-bold text-ink mb-8 text-center">What students are saying</h2>
  <div class="grid md:grid-cols-3 gap-6">
    <% const testimonials = [
      { quote: "No more standing in the sun waiting for jollof. I order between classes and it's ready by the time I get there.", name: "Amaka", role: "200L Chemistry" },
      { quote: "As a small food hustle, this got me orders I'd never have gotten just shouting across the hostel.", name: "Tunde", role: "Campus vendor" },
      { quote: "Tracking my order status live means I actually know when to leave my room. Simple and it works.", name: "Zainab", role: "300L Economics" }
    ]; %>
    <% testimonials.forEach(t => { %>
      <div class="card p-6 shadow-soft">
        <div class="flex gap-1 text-accent mb-3">
          <% for (let i=0;i<5;i++) { %><i data-lucide="star" style="width:14px;height:14px" fill="currentColor"></i><% } %>
        </div>
        <p class="text-sm text-ink2 leading-relaxed mb-4">"<%= t.quote %>"</p>
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-white"><%= t.name.charAt(0) %></span>
          <div>
            <p class="text-sm font-medium text-ink"><%= t.name %></p>
            <p class="text-xs text-ink3"><%= t.role %></p>
          </div>
        </div>
      </div>
    <% }) %>
  </div>
</section>

<!-- CTA -->
<section class="py-14 border-t border-line">
  <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent px-8 py-12 text-center shadow-soft">
    <div class="absolute -bottom-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-2xl"></div>
    <h2 class="font-display text-2xl sm:text-3xl font-bold text-white mb-3 relative">Ready to skip the queue?</h2>
    <p class="text-white/90 max-w-md mx-auto mb-7 relative">Join CampusBites today and get your next meal without the wait.</p>
    <% if (typeof currentUser !== 'undefined' && currentUser) { %>
      <a href="/vendors" class="relative inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">Browse vendors <i data-lucide="arrow-right" style="width:17px;height:17px"></i></a>
    <% } else { %>
      <a href="/register" class="relative inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">Create free account <i data-lucide="arrow-right" style="width:17px;height:17px"></i></a>
    <% } %>
  </div>
</section>

<%- include('partials/footer') %>
```
*The public landing page (Plate A.1): hero, category shortcuts, role explainer, testimonials, and a closing call-to-action, adapting its links based on whether `currentUser` is signed in.*

**Listing B.15: `views/login.ejs`**

```html
<%- include('partials/header') %>

<div class="grid lg:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">

  <div class="hidden lg:block animate-fade-up">
    <div class="relative">
      <div class="absolute -top-10 -left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <span class="badge bg-primary/10 text-primary border border-primary/30 mb-5">
          <i data-lucide="utensils-crossed" style="width:13px;height:13px"></i> CampusBites
        </span>
        <h1 class="font-display text-4xl font-bold text-ink leading-tight mb-4">Welcome back.<br />Your next meal is a click away.</h1>
        <p class="text-ink2 mb-8 max-w-sm leading-relaxed">Log in to browse campus vendors, reorder your favorites, and track your food in real time.</p>
        <ul class="space-y-4">
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-success"><i data-lucide="radio" style="width:16px;height:16px"></i></span>
            Live order status updates
          </li>
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-accent"><i data-lucide="store" style="width:16px;height:16px"></i></span>
            Every campus vendor in one place
          </li>
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-primary"><i data-lucide="wallet" style="width:16px;height:16px"></i></span>
            Pay on pickup — no card needed
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div class="card shadow-soft p-7 sm:p-9 animate-fade-up w-full max-w-md mx-auto lg:mx-0">
    <h1 class="font-display text-2xl font-bold text-ink mb-1">Login</h1>
    <p class="text-sm text-ink3 mb-6">Enter your details to access your account.</p>

    <% if (typeof notice !== 'undefined' && notice) { %>
      <div class="flex items-start gap-2.5 bg-success/10 border border-success/30 text-success text-sm rounded-xl p-3.5 mb-5">
        <i data-lucide="check-circle-2" style="width:17px;height:17px" class="mt-0.5 shrink-0"></i>
        <span><%= notice %></span>
      </div>
    <% } %>
    <% if (error) { %>
      <div class="flex items-start gap-2.5 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl p-3.5 mb-5">
        <i data-lucide="alert-circle" style="width:17px;height:17px" class="mt-0.5 shrink-0"></i>
        <span><%= error %></span>
      </div>
    <% } %>

    <form action="/login" method="POST" class="space-y-4" id="loginForm">
      <div>
        <label class="field-label" for="email">Email</label>
        <div class="relative">
          <i data-lucide="mail" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
          <input id="email" type="email" name="email" required autocomplete="email" placeholder="you@campusbites.uat" class="input-field" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="field-label !mb-0" for="password">Password</label>
          <a href="#" class="text-xs text-primary hover:text-primary-hover font-medium">Forgot password?</a>
        </div>
        <div class="relative">
          <i data-lucide="lock" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
          <input id="password" type="password" name="password" required autocomplete="current-password" placeholder="••••••••" class="input-field !pr-11" />
          <button type="button" onclick="togglePassword('password', this)" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink2" aria-label="Show password">
            <i data-lucide="eye" style="width:16px;height:16px"></i>
          </button>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm text-ink2 cursor-pointer select-none">
        <input type="checkbox" name="remember" class="w-4 h-4 rounded border-line bg-surface text-primary focus:ring-primary/40 focus:ring-2" />
        Remember me
      </label>

      <button type="submit" id="loginBtn" class="btn-primary w-full">
        <span id="loginBtnText">Login</span>
      </button>
    </form>

    <p class="text-sm text-ink3 mt-5 text-center">No account yet? <a href="/register" class="text-primary hover:text-primary-hover font-medium">Register</a></p>

    <div class="mt-6 border-t border-line pt-4">
      <p class="text-xs font-semibold text-ink2 mb-1.5 flex items-center gap-1.5"><i data-lucide="info" style="width:13px;height:13px"></i> Demo logins</p>
      <div class="text-xs text-ink3 space-y-0.5 font-mono">
        <p>Student: student@campusbites.uat / student123</p>
        <p>Vendor: justtools@campusbites.uat / vendor123</p>
        <p>Admin: admin@campusbites.uat / admin123</p>
      </div>
    </div>
  </div>
</div>

<script>
  function togglePassword(id, btn) {
    const input = document.getElementById(id);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}" style="width:16px;height:16px"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  document.getElementById('loginForm').addEventListener('submit', function () {
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    document.getElementById('loginBtnText').innerHTML = '<span class="spinner"></span> Logging in…';
  });
</script>

<%- include('partials/footer') %>
```
*Login page (Plate A.2), including the visible demo-account credentials panel used throughout testing in Chapter Four.*

**Listing B.16: `views/register.ejs`**

```html
<%- include('partials/header') %>

<div class="grid lg:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">

  <div class="hidden lg:block animate-fade-up">
    <div class="relative">
      <div class="absolute -top-10 -left-10 w-64 h-64 bg-accent/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <span class="badge bg-accent/10 text-accent border border-accent/30 mb-5">
          <i data-lucide="sparkles" style="width:13px;height:13px"></i> Join CampusBites
        </span>
        <h1 class="font-display text-4xl font-bold text-ink leading-tight mb-4">Create your account in seconds.</h1>
        <p class="text-ink2 mb-8 max-w-sm leading-relaxed">Whether you're hungry between classes or running a food hustle, CampusBites gets you set up fast.</p>
        <ul class="space-y-4">
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-primary"><i data-lucide="graduation-cap" style="width:16px;height:16px"></i></span>
            Students order from any campus vendor
          </li>
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-accent"><i data-lucide="chef-hat" style="width:16px;height:16px"></i></span>
            Vendors manage orders from a live dashboard
          </li>
          <li class="flex items-center gap-3 text-sm text-ink2">
            <span class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-success"><i data-lucide="shield-check" style="width:16px;height:16px"></i></span>
            Vendor accounts are reviewed before going live
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div class="card shadow-soft p-7 sm:p-9 animate-fade-up w-full max-w-md mx-auto lg:mx-0">
    <h1 class="font-display text-2xl font-bold text-ink mb-1">Create an account</h1>
    <p class="text-sm text-ink3 mb-6">It only takes a minute.</p>

    <% if (error) { %>
      <div class="flex items-start gap-2.5 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl p-3.5 mb-5">
        <i data-lucide="alert-circle" style="width:17px;height:17px" class="mt-0.5 shrink-0"></i>
        <span><%= error %></span>
      </div>
    <% } %>

    <form action="/register" method="POST" class="space-y-4" id="registerForm">
      <div>
        <label class="field-label">I am a...</label>
        <div class="grid grid-cols-2 gap-2 p-1 bg-surface rounded-xl border border-line">
          <label class="cursor-pointer">
            <input type="radio" name="role" value="student" checked class="peer sr-only" onchange="toggleVendorFields()" />
            <div class="text-center text-sm font-medium py-2 rounded-lg text-ink2 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5">
              <i data-lucide="graduation-cap" style="width:15px;height:15px"></i> Student
            </div>
          </label>
          <label class="cursor-pointer">
            <input type="radio" name="role" value="vendor" class="peer sr-only" onchange="toggleVendorFields()" />
            <div class="text-center text-sm font-medium py-2 rounded-lg text-ink2 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5">
              <i data-lucide="chef-hat" style="width:15px;height:15px"></i> Vendor
            </div>
          </label>
        </div>
      </div>

      <div>
        <label class="field-label" for="name">Full name</label>
        <div class="relative">
          <i data-lucide="user" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
          <input id="name" name="name" required autocomplete="name" placeholder="Jane Doe" class="input-field" />
        </div>
      </div>

      <div>
        <label class="field-label" for="regEmail">Email</label>
        <div class="relative">
          <i data-lucide="mail" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
          <input id="regEmail" type="email" name="email" required autocomplete="email" placeholder="you@campusbites.uat" class="input-field !pr-11" oninput="validateEmail(this)" />
          <i id="emailCheck" data-lucide="check-circle-2" class="hidden absolute right-3.5 top-1/2 -translate-y-1/2 text-success" style="width:16px;height:16px"></i>
        </div>
      </div>

      <div>
        <label class="field-label" for="regPassword">Password</label>
        <div class="relative">
          <i data-lucide="lock" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
          <input id="regPassword" type="password" name="password" required autocomplete="new-password" placeholder="At least 6 characters" class="input-field !pr-11" oninput="updateStrength(this.value)" />
          <button type="button" onclick="togglePassword('regPassword', this)" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink2" aria-label="Show password">
            <i data-lucide="eye" style="width:16px;height:16px"></i>
          </button>
        </div>
        <div class="flex gap-1.5 mt-2" id="strengthBar">
          <span class="h-1 flex-1 rounded-full bg-line transition-colors duration-200"></span>
          <span class="h-1 flex-1 rounded-full bg-line transition-colors duration-200"></span>
          <span class="h-1 flex-1 rounded-full bg-line transition-colors duration-200"></span>
          <span class="h-1 flex-1 rounded-full bg-line transition-colors duration-200"></span>
        </div>
        <p class="text-xs text-ink3 mt-1" id="strengthLabel">Password strength</p>
      </div>

      <div id="vendorFields" class="hidden space-y-4 border-t border-line pt-4">
        <div>
          <label class="field-label" for="businessName">Business / hustle name</label>
          <div class="relative">
            <i data-lucide="store" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
            <input id="businessName" name="businessName" class="input-field" placeholder="e.g. Bola's Snack Corner" />
          </div>
        </div>
        <div>
          <label class="field-label" for="description">Short description</label>
          <div class="relative">
            <i data-lucide="notebook-pen" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" style="width:16px;height:16px"></i>
            <input id="description" name="description" class="input-field" placeholder="What do you sell?" />
          </div>
        </div>
        <p class="text-xs text-ink3 flex items-start gap-1.5"><i data-lucide="info" style="width:13px;height:13px" class="mt-0.5 shrink-0"></i> Vendor accounts require admin approval before you can receive orders.</p>
      </div>

      <button type="submit" id="registerBtn" class="btn-primary w-full">
        <span id="registerBtnText">Create account</span>
      </button>
    </form>

    <p class="text-sm text-ink3 mt-5 text-center">Already have an account? <a href="/login" class="text-primary hover:text-primary-hover font-medium">Login</a></p>
  </div>
</div>

<script>
  function toggleVendorFields() {
    const isVendor = document.querySelector('input[name="role"]:checked').value === 'vendor';
    document.getElementById('vendorFields').classList.toggle('hidden', !isVendor);
  }

  function togglePassword(id, btn) {
    const input = document.getElementById(id);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}" style="width:16px;height:16px"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  function validateEmail(input) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    document.getElementById('emailCheck').classList.toggle('hidden', !ok);
  }

  function updateStrength(value) {
    const bars = document.querySelectorAll('#strengthBar span');
    const label = document.getElementById('strengthLabel');
    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;

    const colors = ['bg-line', 'bg-danger', 'bg-accent', 'bg-accent', 'bg-success'];
    const labels = ['Password strength', 'Weak', 'Fair', 'Good', 'Strong'];
    bars.forEach((bar, i) => {
      bar.className = `h-1 flex-1 rounded-full transition-colors duration-200 ${i < score ? colors[score] : 'bg-line'}`;
    });
    label.textContent = value.length === 0 ? 'Password strength' : labels[score];
  }

  document.getElementById('registerForm').addEventListener('submit', function () {
    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    document.getElementById('registerBtnText').innerHTML = '<span class="spinner"></span> Creating account…';
  });
</script>

<%- include('partials/footer') %>
```
*Registration page (Plates A.3–A.4), with client-side email format and password-strength feedback, and a conditionally revealed vendor fieldset.*

**Listing B.17: `views/vendors.ejs`**

```html
<%- include('partials/header') %>

<div class="mb-8">
  <h1 class="font-display text-2xl font-bold text-ink">Campus vendors</h1>
  <p class="text-sm text-ink3 mt-1">Pick a vendor to see their menu and place an order.</p>
</div>

<% if (vendors.length === 0) { %>
  <div class="card p-12 text-center">
    <div class="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
      <i data-lucide="store" class="text-ink3" style="width:24px;height:24px"></i>
    </div>
    <p class="text-ink2 font-medium mb-1">No vendors available yet</p>
    <p class="text-sm text-ink3">Check back soon — new campus vendors are added regularly.</p>
  </div>
<% } %>

<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <% const palettes = [
    ['from-primary/25', 'to-accent/10'],
    ['from-success/20', 'to-primary/10'],
    ['from-accent/20', 'to-primary/10']
  ]; %>
  <% vendors.forEach((v, i) => { const p = palettes[i % palettes.length]; %>
    <a href="/vendors/<%= v.id %>" class="card group overflow-hidden shadow-soft hover:border-primary/40 hover:-translate-y-1 transition-all duration-300">
      <div class="h-28 bg-gradient-to-br <%= p[0] %> <%= p[1] %> flex items-center justify-center relative overflow-hidden">
        <span class="text-4xl group-hover:scale-110 transition-transform duration-300">🍽️</span>
        <img
          src="/images/vendors/<%= slugify(v.businessName) %>.jpg"
          data-ext-index="0"
          onerror="imgFallback(this, 'vendors/<%= slugify(v.businessName) %>')"
          alt="<%= v.businessName %>"
          class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <span class="badge bg-bg/70 text-ink2 backdrop-blur-sm absolute top-3 left-3 border border-line z-10">
          <i data-lucide="badge-check" style="width:12px;height:12px" class="text-success"></i> Campus vendor
        </span>
      </div>
      <div class="p-5">
        <h2 class="font-display font-semibold text-lg text-ink mb-1"><%= v.businessName %></h2>
        <p class="text-sm text-ink3 line-clamp-2 min-h-[2.5rem]"><%= v.description %></p>
        <span class="inline-flex items-center gap-1.5 mt-3 text-primary text-sm font-semibold group-hover:gap-2.5 transition-all duration-200">
          View menu <i data-lucide="arrow-right" style="width:15px;height:15px"></i>
        </span>
      </div>
    </a>
  <% }) %>
</div>

<%- include('partials/footer') %>
```
*Vendor listing page (Plate A.5), showing only vendors whose owner account is active (filtered server-side in `routes/student.js`).*

**Listing B.18: `views/vendor-menu.ejs`**

```html
<%- include('partials/header') %>

<a href="/vendors" class="inline-flex items-center gap-1.5 text-ink3 hover:text-primary text-sm font-medium transition-colors">
  <i data-lucide="arrow-left" style="width:15px;height:15px"></i> Back to vendors
</a>

<div class="flex items-start gap-4 mt-4 mb-8">
  <span class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/10 flex items-center justify-center text-2xl shrink-0 relative overflow-hidden">
    🍽️
    <img
      src="/images/vendors/<%= slugify(vendor.businessName) %>.jpg"
      data-ext-index="0"
      onerror="imgFallback(this, 'vendors/<%= slugify(vendor.businessName) %>')"
      alt="<%= vendor.businessName %>"
      class="absolute inset-0 w-full h-full object-cover"
    />
  </span>
  <div>
    <h1 class="font-display text-2xl font-bold text-ink"><%= vendor.businessName %></h1>
    <p class="text-ink3 text-sm mt-1"><%= vendor.description %></p>
  </div>
</div>

<div class="grid lg:grid-cols-3 gap-8">
  <div class="lg:col-span-2">
    <h2 class="font-display font-semibold text-ink mb-4 flex items-center gap-2">
      <i data-lucide="utensils" style="width:17px;height:17px" class="text-primary"></i> Menu
    </h2>
    <div class="grid sm:grid-cols-2 gap-4">
      <% items.forEach(item => { %>
        <div class="card overflow-hidden group flex flex-col justify-between hover:border-primary/30 transition-colors duration-200" id="item-<%= item.id %>">
          <div class="h-28 bg-surface relative overflow-hidden flex items-center justify-center shrink-0">
            <span class="text-3xl">🍛</span>
            <img
              src="/images/menu/<%= slugify(item.name) %>.jpg"
              data-ext-index="0"
              onerror="imgFallback(this, 'menu/<%= slugify(item.name) %>')"
              alt="<%= item.name %>"
              class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>
          <div class="p-4 flex flex-col flex-1 justify-between">
            <div class="mb-4">
              <h3 class="font-medium text-ink leading-snug"><%= item.name %></h3>
              <p class="text-primary font-display font-bold mt-1">₦<%= item.price.toLocaleString() %></p>
            </div>
            <div id="item-btn-<%= item.id %>">
              <button
                type="button"
                class="btn-secondary w-full !py-2 text-sm"
                onclick="addToCart(<%= item.id %>, '<%= item.name.replace(/'/g, "\\'") %>', <%= item.price %>)"
              >
                <i data-lucide="plus" style="width:15px;height:15px"></i> Add
              </button>
            </div>
          </div>
        </div>
      <% }) %>
      <% if (items.length === 0) { %>
        <p class="text-ink3 text-sm col-span-2">This vendor hasn't added any menu items yet.</p>
      <% } %>
    </div>
  </div>

  <div class="card shadow-soft p-5 h-fit lg:sticky lg:top-20">
    <h2 class="font-display font-bold text-ink mb-4 flex items-center gap-2">
      <i data-lucide="shopping-bag" style="width:17px;height:17px" class="text-primary"></i> Your order
    </h2>
    <ul id="cartList" class="text-sm space-y-3 mb-4 max-h-64 overflow-y-auto scrollbar-thin">
      <li class="flex flex-col items-center text-center py-6 text-ink3" id="emptyCartMsg">
        <i data-lucide="shopping-cart" style="width:28px;height:28px" class="mb-2 opacity-60"></i>
        No items yet.
      </li>
    </ul>

    <div class="flex items-start gap-2 bg-surface rounded-xl p-3 mb-4 text-xs text-ink3">
      <i data-lucide="clock" style="width:14px;height:14px" class="mt-0.5 shrink-0 text-accent"></i>
      Ready in ~15–20 min after the vendor accepts your order. Pickup only — pay when you collect it.
    </div>

    <div class="flex justify-between font-display font-bold text-ink border-t border-line pt-3 mb-4">
      <span>Total</span>
      <span id="cartTotal">₦0</span>
    </div>
    <form action="/orders" method="POST" onsubmit="return submitOrder(event)">
      <input type="hidden" name="vendorId" value="<%= vendor.id %>" />
      <input type="hidden" name="items" id="itemsInput" />
      <button type="submit" class="btn-primary w-full" id="placeOrderBtn" disabled>
        <span id="placeOrderBtnText">Place order (pay on pickup)</span>
      </button>
    </form>
  </div>
</div>

<script>
  const MENU_ITEMS = {
    <% items.forEach(item => { %>
      <%= item.id %>: { name: '<%= item.name.replace(/'/g, "\\'") %>', price: <%= item.price %> },
    <% }) %>
  };

  const cart = {}; // menuItemId -> { name, price, qty }

  function addToCart(id, name, price) {
    if (!cart[id]) cart[id] = { name: name || (MENU_ITEMS[id] && MENU_ITEMS[id].name), price: price != null ? price : (MENU_ITEMS[id] && MENU_ITEMS[id].price), qty: 0 };
    cart[id].qty += 1;
    renderCart();
    renderItemButton(id);
  }

  function removeFromCart(id) {
    if (!cart[id]) return;
    cart[id].qty -= 1;
    if (cart[id].qty <= 0) delete cart[id];
    renderCart();
    renderItemButton(id);
  }

  function renderItemButton(id) {
    const el = document.getElementById('item-btn-' + id);
    if (!el) return;
    const entry = cart[id];
    if (!entry || entry.qty <= 0) {
      const item = MENU_ITEMS[id];
      el.innerHTML = `
        <button type="button" class="btn-secondary w-full !py-2 text-sm" onclick="addToCart(${id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">
          <i data-lucide="plus" style="width:15px;height:15px"></i> Add
        </button>`;
    } else {
      el.innerHTML = `
        <div class="flex items-center justify-between bg-surface border border-primary/40 rounded-xl px-2 py-1.5">
          <button type="button" onclick="removeFromCart(${id})" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-ink2 transition-colors" aria-label="Decrease quantity">
            <i data-lucide="minus" style="width:14px;height:14px"></i>
          </button>
          <span class="text-sm font-semibold text-ink">${entry.qty}</span>
          <button type="button" onclick="addToCart(${id})" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-primary transition-colors" aria-label="Increase quantity">
            <i data-lucide="plus" style="width:14px;height:14px"></i>
          </button>
        </div>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    const ids = Object.keys(cart);
    list.innerHTML = '';
    if (ids.length === 0) {
      list.innerHTML = `
        <li class="flex flex-col items-center text-center py-6 text-ink3" id="emptyCartMsg">
          <i data-lucide="shopping-cart" style="width:28px;height:28px" class="mb-2 opacity-60"></i>
          No items yet.
        </li>`;
      if (window.lucide) lucide.createIcons();
    }
    let total = 0;
    ids.forEach((id) => {
      const it = cart[id];
      total += it.price * it.qty;
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center gap-2 animate-fade-up';
      li.innerHTML = `
        <span class="text-ink2 truncate">${it.name} <span class="text-ink3">x${it.qty}</span></span>
        <span class="flex items-center gap-2 shrink-0">
          <span class="text-ink font-medium">₦${(it.price * it.qty).toLocaleString()}</span>
          <button type="button" class="text-ink3 hover:text-danger transition-colors" onclick="removeFromCart(${id})" aria-label="Remove item">
            <i data-lucide="x" style="width:14px;height:14px"></i>
          </button>
        </span>`;
      list.appendChild(li);
    });
    document.getElementById('cartTotal').textContent = '₦' + total.toLocaleString();
    document.getElementById('placeOrderBtn').disabled = ids.length === 0;
    if (window.lucide) lucide.createIcons();
  }

  function submitOrder(e) {
    const ids = Object.keys(cart);
    if (ids.length === 0) {
      e.preventDefault();
      return false;
    }
    const items = ids.map((id) => ({ menuItemId: Number(id), quantity: cart[id].qty }));
    document.getElementById('itemsInput').value = JSON.stringify(items);
    document.getElementById('placeOrderBtn').disabled = true;
    document.getElementById('placeOrderBtnText').innerHTML = '<span class="spinner"></span> Placing order…';
    return true;
  }
</script>

<%- include('partials/footer') %>
```
*Vendor menu and client-side cart (Plate A.6). The cart is built entirely in memory in the browser (`cart` object) and only serialised to `items` on submit — the server independently re-validates every item and re-prices it from `db.menuItems` (Listing B.4), so the client cart is never trusted for pricing.*

**Listing B.19: `views/orders.ejs`**

```html
<%- include('partials/header') %>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="font-display text-2xl font-bold text-ink">My orders</h1>
    <p class="text-sm text-ink3 mt-1">Live status updates automatically — no need to refresh.</p>
  </div>
  <a href="/vendors" class="btn-secondary !px-4 !py-2 text-sm hidden sm:inline-flex">
    <i data-lucide="plus" style="width:15px;height:15px"></i> New order
  </a>
</div>

<div id="ordersList" class="space-y-4">
  <% for (let i=0;i<3;i++) { %>
    <div class="card p-5">
      <div class="flex justify-between mb-4">
        <div class="space-y-2">
          <div class="skeleton h-4 w-32 rounded"></div>
          <div class="skeleton h-3 w-44 rounded"></div>
        </div>
        <div class="skeleton h-6 w-24 rounded-full"></div>
      </div>
      <div class="skeleton h-3 w-full rounded mb-2"></div>
      <div class="skeleton h-3 w-2/3 rounded"></div>
    </div>
  <% } %>
</div>

<script>
  const STATUS_LABEL = {
    pending: 'Received — waiting for vendor',
    preparing: 'Preparing',
    ready: 'Ready for pickup',
    completed: 'Picked up'
  };
  const STATUS_ICON = {
    pending: 'clock',
    preparing: 'flame',
    ready: 'check-circle-2',
    completed: 'package-check'
  };
  const STATUS_STYLE = {
    pending: 'bg-accent/15 text-accent',
    preparing: 'bg-primary/15 text-primary',
    ready: 'bg-success/15 text-success',
    completed: 'bg-surface text-ink3'
  };
  const STATUS_ORDER = ['pending', 'preparing', 'ready', 'completed'];

  async function loadOrders() {
    const res = await fetch('/api/orders/mine');
    const data = await res.json();
    render(data.orders);
  }

  function render(orders) {
    const container = document.getElementById('ordersList');
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="card p-12 text-center">
          <div class="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
            <i data-lucide="receipt" class="text-ink3" style="width:24px;height:24px"></i>
          </div>
          <p class="text-ink2 font-medium mb-1">No orders yet</p>
          <p class="text-sm text-ink3 mb-5">You have not placed any orders yet.</p>
          <a href="/vendors" class="btn-primary !px-5 !py-2.5 text-sm inline-flex">Browse vendors</a>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="card p-5 hover:border-primary/30 transition-colors duration-200 animate-fade-up">
        <div class="flex justify-between items-start mb-3 gap-3">
          <div>
            <h3 class="font-display font-semibold text-ink">${o.vendorName}</h3>
            <p class="text-xs text-ink3 mt-0.5">Order #${o.id} — ${new Date(o.createdAt).toLocaleString()}</p>
          </div>
          <span class="badge ${STATUS_STYLE[o.status]} shrink-0">
            <i data-lucide="${STATUS_ICON[o.status]}" style="width:13px;height:13px"></i>
            ${STATUS_LABEL[o.status]}
          </span>
        </div>
        <ul class="text-sm text-ink2 mb-3 space-y-0.5">
          ${o.items.map(it => `<li>${it.name} <span class="text-ink3">x${it.quantity}</span></li>`).join('')}
        </ul>
        <div class="w-full bg-surface rounded-full h-1.5 mb-4 overflow-hidden">
          <div class="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full transition-all duration-500" style="width:${(STATUS_ORDER.indexOf(o.status)+1)/STATUS_ORDER.length*100}%"></div>
        </div>
        <div class="flex justify-between items-center border-t border-line pt-3">
          <span class="text-xs text-ink3">Order total</span>
          <span class="font-display font-bold text-ink">₦${o.total.toLocaleString()}</span>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }

  loadOrders();
  setInterval(loadOrders, 4000);
</script>

<%- include('partials/footer') %>
```
*Student order-tracking page (Plate A.7). `loadOrders()` polls `/api/orders/mine` every four seconds — the "live tracking" experience described in Section 3.6.1 (FR7) is client-side polling rather than a persistent WebSocket connection, a scope trade-off discussed in Section 5.3.*

**Listing B.20: `views/vendor-dashboard.ejs`**

```html
<%- include('partials/header') %>

<div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
  <div>
    <h1 class="font-display text-2xl font-bold text-ink"><%= vendor.businessName %></h1>
    <p class="text-sm text-ink3 mt-1 flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
      Incoming orders update automatically
    </p>
  </div>
</div>

<div id="ordersList" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <% for (let i=0;i<3;i++) { %>
    <div class="card p-4">
      <div class="flex justify-between mb-3">
        <div class="space-y-2">
          <div class="skeleton h-4 w-24 rounded"></div>
          <div class="skeleton h-3 w-32 rounded"></div>
        </div>
        <div class="skeleton h-6 w-20 rounded-full"></div>
      </div>
      <div class="skeleton h-3 w-full rounded mb-2"></div>
      <div class="skeleton h-8 w-full rounded-xl mt-3"></div>
    </div>
  <% } %>
</div>

<script>
  const STATUS_LABEL = {
    pending: 'New order',
    preparing: 'Preparing',
    ready: 'Ready for pickup'
  };
  const STATUS_ICON = {
    pending: 'bell',
    preparing: 'flame',
    ready: 'check-circle-2'
  };
  const STATUS_STYLE = {
    pending: 'bg-accent/15 text-accent',
    preparing: 'bg-primary/15 text-primary',
    ready: 'bg-success/15 text-success'
  };
  const ACTION_LABEL = {
    preparing: 'Accept order',
    ready: 'Mark ready',
    completed: 'Mark picked up'
  };
  const ACTION_ICON = {
    preparing: 'check',
    ready: 'bell-ring',
    completed: 'package-check'
  };

  async function loadOrders() {
    const res = await fetch('/api/vendor/orders');
    const data = await res.json();
    render(data.orders);
  }

  function render(orders) {
    const container = document.getElementById('ordersList');
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="card p-12 text-center sm:col-span-2 lg:col-span-3">
          <div class="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
            <i data-lucide="inbox" class="text-ink3" style="width:24px;height:24px"></i>
          </div>
          <p class="text-ink2 font-medium mb-1">No active orders right now</p>
          <p class="text-sm text-ink3">New orders will appear here automatically.</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="card p-4 hover:border-primary/30 transition-colors duration-200 animate-fade-up">
        <div class="flex justify-between items-start mb-3 gap-2">
          <div>
            <h3 class="font-semibold text-ink">Order #${o.id}</h3>
            <p class="text-xs text-ink3 mt-0.5">${o.studentName} — ${new Date(o.createdAt).toLocaleTimeString()}</p>
          </div>
          <span class="badge ${STATUS_STYLE[o.status]} shrink-0">
            <i data-lucide="${STATUS_ICON[o.status]}" style="width:12px;height:12px"></i>
            ${STATUS_LABEL[o.status]}
          </span>
        </div>
        <ul class="text-sm text-ink2 mb-4 space-y-0.5">
          ${o.items.map(it => `<li>${it.name} <span class="text-ink3">x${it.quantity}</span></li>`).join('')}
        </ul>
        ${o.nextStatus ? `
          <form method="POST" action="/vendor/orders/${o.id}/advance">
            <button class="btn-primary w-full !py-2 text-sm">
              <i data-lucide="${ACTION_ICON[o.nextStatus]}" style="width:15px;height:15px"></i>
              ${ACTION_LABEL[o.nextStatus]}
            </button>
          </form>` : ''}
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }

  loadOrders();
  setInterval(loadOrders, 4000);
</script>

<%- include('partials/footer') %>
```
*Vendor dashboard (Plate A.8), showing only orders not yet marked `completed` (Listing B.5) and offering a single "advance to next status" action per order.*

**Listing B.21: `views/admin-dashboard.ejs`**

```html
<%- include('partials/header') %>

<div class="mb-8">
  <h1 class="font-display text-2xl font-bold text-ink">Admin dashboard</h1>
  <p class="text-sm text-ink3 mt-1">Platform overview and vendor approvals.</p>
</div>

<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
  <div class="card p-5 flex items-center gap-4 shadow-soft">
    <span class="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0"><i data-lucide="graduation-cap" style="width:20px;height:20px"></i></span>
    <div>
      <p class="text-2xl font-display font-bold text-ink"><%= stats.totalStudents %></p>
      <p class="text-xs text-ink3">Students</p>
    </div>
  </div>
  <div class="card p-5 flex items-center gap-4 shadow-soft">
    <span class="w-11 h-11 rounded-xl bg-success/15 flex items-center justify-center text-success shrink-0"><i data-lucide="store" style="width:20px;height:20px"></i></span>
    <div>
      <p class="text-2xl font-display font-bold text-ink"><%= stats.totalVendors %></p>
      <p class="text-xs text-ink3">Active vendors</p>
    </div>
  </div>
  <div class="card p-5 flex items-center gap-4 shadow-soft">
    <span class="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center text-accent shrink-0"><i data-lucide="hourglass" style="width:20px;height:20px"></i></span>
    <div>
      <p class="text-2xl font-display font-bold text-ink"><%= stats.pendingVendors %></p>
      <p class="text-xs text-ink3">Pending approvals</p>
    </div>
  </div>
  <div class="card p-5 flex items-center gap-4 shadow-soft">
    <span class="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0"><i data-lucide="receipt" style="width:20px;height:20px"></i></span>
    <div>
      <p class="text-2xl font-display font-bold text-ink"><%= stats.totalOrders %></p>
      <p class="text-xs text-ink3">Total orders</p>
    </div>
  </div>
</div>

<h2 class="font-display text-lg font-semibold text-ink mb-4 flex items-center gap-2">
  <i data-lucide="user-check" style="width:18px;height:18px" class="text-primary"></i> Pending vendor approvals
</h2>
<% if (pendingVendors.length === 0) { %>
  <div class="card p-8 text-center mb-10">
    <p class="text-ink3 text-sm">No pending approvals.</p>
  </div>
<% } else { %>
  <div class="space-y-3 mb-10">
    <% pendingVendors.forEach(({ user, vendor }) => { %>
      <div class="card p-4 flex items-center justify-between gap-4 flex-wrap shadow-soft">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent shrink-0"><i data-lucide="chef-hat" style="width:18px;height:18px"></i></span>
          <div class="min-w-0">
            <p class="font-semibold text-ink truncate"><%= vendor ? vendor.businessName : user.name %></p>
            <p class="text-xs text-ink3 truncate"><%= user.name %> — <%= user.email %></p>
            <% if (vendor && vendor.description) { %><p class="text-sm text-ink2 mt-1"><%= vendor.description %></p><% } %>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <form method="POST" action="/admin/vendors/<%= user.id %>/approve">
            <button class="btn-primary !bg-success hover:!bg-success !px-4 !py-2 text-sm hover:!brightness-110">
              <i data-lucide="check" style="width:15px;height:15px"></i> Approve
            </button>
          </form>
          <form method="POST" action="/admin/vendors/<%= user.id %>/reject">
            <button class="btn-danger !px-4 !py-2 text-sm">
              <i data-lucide="x" style="width:15px;height:15px"></i> Reject
            </button>
          </form>
        </div>
      </div>
    <% }) %>
  </div>
<% } %>

<h2 class="font-display text-lg font-semibold text-ink mb-4 flex items-center gap-2">
  <i data-lucide="store" style="width:18px;height:18px" class="text-primary"></i> Active vendors
</h2>
<div class="card overflow-hidden shadow-soft">
  <div class="overflow-x-auto scrollbar-thin">
    <table class="w-full text-sm">
      <thead class="bg-surface text-ink2">
        <tr>
          <th class="text-left px-4 py-3 font-medium">Business</th>
          <th class="text-left px-4 py-3 font-medium">Owner</th>
          <th class="text-left px-4 py-3 font-medium">Orders</th>
        </tr>
      </thead>
      <tbody>
        <% if (activeVendors.length === 0) { %>
          <tr><td colspan="3" class="px-4 py-6 text-center text-ink3">No active vendors yet.</td></tr>
        <% } %>
        <% activeVendors.forEach(({ user, vendor, orderCount }) => { %>
          <tr class="border-t border-line hover:bg-surface/60 transition-colors">
            <td class="px-4 py-3 font-medium text-ink"><%= vendor ? vendor.businessName : '—' %></td>
            <td class="px-4 py-3 text-ink2"><%= user.name %> <span class="text-ink3">(<%= user.email %>)</span></td>
            <td class="px-4 py-3"><span class="badge bg-primary/15 text-primary"><%= orderCount %></span></td>
          </tr>
        <% }) %>
      </tbody>
    </table>
  </div>
</div>

<%- include('partials/footer') %>
```
*Admin dashboard (Plate A.9): platform statistics, the pending-vendor approve/reject queue, and a table of active vendors with running order counts.*

### B.6 Styling and build configuration

**Listing B.22: `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#FF6B35', hover: '#FF8C42' },
        accent: '#FFB703',
        success: '#22C55E',
        danger: '#EF4444',
        bg: '#F8FAFC',
        bg2: '#F1F5F9',
        card: '#FFFFFF',
        surface: '#F1F5F9',
        line: '#E2E8F0',
        ink: '#0F172A',
        ink2: '#334155',
        ink3: '#64748B'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(0,0,0,0.4)',
        glow: '0 0 0 3px rgba(255,107,53,0.25)'
      }
    }
  },
  plugins: []
};
```
*Design-token source for the whole UI: brand colours, the semantic `bg`/`ink`/`surface`/`line` scale that drives the light theme, and the display/body type stack.*

**Listing B.23: `src/input.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:shadow-none;
  }
  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 bg-transparent border border-primary text-primary hover:bg-primary/10 font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none;
  }
  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 text-ink2 hover:text-ink hover:bg-surface font-medium px-4 py-2 rounded-xl transition-colors duration-200;
  }
  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 bg-danger/90 hover:bg-danger text-white font-semibold px-4 py-2 rounded-xl transition-all duration-200 disabled:opacity-50;
  }
  .input-field {
    @apply w-full bg-surface border border-line rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink placeholder-ink3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200;
  }
  .field-label {
    @apply block text-sm font-medium text-ink2 mb-1.5;
  }
  .card {
    @apply bg-card border border-line rounded-2xl;
  }
  .badge {
    @apply inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full;
  }
  .nav-link {
    @apply px-3 py-2 rounded-xl text-sm font-medium text-ink2 hover:text-ink hover:bg-surface transition-colors duration-200 inline-flex items-center gap-1.5;
  }
}

@layer base {
  * { scrollbar-color: #CBD5E1 transparent; }
  html { scroll-behavior: smooth; }
  ::selection { background: #FF6B35; color: #fff; }
}

@keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-up { animation: fadeInUp .6s cubic-bezier(.16,1,.3,1) both; }

@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.skeleton { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 37%,#E2E8F0 63%); background-size: 400px 100%; animation: shimmer 1.4s ease infinite; }

@keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.animate-float { animation: floaty 5s ease-in-out infinite; }

.spinner { border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 9999px; width: 1rem; height: 1rem; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```
*Tailwind entry point compiled to `public/css/app.css` via `npm run build:css` (Table D.1): the reusable component classes (`.btn-primary`, `.card`, etc.) referenced throughout the views in Section B.5, plus the loading-skeleton, floating-card, and spinner animations used on the landing page and the two live dashboards.*

**Listing B.24: `package.json`**

```json
{
  "name": "campusbites",
  "version": "1.0.0",
  "private": true,
  "description": "CampusBites - campus food ordering demo for University of Africa, Toru-Orua",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "seed": "node data/seed.js",
    "add-vendors": "node data/add-new-vendors.js",
    "build:css": "tailwindcss -i ./src/input.css -o ./public/css/app.css --minify",
    "prestart": "npm run build:css"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "express-session": "^1.18.0"
  },
  "devDependencies": {
    "playwright-core": "^1.62.0",
    "tailwindcss": "^3.4.19"
  }
}
```
*Project manifest and npm scripts, reproduced in full in Table D.1.*

## APPENDIX C: SUPPORTING TABLES AND DATA

**Table C.1: Full vendor and menu catalogue (source: `data/vendor-catalog.js`)**

| Vendor | Status | Menu items (price, ₦) |
|---|---|---|
| Just Tools | active | Rice with Chicken (4,500); Rice with Beef (3,000); Soft Drinks (600); Bottle Water (400); Spaghetti with Chicken (4,500); Spaghetti with Egg (3,500); Spaghetti with Beef (3,000); Swallow — Egusi Soup (4,500); Swallow — Okro Soup (4,500); Swallow — Vegetable (4,500); Swallow — Banga (4,500) |
| Lari's Kitchen | active | Rice with Chicken (4,500); Rice with Beef (2,500); Bottle Water (300); Spaghetti with Chicken (4,500); Spaghetti with Egg (2,500); Spaghetti with Beef (2,000); Swallow — Egusi Soup (3,500); Swallow — Okro Soup (3,500); Swallow — Vegetable (3,500); Swallow — Banga (3,500) |
| F & S | active | Rice with Chicken (4,500); Rice with Big Chicken (8,000); Rice with Beef (3,500); Soft Drinks (600); Bottle Water (400); Spaghetti with Chicken (4,500); Spaghetti with Egg (3,500); Spaghetti with Beef (3,000); Swallow — Egusi Soup (4,500); Swallow — Vegetable (4,500); Snack — Meatpie (1,000); Snack — Chicken Bread (1,000); Snack — Milky Doughnuts (1,000); Snack — Sausage Roll (1,000) |
| Suya Spot | active | Beef Suya (1,500); Chicken Suya (1,500); Turkey Suya (2,000); Suya Wrap (2,000); Soft Drinks (600); Bottle Water (400) |
| Golden Crust Bakery | active | Snack — Meatpie (1,000); Snack — Chicken Bread (1,000); Snack — Sausage Roll (1,000); Snack — Milky Doughnuts (1,000); Cupcake (800); Bread Loaf (1,200) |
| Mama Ngozi's Kitchen | active | Swallow — Egusi Soup (4,500); Swallow — Okro Soup (4,500); Swallow — Vegetable (4,500); Amala & Ewedu (3,500); Pounded Yam & Egusi (4,000); Bottle Water (400) |
| Campus Brew & Smoothies | active | Zobo, bottle (500); Chapman (700); Fresh Smoothie (1,200); Iced Coffee (1,000); Soft Drinks (600); Bottle Water (400) |
| Iya Basira Rice Spot | active | Jollof Rice (3,000); Fried Rice (3,000); Coconut Rice (3,500); Rice with Chicken (4,500); Rice with Beef (3,000); Soft Drinks (600) |
| Bola's Snack Corner | pending | Puff Puff, 5pcs (500); Chin Chin, cup (500); Zobo, bottle (500) |

*9 vendors, 68 menu items in total, consistent with Table 4.2.*

**Table C.2: Demo/test account credentials (source: `data/seed.js`)**

| Role | Email | Password |
|---|---|---|
| Administrator | admin@campusbites.uat | admin123 |
| Vendor (any of the 9 businesses in Table C.1) | *&lt;vendor-specific, e.g.* justtools@campusbites.uat *&gt;* | vendor123 |
| Demo student | student@campusbites.uat | student123 |

**Table C.3: Sample API input/output — `GET /api/orders/mine`**

*Illustrative example only, built from real menu data in Table C.1, showing the JSON contract produced by the response-construction logic in `routes/student.js`.*

Request:
```
GET /api/orders/mine
Cookie: connect.sid=<session cookie issued at login>
```

Response body:
```json
{
  "orders": [
    {
      "id": 2,
      "status": "pending",
      "createdAt": "2026-08-08T11:43:06.305Z",
      "vendorName": "Just Tools",
      "items": [
        { "name": "Rice with Chicken", "quantity": 1, "price": 4500 },
        { "name": "Rice with Beef", "quantity": 1, "price": 3000 }
      ],
      "total": 7500
    }
  ]
}
```

## APPENDIX D: SYSTEM SETUP AND REPRODUCTION INSTRUCTIONS

**Table D.1: npm scripts (source: `package.json`)**

| Command | Effect |
|---|---|
| `npm install` | Installs dependencies |
| `npm run seed` | Resets the database and loads the vendor catalogue in Table C.1, the admin account, and the demo student |
| `npm run add-vendors` | Non-destructively adds any catalogue vendors missing from an already-running database, without altering existing users/orders (Section 4.4) |
| `npm run build:css` | Compiles `src/input.css` with Tailwind CLI to `public/css/app.css` (runs automatically before `npm start` via `prestart`) |
| `npm start` | Starts the Express server on port 3000 |

**Steps to run the system locally:**

1. `npm install`
2. `npm run seed`
3. `npm start`
4. Visit `http://localhost:3000` and sign in using an account from Table C.2.
