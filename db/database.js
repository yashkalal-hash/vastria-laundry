const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'laundry.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer', -- 'customer' or 'admin'
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      unit TEXT DEFAULT 'piece', -- 'kg', 'piece', 'pair'
      turnaround_hours INTEGER DEFAULT 24,
      image_icon TEXT,
      is_popular BOOLEAN DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES service_categories (id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      pickup_address TEXT NOT NULL,
      delivery_address TEXT,
      pickup_date TEXT NOT NULL,
      pickup_time_slot TEXT NOT NULL,
      delivery_date TEXT,
      delivery_time_slot TEXT,
      special_instructions TEXT,
      payment_method TEXT DEFAULT 'cash_on_delivery', -- 'cash_on_delivery', 'online_upi', 'card'
      payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid'
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'Order Placed', -- 'Order Placed', 'Pickup Scheduled', 'Picked Up', 'In Wash & Clean', 'Ironing & Packing', 'Out for Delivery', 'Delivered', 'Cancelled'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  // Check if admin exists
  const adminCheck = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@vastria.com");
  if (!adminCheck) {
    const adminPassword = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO users (name, email, phone, password, role, address)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `).run("Vastria Admin", "admin@vastria.com", "8005975274", adminPassword, "Goutam Budh Nagar, Near by Dainik Navjyoti, Savina, Udaipur");

    // Demo customer
    const customerPassword = bcrypt.hashSync("user123", 10);
    db.prepare(`
      INSERT INTO users (name, email, phone, password, role, address)
      VALUES (?, ?, ?, ?, 'customer', ?)
    `).run("Yash Vardhan", "customer@vastria.com", "9413752745", customerPassword, "Sector 14, Hiran Magri, Udaipur, Rajasthan");
  }

  // Check Categories
  const catCount = db.prepare("SELECT COUNT(*) as count FROM service_categories").get().count;
  if (catCount === 0) {
    const insertCat = db.prepare("INSERT INTO service_categories (name, slug, icon, description) VALUES (?, ?, ?, ?)");
    insertCat.run("Premium Dry Cleaning", "dry-clean", "fas fa-spray-can", "Hydrocarbon German eco-friendly dry cleaning for designer & ethnic wear.");
    insertCat.run("Shoe Cleaning & Spa", "shoe-spa", "fas fa-shoe-prints", "Deep foam restoration, sole whitening, and disinfection.");
    insertCat.run("Leather & Bag Care", "leather-care", "fas fa-briefcase", "Conditioning, stain removal, and restoration for leather items.");
    insertCat.run("Curtain Cleaning", "curtain-service", "fas fa-window-maximize", "Silk, velvet, and blackout curtain cleaning with pleat press.");
    insertCat.run("Carpet Dry Cleaning", "carpet-service", "fas fa-border-all", "Persian, Turkish, and wool carpet deep extraction.");
    insertCat.run("Laundry & Steam Iron", "laundry-steam", "fas fa-tshirt", "Wash & fold, steam pressing with German equipment.");
  }

  // Check Services
  const serviceCount = db.prepare("SELECT COUNT(*) as count FROM services").get().count;
  if (serviceCount === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (category_id, name, description, price, unit, turnaround_hours, image_icon, is_popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Wash & Fold (cat 1)
    insertService.run(1, "Daily Wear Laundry (Wash & Fold)", "Shirts, T-shirts, Trousers, Undergarments", 79, "kg", 24, "fa-tshirt", 1);
    insertService.run(1, "Wash & Steam Iron Combo", "Complete wash plus crisp steam press on hangers", 119, "kg", 24, "fa-shield-alt", 1);
    
    // Steam Iron (cat 2)
    insertService.run(2, "Shirt / T-Shirt Steam Press", "High quality steam pressing on hanger", 20, "piece", 12, "fa-user-tie", 1);
    insertService.run(2, "Trouser / Jeans Press", "Crease-perfection steam iron", 25, "piece", 12, "fa-socks", 0);
    insertService.run(2, "Saree / Kurta Steam Press", "Delicate fabric temperature-controlled press", 50, "piece", 24, "fa-vest", 0);

    // Dry Cleaning (cat 3)
    insertService.run(3, "Men's 2-Piece Suit Dry Clean", "Specialized eco-friendly solvent cleaning & shaping", 299, "piece", 48, "fa-user-tie", 1);
    insertService.run(3, "Designer Silk Saree Dry Clean", "Delicate gold-zari safe processing", 249, "piece", 48, "fa-female", 1);
    insertService.run(3, "Winter Jacket / Blazer", "Heavy fleece, leather trim, down jacket treatment", 220, "piece", 48, "fa-mitten", 0);
    insertService.run(3, "Dress / Gown Dry Clean", "Party wear, sequin, embroidery safe cleaning", 350, "piece", 48, "fa-crown", 0);

    // Shoe & Bag (cat 4)
    insertService.run(4, "Sneakers Deep Cleaning", "Sole whitening, inner disinfection, lace wash", 199, "pair", 48, "fa-shoe-prints", 1);
    insertService.run(4, "Leather Shoes Buff & Polish", "Conditioning, stain removal, high-shine buff", 249, "pair", 48, "fa-shoe-prints", 0);
    insertService.run(4, "Handbag / Backpack Spa", "Fabric/leather revitalization & sanitized deodorizing", 299, "piece", 48, "fa-shopping-bag", 0);

    // Home Care (cat 5)
    insertService.run(5, "Double Bed Blanket / Quilt", "Fluffy allergen-free comforter wash & sanitization", 299, "piece", 48, "fa-bed", 1);
    insertService.run(5, "Curtains Cleaning (Per Panel)", "Dust extraction, steam press, pleated finish", 149, "piece", 48, "fa-dungeon", 0);
    insertService.run(5, "Bedsheet & Pillow Covers Set", "Deep wash, hygienic steam pressing", 120, "piece", 24, "fa-layer-group", 0);
  }

  // Sample Demo Orders
  const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
  if (orderCount === 0) {
    const createOrder = db.prepare(`
      INSERT INTO orders (
        tracking_id, user_id, customer_name, customer_phone, customer_email,
        pickup_address, delivery_address, pickup_date, pickup_time_slot,
        delivery_date, delivery_time_slot, special_instructions,
        payment_method, payment_status, total_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, service_id, service_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertHist = db.prepare(`
      INSERT INTO order_status_history (order_id, status, comment)
      VALUES (?, ?, ?)
    `);

    // Demo Order 1: Active In Cleaning
    const ord1 = createOrder.run(
      "FF-849201",
      2,
      "Rahul Sharma",
      "9812345678",
      "rahul@example.com",
      "Flat 402, Green Valley Apartments, Mumbai",
      "Flat 402, Green Valley Apartments, Mumbai",
      "2026-10-02",
      "10:00 AM - 12:00 PM",
      "2026-10-04",
      "04:00 PM - 06:00 PM",
      "Please use gentle detergent for shirts.",
      "cash_on_delivery",
      "pending",
      598,
      "In Wash & Clean"
    );

    insertItem.run(ord1.lastInsertRowid, 1, "Daily Wear Laundry (Wash & Fold)", 4, 79, 316);
    insertItem.run(ord1.lastInsertRowid, 6, "Men's 2-Piece Suit Dry Clean", 1, 299, 299);
    
    insertHist.run(ord1.lastInsertRowid, "Order Placed", "Order received successfully via web portal.");
    insertHist.run(ord1.lastInsertRowid, "Picked Up", "Pickup completed by agent Vikram (Mob: 9988776655).");
    insertHist.run(ord1.lastInsertRowid, "In Wash & Clean", "Garments tagged and undergoing eco-friendly washing process.");

    // Demo Order 2: Out for Delivery
    const ord2 = createOrder.run(
      "FF-392011",
      2,
      "Priya Kapoor",
      "9876501234",
      "priya.k@example.com",
      "B-12, Palm Residency, Bandra West, Mumbai",
      "B-12, Palm Residency, Bandra West, Mumbai",
      "2026-10-01",
      "02:00 PM - 04:00 PM",
      "2026-10-03",
      "11:00 AM - 01:00 PM",
      "Call before reaching gate.",
      "online_upi",
      "paid",
      448,
      "Out for Delivery"
    );

    insertItem.run(ord2.lastInsertRowid, 7, "Designer Silk Saree Dry Clean", 1, 249, 249);
    insertItem.run(ord2.lastInsertRowid, 10, "Sneakers Deep Cleaning", 1, 199, 199);

    insertHist.run(ord2.lastInsertRowid, "Order Placed", "Online order placed with instant UPI payment.");
    insertHist.run(ord2.lastInsertRowid, "Picked Up", "Items collected.");
    insertHist.run(ord2.lastInsertRowid, "In Wash & Clean", "Specialized silk dry cleaning done.");
    insertHist.run(ord2.lastInsertRowid, "Ironing & Packing", "Hanger packing & barcode bagging completed.");
    insertHist.run(ord2.lastInsertRowid, "Out for Delivery", "Rider Amit is on the way for delivery.");
  }
}

module.exports = {
  db,
  initDatabase
};
