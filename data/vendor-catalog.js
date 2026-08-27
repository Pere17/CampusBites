// Shared vendor + menu definitions, used by both data/seed.js (fresh installs)
// and data/add-new-vendors.js (appending to an already-running db.json without
// wiping existing users/orders). Keep both files' vendor data in sync by only
// editing it here.
//
// Each item's image is resolved at render time from its *name* via slugify()
// (see server.js + public/images/README.md), so items with the same name
// across vendors (e.g. "Rice with Chicken") automatically share one photo.

module.exports = [
  {
    ownerName: 'Just Tools Owner',
    ownerEmail: 'justtools@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Just Tools',
    description: 'Campus eatery — rice, spaghetti & swallow',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 3000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 3500],
      ['Spaghetti with Beef', 3000],
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Okro Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Swallow — Banga', 4500]
    ]
  },
  {
    ownerName: "Lari's Kitchen Owner",
    ownerEmail: 'lariskitchen@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: "Lari's Kitchen",
    description: 'Student-run kitchen — home-style meals',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 2500],
      ['Bottle Water', 300],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 2500],
      ['Spaghetti with Beef', 2000],
      ['Swallow — Egusi Soup', 3500],
      ['Swallow — Okro Soup', 3500],
      ['Swallow — Vegetable', 3500],
      ['Swallow — Banga', 3500]
    ]
  },
  {
    ownerName: 'F & S Owner',
    ownerEmail: 'fands@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'F & S',
    description: 'Rice, spaghetti, swallow & snacks',
    items: [
      ['Rice with Chicken', 4500],
      ['Rice with Big Chicken', 8000],
      ['Rice with Beef', 3500],
      ['Soft Drinks', 600],
      ['Bottle Water', 400],
      ['Spaghetti with Chicken', 4500],
      ['Spaghetti with Egg', 3500],
      ['Spaghetti with Beef', 3000],
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Snack — Meatpie', 1000],
      ['Snack — Chicken Bread', 1000],
      ['Snack — Milky Doughnuts', 1000],
      ['Snack — Sausage Roll', 1000]
    ]
  },
  {
    ownerName: 'Suya Spot Owner',
    ownerEmail: 'suyaspot@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Suya Spot',
    description: 'Grills & suya — beef, chicken & turkey skewers',
    items: [
      ['Beef Suya', 1500],
      ['Chicken Suya', 1500],
      ['Turkey Suya', 2000],
      ['Suya Wrap', 2000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Golden Crust Bakery Owner',
    ownerEmail: 'goldencrust@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Golden Crust Bakery',
    description: 'Fresh pastries baked daily on campus',
    items: [
      ['Snack — Meatpie', 1000],
      ['Snack — Chicken Bread', 1000],
      ['Snack — Sausage Roll', 1000],
      ['Snack — Milky Doughnuts', 1000],
      ['Cupcake', 800],
      ['Bread Loaf', 1200]
    ]
  },
  {
    ownerName: "Mama Ngozi's Kitchen Owner",
    ownerEmail: 'mamangozi@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: "Mama Ngozi's Kitchen",
    description: 'Home-style swallow & soups made fresh',
    items: [
      ['Swallow — Egusi Soup', 4500],
      ['Swallow — Okro Soup', 4500],
      ['Swallow — Vegetable', 4500],
      ['Amala & Ewedu', 3500],
      ['Pounded Yam & Egusi', 4000],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Campus Brew & Smoothies Owner',
    ownerEmail: 'campusbrew@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Campus Brew & Smoothies',
    description: 'Drinks, smoothies & zobo to cool you down',
    items: [
      ['Zobo (bottle)', 500],
      ['Chapman', 700],
      ['Fresh Smoothie', 1200],
      ['Iced Coffee', 1000],
      ['Soft Drinks', 600],
      ['Bottle Water', 400]
    ]
  },
  {
    ownerName: 'Iya Basira Rice Spot Owner',
    ownerEmail: 'iyabasira@campusbites.uat',
    password: 'vendor123',
    status: 'active',
    businessName: 'Iya Basira Rice Spot',
    description: 'Rice specialist — jollof, fried & coconut rice',
    items: [
      ['Jollof Rice', 3000],
      ['Fried Rice', 3000],
      ['Coconut Rice', 3500],
      ['Rice with Chicken', 4500],
      ['Rice with Beef', 3000],
      ['Soft Drinks', 600]
    ]
  },
  {
    ownerName: 'Bola (Snack Hustle)',
    ownerEmail: 'bolasnacks@campusbites.uat',
    password: 'vendor123',
    status: 'pending',
    businessName: "Bola's Snack Corner",
    description: 'Student hustle — awaiting admin approval',
    items: [
      ['Puff Puff (5pcs)', 500],
      ['Chin Chin (cup)', 500],
      ['Zobo (bottle)', 500]
    ]
  }
];
