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
