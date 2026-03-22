-- PostgreSQL: run once against your QTrack DB if you are not using Alembic.
-- Example: psql -U postgres -d qtrack -f scripts/add_rack_and_issue_destination.sql
--
-- Prefer:  cd backend && alembic upgrade head

ALTER TABLE batches ADD COLUMN IF NOT EXISTS rack_number VARCHAR(80);
CREATE INDEX IF NOT EXISTS ix_batches_rack_number ON batches (rack_number);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS issued_to_product_name VARCHAR(200);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS issued_to_batch_ref VARCHAR(120);
