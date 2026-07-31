-- AVA MY POS product unit diagnostics/backfill helpers.
-- Replace :working_product_id and :broken_product_id before running.

-- 1) Compare products, product_units, and favorite_items for one working
-- multi-unit product and one broken single-unit product.
SELECT
  'product' AS source,
  p.id AS product_id,
  p.product_name,
  p.barcode,
  p.unit_id,
  p.unit_code,
  p.sale_price,
  p.status
FROM products p
WHERE p.id IN (:working_product_id, :broken_product_id);

SELECT
  'product_unit' AS source,
  pu.id AS product_unit_id,
  pu.product_id,
  pu.unit_id,
  pu.barcode,
  pu.conversion_to_base,
  pu.sale_price,
  pu.is_base,
  pu.is_active,
  pu.sort_order
FROM product_units pu
WHERE pu.product_id IN (:working_product_id, :broken_product_id)
ORDER BY pu.product_id, pu.is_base DESC, pu.sort_order, pu.id;

SELECT
  'favorite_item' AS source,
  fi.id AS favorite_item_id,
  fi.product_id,
  fi.product_unit_id,
  fi.group_id,
  fi.favorite_group_id
FROM favorite_items fi
WHERE fi.product_id IN (:working_product_id, :broken_product_id)
ORDER BY fi.product_id, fi.id;

-- 2) Products with no selling units at all.
SELECT
  p.id,
  p.product_name,
  p.barcode,
  p.unit_id,
  p.unit_code,
  p.sale_price
FROM products p
LEFT JOIN product_units pu ON pu.product_id = p.id
WHERE pu.id IS NULL
ORDER BY p.id;

-- 3) Products with no base product unit.
SELECT
  p.id,
  p.product_name,
  COUNT(pu.id) AS product_unit_count
FROM products p
LEFT JOIN product_units pu ON pu.product_id = p.id
LEFT JOIN product_units base_pu
  ON base_pu.product_id = p.id
 AND base_pu.is_base = TRUE
WHERE base_pu.id IS NULL
GROUP BY p.id, p.product_name
ORDER BY p.id;

-- 4) Products with more than one base product unit.
SELECT
  pu.product_id,
  COUNT(*) AS base_unit_count
FROM product_units pu
WHERE pu.is_base = TRUE
GROUP BY pu.product_id
HAVING COUNT(*) > 1
ORDER BY pu.product_id;

-- 5) Favorite rows whose saved product_unit_id is missing or belongs to another product.
SELECT
  fi.id AS favorite_item_id,
  fi.product_id,
  fi.product_unit_id
FROM favorite_items fi
LEFT JOIN product_units pu
  ON pu.id = fi.product_unit_id
 AND pu.product_id = fi.product_id
WHERE fi.product_unit_id IS NOT NULL
  AND pu.id IS NULL
ORDER BY fi.id;

-- 6) Backfill base product units for old products that still only have products.unit_id.
-- Review the SELECT above first. Run inside a transaction.
BEGIN;

INSERT INTO product_units (
  product_id,
  unit_id,
  barcode,
  conversion_to_base,
  sale_price,
  cost_price,
  is_base,
  is_active,
  sort_order
)
SELECT
  p.id,
  p.unit_id,
  p.barcode,
  1,
  COALESCE(p.sale_price, 0),
  COALESCE(p.cost_price, 0),
  TRUE,
  TRUE,
  1
FROM products p
WHERE p.unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_units pu
    WHERE pu.product_id = p.id
  );

-- 7) Optional: backfill favorite_items.product_unit_id to the base unit.
-- Only run if the column exists in your database.
UPDATE favorite_items fi
SET product_unit_id = pu.id
FROM product_units pu
WHERE pu.product_id = fi.product_id
  AND pu.is_base = TRUE
  AND fi.product_unit_id IS NULL;

COMMIT;
