require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database & Seeds
initDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'FreshFold Laundry & Dry Cleaning Management System',
    time: new Date().toISOString()
  });
});

// Fallback to index.html for non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`✨ VASTRIA Premium Garment Care Server is running!`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log(`📦 Admin Login: admin@vastria.com / admin123`);
  console.log(`👤 Customer Demo: customer@vastria.com / user123`);
  console.log(`📍 Location: Goutam Budh Nagar, Savina, Udaipur`);
  console.log(`📞 Phone: +91 8005975274 / +91 9413752745`);
  console.log(`====================================================`);
});
