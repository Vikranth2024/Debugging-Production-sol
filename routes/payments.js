const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /payments
 * Initiates a payment for an order.
 */
router.post('/', async (req, res) => {
  const { order_id, amount, status } = req.body;

  try {
    // ≡ƒ¢í∩╕Å BELT-AND-SUSPENDERS:
    // Check if a payment already exists for this order before attempting to pay again.
    // The schema UNIQUE constraint (unique_payment_per_order) will reject double-pay
    // attempts, but this check ensures the client knows exactly why it was rejected.
    const existingPayment = await pool.query('SELECT id FROM payments WHERE order_id = $1', [order_id]);
    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ error: `A payment record already exists for order ${order_id}. Duplicate payment attempts are blocked.` });
    }

    const newPayment = await pool.query(
      'INSERT INTO payments (order_id, amount, status) VALUES ($1, $2, $3) RETURNING *',
      [order_id, amount, status || 'pending']
    );

    res.status(201).json(newPayment.rows[0]);
  } catch (err) {
    // If the check above is somehow bypassed (concurrent requests), the UNIQUE constraint will throw the error.
    console.error(err.message);
    res.status(500).json({ error: 'Database integrity/uniqueness violation' });
  }
});

module.exports = router;
