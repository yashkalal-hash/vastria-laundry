const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(requireAdmin);

// Dashboard Overview Stats
router.get('/stats', (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('Delivered', 'Cancelled')").get().count;
    const deliveredOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Delivered'").get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = 'paid' OR status = 'Delivered'").get().total;
    const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
    const newInquiries = db.prepare('SELECT COUNT(*) as count FROM contact_inquiries').get().count;

    // Status breakdown
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `).all();

    // Recent 5 orders
    const recentOrders = db.prepare(`
      SELECT * FROM orders 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalRevenue: Math.round(totalRevenue),
        totalCustomers,
        newInquiries,
        statusCounts,
        recentOrders
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch dashboard metrics.' });
  }
});

// Get All Orders with filter & search
router.get('/orders', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (tracking_id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY id DESC';

    const orders = db.prepare(query).all(...params);
    const ordersWithItems = orders.map(ord => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(ord.id);
      return { ...ord, items };
    });

    res.json({ success: true, orders: ordersWithItems });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch orders list.' });
  }
});

// Update Order Status
router.put('/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, payment_status, notes } = req.body;

    const currentOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    db.prepare(`
      UPDATE orders 
      SET status = COALESCE(?, status), 
          payment_status = COALESCE(?, payment_status),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, payment_status, notes, id);

    if (status && status !== currentOrder.status) {
      db.prepare(`
        INSERT INTO order_status_history (order_id, status, comment)
        VALUES (?, ?, ?)
      `).run(id, status, comment || `Status updated to ${status}`);
    }

    res.json({ success: true, message: 'Order updated successfully!' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Could not update order status.' });
  }
});

// Get Customers List
router.get('/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.address, u.created_at,
             COUNT(o.id) as order_count,
             COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY u.id DESC
    `).all();

    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch customer list.' });
  }
});

// Inquiries list
router.get('/inquiries', (req, res) => {
  try {
    const inquiries = db.prepare('SELECT * FROM contact_inquiries ORDER BY id DESC').all();
    res.json({ success: true, inquiries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch inquiries.' });
  }
});

module.exports = router;
