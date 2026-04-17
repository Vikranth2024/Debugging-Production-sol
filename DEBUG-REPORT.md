# OrderFlow: Production Incident Debugging Report

**Role:** Senior Database Engineer / Incident Responder  
**Scope:** Investigation into Data Integrity Failures (Orphaned Orders, Negative Inventory, Duplicate Payments)

---

## Bug 1 ΓÇö Orphaned Orders (Data Persistence Failure)

### ≡ƒÜ¿ Reproduction
Query to identify orders without a valid customer:
```sql
SELECT o.id AS order_id, o.customer_id, c.name AS customer_name 
FROM orders o 
LEFT JOIN customers c ON o.customer_id = c.id 
WHERE c.id IS NULL;
```
**Expected Output:** 1+ rows showing `customer_name` as `NULL`.  
**Actual Result:** Showed 12 orphaned orders created with `customer_id` such as `9999` and `8888`.

### ≡ƒöÄ Data Flow Trace
The wrong value surfaces in `GET /orders` when the route joins `orders` to `customers`. Since `customer_id = 9999` returns no matching row in the `customers` table, the `customer_name` is returned as `NULL`. The application accepted the order because the `orders.customer_id` field has no constraints preventing non-existent IDs.

### ≡ƒºá Root Cause
**Missing FOREIGN KEY constraint on `orders.customer_id` referencing `customers(id)`.** Without this constraint, the database accepts any integer for `customer_id` without verifying if a corresponding customer exists in the system.

### ≡ƒ¢á∩╕Å Fix
```sql
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (customer_id) 
REFERENCES customers(id);
```

### Γ£à Validation
1. **Clean-run:** Re-running the reproduction query returns `0 rows` (after deleting orphaned records).
2. **Rejection check:** 
   ```sql
   INSERT INTO orders (customer_id, total, status) VALUES (9999, 150.00, 'pending');
   -- Result: ERROR: insert or update on table "orders" violates foreign key constraint "fk_orders_customer"
   ```

---

## Bug 2 ΓÇö Negative Inventory (Revenue Leakage)

### ≡ƒÜ¿ Reproduction
Query to find products with sub-zero stock:
```sql
SELECT id, name, inventory_count 
FROM products 
WHERE inventory_count < 0;
```
**Expected Output:** Rows showing negative values (e.g., `-5`).

### ≡ƒöÄ Data Flow Trace
Negative records appear in `GET /products` and cause stockouts in the ordering process. The logic in `routes/order_items.js` decrements inventory with `UPDATE products SET inventory_count = inventory_count - $1` during order creation. It fails to check if the current stock is sufficient. Because the database column has no `CHECK` constraint, it silently allowed the value to cross into negatives.

### ≡ƒºá Root Cause
**Missing CHECK constraint on `products.inventory_count`.** Without `CHECK (inventory_count >= 0)`, the database treats `inventory_count` as a plain signed integer, ignoring business logic requirements for stock availability.

### ≡ƒ¢á∩╕Å Fix
*Note: We must first clean existing bad data before the constraint can be applied.*
```sql
-- Step 1: Cleanup
UPDATE products SET inventory_count = 0 WHERE inventory_count < 0;

-- Step 2: Apply Constraint
ALTER TABLE products 
ADD CONSTRAINT check_inventory_non_negative 
CHECK (inventory_count >= 0);
```

### Γ£à Validation
1. **Clean-run:** Reproduction query returns `0 rows`.
2. **Rejection check:** 
   ```sql
   UPDATE products SET inventory_count = -1 WHERE id = 1;
   -- Result: ERROR: new row for relation "products" violates check constraint "check_inventory_non_negative"
   ```

---

## Bug 3 ΓÇö Duplicate Payments (Revenue Attribution)

### ≡ƒÜ¿ Reproduction
Query to identify orders with multiple payment records:
```sql
SELECT order_id, COUNT(*) 
FROM payments 
GROUP BY order_id 
HAVING COUNT(*) > 1;
```
**Expected Output:** `order_id` values with `count` > 1.

### ≡ƒöÄ Data Flow Trace
The duplicate payment surfaces when `GET /orders/:id` fetches payment status. `SELECT * FROM payments WHERE order_id = $1` returns multiple rows (e.g., one 'pending' and one 'completed'). The application logic usually pulls the first record based on insertion order. If it pulls the 'pending' one, it mistakenly reports the order as "Unpaid" to the user, leading to customer support tickets and double-charging risks.

### ≡ƒºá Root Cause
**Missing UNIQUE constraint on `payments.order_id`.** The database was configured to allow an unlimited number of payment rows per order ID, violating the "One Order, One Payment" financial logic.

### ≡ƒ¢á∩╕Å Fix
```sql
-- Step 1: Remove pending duplicates, retaining successful ones
DELETE FROM payments 
WHERE id IN (
    SELECT id FROM payments 
    WHERE order_id IN (SELECT order_id FROM payments GROUP BY order_id HAVING COUNT(*) > 1) 
    AND status = 'pending'
);

-- Step 2: Apply constraint
ALTER TABLE payments 
ADD CONSTRAINT unique_payment_per_order 
UNIQUE (order_id);
```

### Γ£à Validation
1. **Clean-run:** Reproduction query returns `0 rows`.
2. **Rejection check:** 
   ```sql
   INSERT INTO payments (order_id, amount, status) VALUES (1, 50.00, 'pending');
   -- (Assuming order 1 already has a payment)
   -- Result: ERROR: duplicate key value violates unique constraint "unique_payment_per_order"
   ```
