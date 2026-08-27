# CampusBites — Spec (5-Hour Demo Build)

Campus food ordering platform for University of Africa, Toru-Orua (UAT).

## Scope decision
Deadline is a live clickable demo in ~5 hours. Scope is cut to the **core order flow only**:
- No WebSockets → status updates via polling (auto-refresh every 4s)
- No ratings/reviews, no order cancellation, no admin charts (numbers only)
- No real payment — "Pay on pickup" (simulated)
- Auth: simple email/password (bcrypt hash + session cookie), no email verification
- Vendor menus are seeded from real data (not editable via UI in this build)

## Users & roles
- **Student**: register/login, browse vendors, view menu, add to cart, place order, track order status, view order history.
- **Vendor**: register/login (account starts `pending`), once approved by admin can view incoming orders and advance status.
- **Admin**: pre-seeded account. Approves/rejects pending vendors, views vendor list, sees basic stats (total orders, orders per vendor, pending vendor count).

## Order status lifecycle
`pending` → `preparing` (vendor accepts) → `ready` (vendor marks ready) → `completed` (student/vendor marks picked up)

## Pages
1. `/` Landing — brand intro + login/register links
2. `/register` — choose role (student/vendor), role-specific fields
3. `/login`
4. `/vendors` — student: list of approved vendors (card grid)
5. `/vendors/:id` — student: menu, add items to cart
6. `/cart` — review cart, place order (pay-on-pickup)
7. `/orders` — student: order history + live status (polling) of active orders
8. `/vendor/dashboard` — vendor: incoming orders by status, accept/advance buttons
9. `/admin/dashboard` — admin: pending vendor approvals, vendor list, stats

## Data model (SQLite)
- **users**: id, name, email, password_hash, role(student/vendor/admin), status(active/pending — vendors only), created_at
- **vendors**: id, user_id, business_name, description
- **menu_items**: id, vendor_id, name, price
- **orders**: id, student_id, vendor_id, status, created_at
- **order_items**: id, order_id, menu_item_id, quantity, price_at_order

## Seed data
3 vendors seeded from real UAT vendor data (Just Tools, Lari's Kitchen, F & S) with full menus as provided. 1 admin account (`admin@campusbites.uat` / `admin123`).

## Stack
- Single Node.js + Express server (no separate frontend build step — minimizes moving parts for a live demo)
- EJS server-rendered templates + Tailwind via CDN for styling
- SQLite via `better-sqlite3` (zero external DB setup)
- `express-session` + `bcryptjs` for auth
- Vanilla JS `fetch` polling on order-tracking / dashboard pages for near-real-time updates

## Brand
UAT green (`#0F7A3D`-ish) & white. Clean modern food-app card style.

## Run
```
npm install
npm run seed
npm start
```
Visit `http://localhost:3000`.
