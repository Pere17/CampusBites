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
