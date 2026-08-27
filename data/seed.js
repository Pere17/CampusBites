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
