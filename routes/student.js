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
