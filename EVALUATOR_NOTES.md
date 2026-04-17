# OrderFlow Solution: Evaluator Notes

**Challenge 3.15 ΓÇö Debugging Production Database Failures**

---

### Criteria 1: DEBUG-REPORT.md with Reproductions
**Description:** Use of SQL queries to explicitly demonstrate the existence of all three bugs.

- **Full-Marks Example:** "Reproduction query for Bug 1: `SELECT * FROM orders LEFT JOIN customers ON orders.customer_id = customers.id WHERE customers.id IS NULL;` shows orphaned rows like customer_id 9999."
- **Common Partial-Credit Mistake:** Describing the bug in plain English without providing the SQL reproduction query.
- **Surface vs. Architecture Check:** Does the reproduction verify the specific symptom? A real responder writes a query that targets the integrity failure (e.g., searching for the NULL join or the negative value).

---

### Criteria 2: Root Cause Precision
**Description:** Technical accuracy in identifying exactly which database constraint was missing.

- **Full-Marks Example:** "Root cause for Bug 2: Missing CHECK constraint on `products.inventory_count`. Without `CHECK (inventory_count >= 0)`, the database has no mechanism to block numerical underflow during UPDATE operations."
- **Common Partial-Credit Mistake:** Blaming the application code ("The route didn't check") while ignoring the fact that the database is the final source of truth and should enforce these rules at the schema level.
- **Surface vs. Architecture Check:** Does the report name the specific constraint type (`FOREIGN KEY`, `CHECK`, `UNIQUE`)? Using generic terms like "the link was broken" suggests non-architectural thinking.

---

### Criteria 3: Fix Correctness (Named Constraints)
**Description:** Applying the correct DDL with named constraints that the database will enforce.

- **Full-Marks Example:** Using `ALTER TABLE payments ADD CONSTRAINT unique_payment_per_order UNIQUE (order_id);` (A named constraint is easier to manage, audit, and troubleshoot).
- **Common Partial-Credit Mistake:** Trying to apply a `CHECK` or `UNIQUE` constraint without cleaning existing bad data first. SQL will fail to apply these constraints if violations already exist.
- **Surface vs. Architecture Check:** Does the fix include the "Step 0" data cleanup phase (e.g., zeroing negative inventory or deleting duplicate payments)? If not, the submission would fail in a real production environment.

---

### Criteria 4: Validation Completeness
**Description:** Re-confirming the fix with both successful queries and "expected failures" on bad data.

- **Full-Marks Example:** "Validation: Attempting `INSERT INTO payments (...)` for an order that already has a payment returns a `UNIQUE violation`. AND re-running the duplicate search query returns 0 rows."
- **Common Partial-Credit Mistake:** Only verifying that "the error is gone" but not confirming that "new bad data is correctly rejected" with an explicit `INSERT` or `UPDATE` test.
- **Surface vs. Architecture Check:** Does the validation include the specific PostgreSQL error message returned? Including the error output shows the tester actually ran the DDL and verified the rejection.
