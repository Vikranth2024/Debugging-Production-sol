const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /orders
 * Creates a new order for a customer.
 */
router.post('/', async (req, res) => {
  const { customer_id, total } = req.body;

  try {
    // ≡ƒ¢í∩╕Å BELT-AND-SUSPENDERS:
    // Initial check to ensure customer exists before attempting DB insert.
    // The schema constraint (fk_orders_customer) will reject bad data, 
    // but this gives a cleaner error message to the API consumer.
    const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      return res.status(400).json({ error: `Customer with ID ${customer_id} does not exist.` });
    }

    const newOrder = await pool.query(
      'INSERT INTO orders (customer_id, total, status) VALUES ($1, $2, $3) RETURNING *',
      [customer_id, total, 'pending']
    );

    res.status(201).json(newOrder.rows[0]);
  } catch (err) {
    // If the check above is somehow bypassed (race condition), the FK constraint will catch it.
    console.error(err.message);
    res.status(500).json({ error: 'Database error while creating order' });
  }
});

module.exports = router;
