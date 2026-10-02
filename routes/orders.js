const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, optionalToken } = require('../middleware/auth');

// Generate unique tracking code e.g., FF-749210
function generateTrackingId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `FF-${randomDigits}`;
}

// Create new order (Logged-in or Guest customer)
router.post('/book', optionalToken, (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      pickup_address,
      delivery_address,
      pickup_date,
      pickup_time_slot,
      delivery_date,
      delivery_time_slot,
      special_instructions,
      payment_method,
      items // Array of { service_id, service_name, quantity, unit_price }
    } = req.body;

    if (!customer_name || !customer_phone || !pickup_address || !pickup_date || !pickup_time_slot) {
      return res.status(400).json({ success: false, message: 'Please fill in all required customer and pickup details.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one service item to book.' });
    }

    // Calculate total
    let totalAmount = 0;
    items.forEach(item => {
      const subtotal = Number(item.quantity) * Number(item.unit_price);
      totalAmount += subtotal;
    });

    // Min order check or tax/delivery if needed
    const trackingId = generateTrackingId();
    const userId = req.user ? req.user.id : null;

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        tracking_id, user_id, customer_name, customer_phone, customer_email,
        pickup_address, delivery_address, pickup_date, pickup_time_slot,
        delivery_date, delivery_time_slot, special_instructions,
        payment_method, payment_status, total_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'Order Placed')
    `);

    const orderResult = insertOrder.run(
      trackingId,
      userId,
      customer_name,
      customer_phone,
      customer_email || '',
      pickup_address,
      delivery_address || pickup_address,
      pickup_date,
      pickup_time_slot,
      delivery_date || '',
      delivery_time_slot || '',
      special_instructions || '',
      payment_method || 'cash_on_delivery',
      totalAmount
    );

    const orderId = orderResult.lastInsertRowid;

    // Insert items
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, service_id, service_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertManyItems = db.transaction((orderItems) => {
      for (const item of orderItems) {
        const subtotal = Number(item.quantity) * Number(item.unit_price);
        insertItem.run(orderId, item.service_id || null, item.service_name, item.quantity, item.unit_price, subtotal);
      }
    });

    insertManyItems(items);

    // Insert first status history
    db.prepare(`
      INSERT INTO order_status_history (order_id, status, comment)
      VALUES (?, 'Order Placed', 'Pickup request registered. Rider assignment in progress.')
    `).run(orderId);

    res.json({
      success: true,
      message: 'Order booked successfully!',
      tracking_id: trackingId,
      order_id: orderId,
      total_amount: totalAmount
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ success: false, message: 'Could not create order. Please try again.' });
  }
});

// Quick Track Order (Public)
router.get('/track/:trackingId', (req, res) => {
  try {
    const { trackingId } = req.params;
    const cleanId = trackingId.trim().toUpperCase();

    const order = db.prepare(`
      SELECT * FROM orders WHERE UPPER(tracking_id) = ? OR UPPER(customer_phone) = ?
    `).get(cleanId, cleanId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'No active order found with this Tracking ID or Phone.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(order.id);

    res.json({
      success: true,
      order,
      items,
      history
    });
  } catch (err) {
    console.error('Tracking error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving order status.' });
  }
});

// Get Current User's Orders
router.get('/my-orders', authenticateToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE user_id = ? OR customer_email = ? 
      ORDER BY id DESC
    `).all(req.user.id, req.user.email);

    const ordersWithItems = orders.map(ord => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(ord.id);
      return { ...ord, items };
    });

    res.json({ success: true, orders: ordersWithItems });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching order history.' });
  }
});

// Cancel Order (Only if still in 'Order Placed' status)
router.post('/cancel/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized action.' });
    }

    if (order.status !== 'Order Placed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel order after pickup is scheduled or in-progress.' });
    }

    db.prepare("UPDATE orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    db.prepare("INSERT INTO order_status_history (order_id, status, comment) VALUES (?, 'Cancelled', 'Cancelled by user.')").run(id);

    res.json({ success: true, message: 'Order cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error cancelling order.' });
  }
});

// Contact message
router.post('/contact', (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    }

    db.prepare('INSERT INTO contact_inquiries (name, email, phone, message) VALUES (?, ?, ?, ?)').run(name, email, phone || '', message);
    res.json({ success: true, message: 'Thank you! Your message has been received. Our team will contact you shortly.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error submitting message.' });
  }
});

module.exports = router;
