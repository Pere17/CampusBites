function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (!roles.includes(user.role)) return res.status(403).send('Forbidden');
    next();
  };
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

module.exports = { requireRole, attachUser };
