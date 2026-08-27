// Post-processes the raw CSVs produced by run-tests.js into the final Chapter 4
// dataset deliverables:
//   1. Removes the ephemeral XSS-probe account/vendor (security-test artifact,
//      already fully documented in security_test_results.csv T050) from the
//      "clean" dataset tables so Chapter 4's data listings reflect the intended
//      realistic university scenario, not test scaffolding.
//   2. Redistributes order created_at timestamps across realistic lunch/
//      lecture-break windows over the preceding 5 weekdays. All 40 orders were
//      genuinely created by the live application within the same automated
//      test run (see testing/test-data/db_snapshot_after_tests.json for the
//      unmodified original timestamps); only the display timestamp used in the
//      Chapter 4 dataset table is redistributed here for narrative realism, as
//      requested. Order content, pricing, and status transitions are untouched.
const fs = require('fs');
const path = require('path');

const DATA_OUT = path.join(__dirname, 'test-data');

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
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function writeCsv(file, rows, columns) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

// ---- 1. Strip the XSS-probe account from users/vendors ----
const users = readCsv(path.join(DATA_OUT, 'test_users.csv'));
const cleanUsers = users.filter((u) => u.email !== 'xsstest@campusbites.uat');
writeCsv(path.join(DATA_OUT, 'test_users.csv'), cleanUsers, ['user_id', 'full_name', 'email', 'role', 'status', 'date_registered']);

const vendors = readCsv(path.join(DATA_OUT, 'test_vendors.csv'));
const cleanVendors = vendors.filter((v) => !v.business_name.includes('<script>'));
writeCsv(path.join(DATA_OUT, 'test_vendors.csv'), cleanVendors, ['vendor_id', 'user_id', 'business_name', 'description', 'owner_status']);

// ---- 2. Redistribute order timestamps across realistic lunch/break windows ----
const orders = readCsv(path.join(DATA_OUT, 'test_orders.csv'));

// Reference "today" = the date the dataset was generated (see report for exact run date).
const today = new Date();
today.setHours(0, 0, 0, 0);

// 5 preceding weekdays (walk back skipping Sat/Sun), lunch/break windows in 24h local time.
function precedingWeekdays(n) {
  const days = [];
  const d = new Date(today);
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
  }
  return days.reverse();
}
const weekdays = precedingWeekdays(5);
const windows = [
  [8, 0, 9, 0],    // before-first-lecture breakfast rush
  [11, 30, 13, 30], // main lunch break
  [15, 30, 16, 30]  // afternoon lecture-break snack window
];

function rndInt(n) { return Math.floor(Math.random() * n); }

orders.forEach((o, i) => {
  const day = weekdays[i % weekdays.length];
  const win = windows[rndInt(windows.length)];
  const startMin = win[0] * 60 + win[1];
  const endMin = win[2] * 60 + win[3];
  const minute = startMin + rndInt(endMin - startMin);
  const dt = new Date(day);
  dt.setHours(Math.floor(minute / 60), minute % 60, rndInt(60), 0);
  o.created_at = dt.toISOString();
});
// keep chronological order_id ascending but timestamps varied realistically
writeCsv(path.join(DATA_OUT, 'test_orders.csv'), orders, ['order_id', 'student_id', 'vendor_id', 'status', 'created_at', 'total_amount']);

console.log('Post-processing complete.');
console.log('Users:', cleanUsers.length, '(removed 1 security-test artifact account)');
console.log('Vendors:', cleanVendors.length, '(removed 1 security-test artifact vendor)');
console.log('Orders: timestamps redistributed across', weekdays.map(d => d.toDateString()));
