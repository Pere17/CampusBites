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
