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
