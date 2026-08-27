const express = require('express');
const session = require('express-session');
const path = require('path');

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const vendorRoutes = require('./routes/vendor');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Deterministic image filename for a vendor/menu item name, e.g. "Swallow — Egusi Soup" -> "swallow-egusi-soup".
// Used by views to look up /images/vendors/<slug>.jpg and /images/menu/<slug>.jpg — see public/images/README.md.
app.locals.slugify = function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: 'campusbites-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);
app.use(attachUser);

app.get('/', (req, res) => {
  res.render('landing');
});

app.use(authRoutes);
app.use(studentRoutes);
app.use(vendorRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusBites running at http://localhost:${PORT}`);
});
