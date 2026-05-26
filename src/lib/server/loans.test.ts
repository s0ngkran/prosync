import { describe, it, expect } from 'vitest';
import {
	validateLoanApproval,
	computeLoanOverdueStatus,
	calculateRepayment
} from './loans';

describe('validateLoanApproval', () => {
	it('TAX_POOL: valid when balance >= amount', () => {
		const result = validateLoanApproval('TAX_POOL', 50000, 100000);
		expect(result.valid).toBe(true);
	});

	it('TAX_POOL: valid when balance equals amount exactly', () => {
		const result = validateLoanApproval('TAX_POOL', 50000, 50000);
		expect(result.valid).toBe(true);
	});

	it('TAX_POOL: invalid when balance < amount', () => {
		const result = validateLoanApproval('TAX_POOL', 50000, 30000);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('ไม่เพียงพอ');
	});

	it('TAX_POOL: invalid when bankBalance is null', () => {
		const result = validateLoanApproval('TAX_POOL', 50000, null);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('ไม่พบบัญชี');
	});

	it('TAX_POOL: invalid when bankBalance is undefined', () => {
		const result = validateLoanApproval('TAX_POOL', 50000);
		expect(result.valid).toBe(false);
	});

	it('INTER_AGENCY: always valid regardless of balance', () => {
		const result = validateLoanApproval('INTER_AGENCY', 50000);
		expect(result.valid).toBe(true);
	});

	it('INTER_AGENCY: valid even with zero balance', () => {
		const result = validateLoanApproval('INTER_AGENCY', 50000, 0);
		expect(result.valid).toBe(true);
	});
});

describe('computeLoanOverdueStatus', () => {
	const pastDate = '2024-01-01';
	const futureDate = '2099-12-31';

	it('returns OVERDUE for APPROVED loan with past due_date', () => {
		expect(computeLoanOverdueStatus('APPROVED', pastDate)).toBe('OVERDUE');
	});

	it('returns APPROVED for APPROVED loan with future due_date', () => {
		expect(computeLoanOverdueStatus('APPROVED', futureDate)).toBe('APPROVED');
	});

	it('returns APPROVED for APPROVED loan with null due_date', () => {
		expect(computeLoanOverdueStatus('APPROVED', null)).toBe('APPROVED');
	});

	it('returns APPROVED for APPROVED loan with undefined due_date', () => {
		expect(computeLoanOverdueStatus('APPROVED', undefined)).toBe('APPROVED');
	});

	it('does not override REPAID even with past due_date', () => {
		expect(computeLoanOverdueStatus('REPAID', pastDate)).toBe('REPAID');
	});

	it('does not override PENDING even with past due_date', () => {
		expect(computeLoanOverdueStatus('PENDING', pastDate)).toBe('PENDING');
	});

	it('does not override REJECTED even with past due_date', () => {
		expect(computeLoanOverdueStatus('REJECTED', pastDate)).toBe('REJECTED');
	});

	it('respects custom now parameter', () => {
		const dueDate = '2025-06-15';
		const beforeDue = new Date('2025-06-10');
		const afterDue = new Date('2025-06-20');
		expect(computeLoanOverdueStatus('APPROVED', dueDate, beforeDue)).toBe('APPROVED');
		expect(computeLoanOverdueStatus('APPROVED', dueDate, afterDue)).toBe('OVERDUE');
	});
});

describe('calculateRepayment', () => {
	it('handles partial repayment', () => {
		const result = calculateRepayment(0, 100000, 30000);
		expect(result.newRepaidAmount).toBe(30000);
		expect(result.fullyRepaid).toBe(false);
		expect(result.overpayment).toBe(false);
	});

	it('handles full repayment in one go', () => {
		const result = calculateRepayment(0, 100000, 100000);
		expect(result.newRepaidAmount).toBe(100000);
		expect(result.fullyRepaid).toBe(true);
		expect(result.overpayment).toBe(false);
	});

	it('handles full repayment after partial', () => {
		const result = calculateRepayment(70000, 100000, 30000);
		expect(result.newRepaidAmount).toBe(100000);
		expect(result.fullyRepaid).toBe(true);
		expect(result.overpayment).toBe(false);
	});

	it('detects overpayment and caps at loan amount', () => {
		const result = calculateRepayment(70000, 100000, 50000);
		expect(result.overpayment).toBe(true);
		expect(result.newRepaidAmount).toBe(100000);
		expect(result.fullyRepaid).toBe(true);
	});

	it('handles exact remaining amount', () => {
		const result = calculateRepayment(99999, 100000, 1);
		expect(result.newRepaidAmount).toBe(100000);
		expect(result.fullyRepaid).toBe(true);
		expect(result.overpayment).toBe(false);
	});

	it('handles small repayment on large loan', () => {
		const result = calculateRepayment(0, 1000000, 100);
		expect(result.newRepaidAmount).toBe(100);
		expect(result.fullyRepaid).toBe(false);
		expect(result.overpayment).toBe(false);
	});
});
