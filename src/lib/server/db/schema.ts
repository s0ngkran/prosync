import {
	pgTable,
	serial,
	integer,
	numeric,
	varchar,
	boolean,
	text,
	jsonb,
	timestamp,
	date,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ──────────────────────────────────────────────
// Master & Multi-Tenant
// ──────────────────────────────────────────────

export const provinces = pgTable('provinces', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull()
});

export const agencies = pgTable('agencies', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 }).notNull(),
	agency_type: varchar('agency_type', { length: 50 }),
	province_id: integer('province_id')
		.notNull()
		.references(() => provinces.id)
});

export const medianPriceCategories = pgTable('median_price_categories', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull()
});

export const medianPriceUnits = pgTable('median_price_units', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 50 }).notNull()
});

export const medianPrices = pgTable('median_prices', {
	id: serial('id').primaryKey(),
	category_id: integer('category_id')
		.notNull()
		.references(() => medianPriceCategories.id),
	item_name: varchar('item_name', { length: 255 }).notNull(),
	unit_id: integer('unit_id').references(() => medianPriceUnits.id),
	price: numeric('price', { precision: 15, scale: 2 }).notNull(),
	province_id: integer('province_id')
		.notNull()
		.references(() => provinces.id),
	effective_date: date('effective_date').notNull()
});

// ──────────────────────────────────────────────
// Organization & IAM
// ──────────────────────────────────────────────

export const hireTypes = pgTable('hire_types', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull()
});

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	prefix: varchar('prefix', { length: 50 }),
	name: varchar('name', { length: 255 }).notNull(),
	birth: timestamp('birth', { withTimezone: true }),
	hire_date: timestamp('hire_date', { withTimezone: true }),
	hire_type_id: integer('hire_type_id').references(() => hireTypes.id),
	password_hash: varchar('password_hash', { length: 255 }).notNull(),
	agency_id: integer('agency_id').references(() => agencies.id),
	id_card: varchar('id_card', { length: 13 }).notNull().unique(),
	position: varchar('position', { length: 50 }),
	position_rank: varchar('position_rank', { length: 255 }),
	division_id: integer('division_id'),
	email: varchar('email', { length: 255 }),
	phone: varchar('phone', { length: 20 }),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	is_super_admin: boolean('is_super_admin').notNull().default(false),
	must_change_password: boolean('must_change_password').notNull().default(true),
	profile_completed: boolean('profile_completed').notNull().default(false),
	profile_picture: text('profile_picture'),
	deleted_at: timestamp('deleted_at', { withTimezone: true }),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const orgUnits = pgTable('org_units', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	name: varchar('name', { length: 255 }).notNull(),
	parent_id: integer('parent_id'),
	head_of_unit_id: integer('head_of_unit_id').references(() => users.id)
});

export const roles = pgTable('roles', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull(),
	permissions: jsonb('permissions').notNull()
});

export const userAssignments = pgTable('user_assignments', {
	id: serial('id').primaryKey(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	role_id: integer('role_id')
		.notNull()
		.references(() => roles.id),
	org_unit_id: integer('org_unit_id')
		.notNull()
		.references(() => orgUnits.id),
	is_primary_unit: boolean('is_primary_unit').notNull().default(false)
});

// ──────────────────────────────────────────────
// Bank, Tax & Cashflow
// ──────────────────────────────────────────────

export const bank = pgTable('bank', {
	id: serial('id').primaryKey(),
	bank_code: varchar('bank_code', { length: 20 }).notNull().unique(),
	name: varchar('name', { length: 255 }).notNull(),
	logo_url: text('logo_url')
});

export const bankAccounts = pgTable('bank_accounts', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	bank_id: integer('bank_id')
		.notNull()
		.references(() => bank.id),
	account_name: varchar('account_name', { length: 255 }).notNull(),
	account_number: varchar('account_number', { length: 50 }).notNull(),
	balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
	is_tax_pool: boolean('is_tax_pool').notNull().default(false)
});

// ──────────────────────────────────────────────
// Planning & Rollup
// ──────────────────────────────────────────────

export const fiscalYears = pgTable('fiscal_years', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	year_name: varchar('year_name', { length: 4 }).notNull(),
	is_active: boolean('is_active').notNull().default(true),
	total_estimated_income: numeric('total_estimated_income', { precision: 15, scale: 2 })
		.notNull()
		.default('0'),
	total_estimated_expense: numeric('total_estimated_expense', { precision: 15, scale: 2 })
		.notNull()
		.default('0'),
	total_actual_income: numeric('total_actual_income', { precision: 15, scale: 2 })
		.notNull()
		.default('0'),
	total_actual_expense: numeric('total_actual_expense', { precision: 15, scale: 2 })
		.notNull()
		.default('0')
});

export const plans = pgTable('plans', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	fiscal_year_id: integer('fiscal_year_id')
		.notNull()
		.references(() => fiscalYears.id),
	title: varchar('title', { length: 255 }).notNull(),
	parent_id: integer('parent_id'),
	responsible_unit_id: integer('responsible_unit_id').references(() => orgUnits.id),
	start_date: date('start_date'),
	end_date: date('end_date'),
	duration_text: varchar('duration_text', { length: 100 }),
	expected_outputs: jsonb('expected_outputs'),
	description: text('description'),
	stakeholder_unit_ids: jsonb('stakeholder_unit_ids'),
	is_leaf_node: boolean('is_leaf_node').notNull().default(false),
	plan_type: varchar('plan_type', { length: 20 }).notNull(), // INCOME / EXPENSE
	estimated_amount: numeric('estimated_amount', { precision: 15, scale: 2 })
		.notNull()
		.default('0'),
	actual_amount: numeric('actual_amount', { precision: 15, scale: 2 }).notNull().default('0')
});

// ──────────────────────────────────────────────
// Workflow & Dika
// ──────────────────────────────────────────────

export const workflows = pgTable('workflows', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull(),
	total_steps: integer('total_steps').notNull(),
	agency_id: integer('agency_id').references(() => agencies.id)
});

export const workflowSteps = pgTable('workflow_steps', {
	id: serial('id').primaryKey(),
	workflow_id: integer('workflow_id')
		.notNull()
		.references(() => workflows.id),
	step_sequence: integer('step_sequence').notNull(),
	step_name: varchar('step_name', { length: 255 }).notNull(),
	ui_schema: jsonb('ui_schema'),
	required_pdfs: jsonb('required_pdfs'),
	approver_role: varchar('approver_role', { length: 50 }),
	is_final_step: boolean('is_final_step').notNull().default(false),
	step_assignees: jsonb('step_assignees')
});

export const vendors = pgTable('vendors', {
	id: serial('id').primaryKey(),
	vendor_type: varchar('vendor_type', { length: 100 }),
	tax_id: varchar('tax_id', { length: 13 }).notNull().unique(),
	company_name: varchar('company_name', { length: 255 }).notNull(),
	contact_person: varchar('contact_person', { length: 255 }),
	contact_email: varchar('contact_email', { length: 255 }),
	contact_phone: varchar('contact_phone', { length: 20 })
});

export const documents = pgTable('documents', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	workflow_id: integer('workflow_id')
		.notNull()
		.references(() => workflows.id),
	plan_id: integer('plan_id')
		.notNull()
		.references(() => plans.id),
	current_step_id: integer('current_step_id'),
	payload: jsonb('payload').default({}),
	status: varchar('status', { length: 50 }).notNull().default('IN_PROGRESS'),
	updated_by: integer('updated_by').references(() => users.id)
});

export const documentCommittees = pgTable('document_committees', {
	id: serial('id').primaryKey(),
	document_id: integer('document_id')
		.notNull()
		.references(() => documents.id),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	committee_type: varchar('committee_type', { length: 50 }).notNull(),
	role_in_committee: varchar('role_in_committee', { length: 100 })
});

export const documentBidders = pgTable('document_bidders', {
	id: serial('id').primaryKey(),
	document_id: integer('document_id')
		.notNull()
		.references(() => documents.id),
	vendor_id: integer('vendor_id')
		.notNull()
		.references(() => vendors.id),
	proposal_pdf_url: text('proposal_pdf_url'),
	proposed_price: numeric('proposed_price', { precision: 15, scale: 2 }),
	score: numeric('score', { precision: 5, scale: 2 }),
	is_winner: boolean('is_winner').notNull().default(false),
	submitted_at: timestamp('submitted_at', { withTimezone: true })
});

export const approvals = pgTable('approvals', {
	id: serial('id').primaryKey(),
	document_id: integer('document_id')
		.notNull()
		.references(() => documents.id),
	step_id: integer('step_id')
		.notNull()
		.references(() => workflowSteps.id),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	action: varchar('action', { length: 20 }).notNull(), // APPROVED / REJECTED
	comment: text('comment'),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ──────────────────────────────────────────────
// Notifications & Task Assignments
// ──────────────────────────────────────────────

export const notifications = pgTable('notifications', {
	id: serial('id').primaryKey(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	document_id: integer('document_id').references(() => documents.id),
	step_id: integer('step_id').references(() => workflowSteps.id),
	title: varchar('title', { length: 255 }).notNull(),
	message: text('message').notNull(),
	action_url: varchar('action_url', { length: 500 }),
	notification_type: varchar('notification_type', { length: 50 }).notNull(),
	is_read: boolean('is_read').notNull().default(false),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const documentStepAssignments = pgTable('document_step_assignments', {
	id: serial('id').primaryKey(),
	document_id: integer('document_id')
		.notNull()
		.references(() => documents.id),
	step_id: integer('step_id')
		.notNull()
		.references(() => workflowSteps.id),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	assignment_type: varchar('assignment_type', { length: 50 }).notNull(),
	is_completed: boolean('is_completed').notNull().default(false),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const dikaVouchers = pgTable(
	'dika_vouchers',
	{
		id: serial('id').primaryKey(),
		agency_id: integer('agency_id')
			.notNull()
			.references(() => agencies.id),
		document_id: integer('document_id')
			.notNull()
			.references(() => documents.id),
		vendor_id: integer('vendor_id')
			.notNull()
			.references(() => vendors.id),
		plan_id: integer('plan_id')
			.notNull()
			.references(() => plans.id),
		payment_bank_account_id: integer('payment_bank_account_id')
			.notNull()
			.references(() => bankAccounts.id),
		tax_pool_account_id: integer('tax_pool_account_id').references(() => bankAccounts.id),
		gross_amount: numeric('gross_amount', { precision: 15, scale: 2 }).notNull(),
		fine_amount: numeric('fine_amount', { precision: 15, scale: 2 }).notNull().default('0'),
		tax_amount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
		net_amount: numeric('net_amount', { precision: 15, scale: 2 }).notNull(),
		status: varchar('status', { length: 50 }).notNull().default('PENDING_EXAMINE'),
		examiner_id: integer('examiner_id').references(() => users.id),
		director_id: integer('director_id').references(() => users.id)
	},
	(table) => ({
		uniqueActiveDika: uniqueIndex('idx_unique_active_dika')
			.on(table.document_id)
			.where(sql`status NOT IN ('REJECTED', 'CANCELLED')`)
	})
);

export const bankTransactions = pgTable('bank_transactions', {
	id: serial('id').primaryKey(),
	bank_account_id: integer('bank_account_id')
		.notNull()
		.references(() => bankAccounts.id),
	transaction_type: varchar('transaction_type', { length: 50 }).notNull(),
	amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
	plan_id: integer('plan_id').references(() => plans.id),
	dika_voucher_id: integer('dika_voucher_id').references(() => dikaVouchers.id),
	action_by_user_id: integer('action_by_user_id').references(() => users.id),
	tags: jsonb('tags'),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const taxTransactions = pgTable('tax_transactions', {
	id: serial('id').primaryKey(),
	agency_id: integer('agency_id')
		.notNull()
		.references(() => agencies.id),
	dika_voucher_id: integer('dika_voucher_id')
		.notNull()
		.references(() => dikaVouchers.id),
	vendor_id: integer('vendor_id')
		.notNull()
		.references(() => vendors.id),
	tax_id: varchar('tax_id', { length: 13 }).notNull(),
	tax_rate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(),
	tax_base_amount: numeric('tax_base_amount', { precision: 15, scale: 2 }).notNull(),
	tax_amount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull(),
	tax_form_type: varchar('tax_form_type', { length: 50 }),
	status: varchar('status', { length: 50 }).notNull().default('WITHHELD')
});

// ──────────────────────────────────────────────
// Loans (ยืมเงิน)
// ──────────────────────────────────────────────

export const loans = pgTable('loans', {
	id: serial('id').primaryKey(),
	borrower_agency_id: integer('borrower_agency_id')
		.notNull()
		.references(() => agencies.id),
	loan_type: varchar('loan_type', { length: 50 }).notNull(), // 'TAX_POOL' | 'INTER_AGENCY'
	lender_agency_id: integer('lender_agency_id').references(() => agencies.id), // null for TAX_POOL
	source_bank_account_id: integer('source_bank_account_id').references(() => bankAccounts.id), // tax pool account
	amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
	repaid_amount: numeric('repaid_amount', { precision: 15, scale: 2 }).notNull().default('0'),
	purpose: text('purpose').notNull(),
	due_date: date('due_date'),
	status: varchar('status', { length: 50 }).notNull().default('PENDING'), // PENDING | APPROVED | REPAID | OVERDUE | REJECTED
	requested_by_user_id: integer('requested_by_user_id').references(() => users.id),
	approved_by_user_id: integer('approved_by_user_id').references(() => users.id),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	approved_at: timestamp('approved_at', { withTimezone: true }),
	repaid_at: timestamp('repaid_at', { withTimezone: true })
});
