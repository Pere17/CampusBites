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
