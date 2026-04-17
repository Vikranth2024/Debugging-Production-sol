const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /order_items
 * Adds a product to an existing order, decrementing stock.
 */
router.post('/', async (req, res) => {
  const { order_id, product_id, quantity } = req.body;

  try {
    // ≡ƒ¢í∩╕Å BELT-AND-SUSPENDERS:
    // Before decrementing inventory, check if enough stock exists.
    // This gives a cleaner error to the user than just throwing a PG CHECK violation.
    const productStatus = await pool.query('SELECT inventory_count FROM products WHERE id = $1', [product_id]);
    if (productStatus.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentInventory = productStatus.rows[0].inventory_count;
    if (currentInventory - quantity < 0) {
      return res.status(400).json({ error: 'Insufficent inventory to fulfill the request.' });
    }

    // Begin atomic update
    await pool.query('UPDATE products SET inventory_count = inventory_count - $1 WHERE id = $2', [quantity, product_id]);
    const newItem = await pool.query(
      'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
      [order_id, product_id, quantity]
    );

    res.status(201).json(newItem.rows[0]);
  } catch (err) {
    // The schema constraint (check_inventory_non_negative) will reject bad 
    // data automatically if the application-level check fails.
    console.error(err.description);
    res.status(500).json({ error: 'Database integrity error' });
  }
});

module.exports = router;
