-- ============================================================
-- Migration: Restructure Procurement Flow
-- 0008_restructure_procurement.sql
-- ============================================================

-- 1. Agency Settings (admin configures planning/procurement/finance units)
CREATE TABLE IF NOT EXISTS agency_settings (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id) UNIQUE,
    planning_unit_id INTEGER REFERENCES org_units(id),
    procurement_unit_id INTEGER REFERENCES org_units(id),
    finance_unit_id INTEGER REFERENCES org_units(id)
);

-- 2. New columns on documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS procurement_method VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE documents ALTER COLUMN workflow_id DROP NOT NULL;

-- Backfill existing documents
UPDATE documents SET phase = 'LEGACY' WHERE phase = 'LEGACY';

-- 3. Document Approval Steps (universal 5-step approval flow)
CREATE TABLE IF NOT EXISTS document_approval_steps (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    step_sequence INTEGER NOT NULL,
    step_code VARCHAR(50) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    assigned_user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    comment TEXT,
    attachment_urls JSONB,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_approval_doc ON document_approval_steps(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_approval_status ON document_approval_steps(document_id, status);

-- 4. Payment Rounds (execution phase — supports multi-round payments)
CREATE TABLE IF NOT EXISTS payment_rounds (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    round_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'BILL_PENDING',
    current_actor_role VARCHAR(30),

    -- Bill data
    bill_payload JSONB,
    bill_created_by INTEGER REFERENCES users(id),
    bill_created_at TIMESTAMPTZ,

    -- Finance tracking
    sent_to_finance_at TIMESTAMPTZ,
    finance_seen_at TIMESTAMPTZ,
    finance_seen_by INTEGER REFERENCES users(id),

    -- Dika
    dika_voucher_id INTEGER REFERENCES dika_vouchers(id),

    -- Payment
    check_no VARCHAR(50),
    check_date DATE,
    paid_at TIMESTAMPTZ,
    paid_by INTEGER REFERENCES users(id),

    -- Stamp money out
    stamped_at TIMESTAMPTZ,
    stamped_by INTEGER REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_payment_rounds_doc ON payment_rounds(document_id);
CREATE INDEX IF NOT EXISTS idx_payment_rounds_status ON payment_rounds(status);

-- 5. Project Items (type5 only)
CREATE TABLE IF NOT EXISTS project_items (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    estimated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    child_document_id INTEGER REFERENCES documents(id),
    loan_id INTEGER REFERENCES loans(id),
    return_amount NUMERIC(15,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_items_doc ON project_items(document_id);

-- 6. Modify dika_vouchers for payment rounds
ALTER TABLE dika_vouchers ADD COLUMN IF NOT EXISTS payment_round_id INTEGER REFERENCES payment_rounds(id);

-- Drop and recreate unique index to support multiple dikas per document (one per round)
DROP INDEX IF EXISTS idx_unique_active_dika;
CREATE UNIQUE INDEX idx_unique_active_dika_round
    ON dika_vouchers(document_id, payment_round_id)
    WHERE status NOT IN ('REJECTED', 'CANCELLED');
