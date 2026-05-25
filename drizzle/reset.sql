-- ══════════════════════════════════════════════
-- Reset: Drop all tables and triggers (in FK order)
-- Then db:push + db:custom will recreate everything
-- ══════════════════════════════════════════════

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_handle_bank_transaction ON bank_transactions;
DROP TRIGGER IF EXISTS trigger_rollup_plan_budget ON plans;
DROP TRIGGER IF EXISTS trigger_rollup_plan_budget_insert ON plans;
DROP TRIGGER IF EXISTS trigger_rollup_plan_budget_update ON plans;
DROP TRIGGER IF EXISTS trigger_rollup_plan_budget_delete ON plans;
DROP FUNCTION IF EXISTS handle_bank_transaction();
DROP FUNCTION IF EXISTS rollup_plan_budget();

-- Drop tables in reverse FK dependency order
DROP TABLE IF EXISTS project_items CASCADE;
DROP TABLE IF EXISTS payment_rounds CASCADE;
DROP TABLE IF EXISTS document_approval_steps CASCADE;
DROP TABLE IF EXISTS agency_settings CASCADE;
DROP TABLE IF EXISTS tax_transactions CASCADE;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS dika_vouchers CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS document_step_assignments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS document_bidders CASCADE;
DROP TABLE IF EXISTS document_committees CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS workflow_steps CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS fiscal_years CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS bank CASCADE;
DROP TABLE IF EXISTS user_assignments CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS org_units CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS median_prices CASCADE;
DROP TABLE IF EXISTS agencies CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;
