const fs = require('fs');
const path = require('path');
const RESULTS = path.join(__dirname, 'results');
const DATA = path.join(__dirname, 'test-data');

function readCsv(file) {
  const raw = fs.readFileSync(file, 'utf-8').trim().split('\n');
  const cols = parseCsvLine(raw[0]);
  return raw.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    return row;
  });
}
function parseCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ',') { out.push(cur); cur=''; } else cur += ch; }
  }
  out.push(cur);
  return out;
}

function summarize(name, file) {
  const rows = readCsv(file);
  const scored = rows.filter((r) => r.pass === 'true' || r.pass === 'false');
  const passed = scored.filter((r) => r.pass === 'true').length;
  const failed = scored.filter((r) => r.pass === 'false').length;
  const notApplicable = rows.length - scored.length;
  const rate = scored.length ? ((passed / scored.length) * 100).toFixed(1) : 'N/A';
  console.log(`${name}: total=${rows.length} scored=${scored.length} passed=${passed} failed=${failed} n/a=${notApplicable} passRate=${rate}%`);
  return { name, total: rows.length, scored: scored.length, passed, failed, notApplicable, rate };
}

const buckets = [
  ['Unit', 'unit_test_results.csv'],
  ['Integration', 'integration_test_results.csv'],
  ['System', 'system_test_results.csv'],
  ['Negative/Error', 'negative_test_results.csv'],
  ['Security', 'security_test_results.csv']
];
const summary = buckets.map(([name, file]) => summarize(name, path.join(RESULTS, file)));

const totalScored = summary.reduce((a,b) => a + b.scored, 0);
const totalPassed = summary.reduce((a,b) => a + b.passed, 0);
console.log(`\nOVERALL: scored=${totalScored} passed=${totalPassed} passRate=${((totalPassed/totalScored)*100).toFixed(1)}%`);

// Performance stats
const perf = readCsv(path.join(RESULTS, 'performance_results.csv'));
console.log('\nPERFORMANCE:');
perf.forEach(p => console.log(`  ${p.operation}: avg=${p.avg}ms min=${p.min}ms max=${p.max}ms (n=${p.runs})`));

// Usability stats
const uxRows = readCsv(path.join(DATA, 'usability_test_data.csv'));
const fields = ['ease_of_registration','ease_of_browsing_menus','ease_of_placing_orders','clarity_of_order_status','ease_of_order_management','overall_usefulness','overall_satisfaction'];
console.log('\nUSABILITY (5-point Likert, synthetic test data):');
fields.forEach((f) => {
  const vals = uxRows.map(r => r[f]).filter(v => v !== '' && v !== undefined).map(Number);
  if (!vals.length) return;
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  console.log(`  ${f}: n=${vals.length} avg=${avg.toFixed(2)}`);
});

// Dataset counts
const users = readCsv(path.join(DATA, 'test_users.csv'));
const vendors = readCsv(path.join(DATA, 'test_vendors.csv'));
const items = readCsv(path.join(DATA, 'test_menu_items.csv'));
const orders = readCsv(path.join(DATA, 'test_orders.csv'));
console.log('\nDATASET COUNTS:');
console.log('  users:', users.length, '(students:', users.filter(u=>u.role==='student').length, ', vendors:', users.filter(u=>u.role==='vendor').length, ', admin:', users.filter(u=>u.role==='admin').length, ')');
console.log('  vendor businesses:', vendors.length);
console.log('  menu items:', items.length);
console.log('  orders:', orders.length);
const statusCounts = {};
orders.forEach(o => statusCounts[o.status] = (statusCounts[o.status]||0)+1);
console.log('  order status distribution:', statusCounts);
const revenue = orders.filter(o=>o.status==='completed').reduce((s,o)=>s+Number(o.total_amount),0);
console.log('  total value of COMPLETED orders (NGN):', revenue);
const totalOrderValue = orders.reduce((s,o)=>s+Number(o.total_amount),0);
console.log('  total value of ALL orders (NGN):', totalOrderValue);

fs.writeFileSync(path.join(__dirname, 'summary-raw.json'), JSON.stringify({ summary, perf, users: users.length, vendors: vendors.length, items: items.length, orders: orders.length, statusCounts, revenue, totalOrderValue }, null, 2));
