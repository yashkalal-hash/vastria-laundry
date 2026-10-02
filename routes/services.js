const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// Get all categories with their services
router.get('/catalog', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM service_categories ORDER BY id ASC').all();
    const services = db.prepare('SELECT * FROM services ORDER BY category_id, id ASC').all();

    const categorized = categories.map(cat => ({
      ...cat,
      services: services.filter(s => s.category_id === cat.id)
    }));

    res.json({ success: true, categories: categorized, allServices: services });
  } catch (err) {
    console.error('Catalog error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch catalog.' });
  }
});

// Get popular / featured services
router.get('/featured', (req, res) => {
  try {
    const featured = db.prepare(`
      SELECT s.*, c.name as category_name 
      FROM services s 
      JOIN service_categories c ON s.category_id = c.id 
      WHERE s.is_popular = 1 
      ORDER BY s.id ASC
    `).all();
    res.json({ success: true, services: featured });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch featured services.' });
  }
});

// Admin: Add new service
router.post('/', requireAdmin, (req, res) => {
  try {
    const { category_id, name, description, price, unit, turnaround_hours, image_icon, is_popular } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO services (category_id, name, description, price, unit, turnaround_hours, image_icon, is_popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(category_id || 1, name, description || '', price, unit || 'piece', turnaround_hours || 24, image_icon || 'fa-tshirt', is_popular ? 1 : 0);

    res.json({ success: true, message: 'Service added successfully!', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not add service.' });
  }
});

// Admin: Update service
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, price, unit, turnaround_hours, image_icon, is_popular } = req.body;

    db.prepare(`
      UPDATE services 
      SET category_id = ?, name = ?, description = ?, price = ?, unit = ?, turnaround_hours = ?, image_icon = ?, is_popular = ?
      WHERE id = ?
    `).run(category_id, name, description, price, unit, turnaround_hours, image_icon, is_popular ? 1 : 0, id);

    res.json({ success: true, message: 'Service updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update service.' });
  }
});

// Admin: Delete service
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Service deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not delete service.' });
  }
});

module.exports = router;
