import { describe, it, expect } from 'vitest';
import {
	createLoanSchema,
	approveLoanSchema,
	repayLoanSchema
} from './schemas';

describe('createLoanSchema', () => {
	it('validates a valid TAX_POOL loan', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			source_bank_account_id: '5',
			amount: '50000',
			purpose: 'ยืมเงินภาษีเพื่อสำรองจ่าย'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('validates a valid INTER_AGENCY loan', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'INTER_AGENCY',
			lender_agency_id: '2',
			amount: '100000',
			purpose: 'ยืมเงินข้ามหน่วยงาน'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('fails INTER_AGENCY without lender_agency_id', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'INTER_AGENCY',
			amount: '100000',
			purpose: 'ยืมเงินข้ามหน่วยงาน'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('fails without purpose', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			amount: '50000',
			purpose: ''
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('fails with zero amount', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			amount: '0',
			purpose: 'test'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('fails with negative amount', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			amount: '-1000',
			purpose: 'test'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('fails with invalid loan_type', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'INVALID',
			amount: '50000',
			purpose: 'test'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('accepts optional due_date', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			amount: '50000',
			purpose: 'test',
			due_date: '2025-12-31'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('accepts without due_date', () => {
		const data = {
			borrower_agency_id: '1',
			loan_type: 'TAX_POOL',
			amount: '50000',
			purpose: 'test'
		};
		const result = createLoanSchema.safeParse(data);
		expect(result.success).toBe(true);
	});
});

describe('approveLoanSchema', () => {
	it('validates APPROVED action', () => {
		const result = approveLoanSchema.safeParse({ loan_id: '1', action: 'APPROVED' });
		expect(result.success).toBe(true);
	});

	it('validates REJECTED action', () => {
		const result = approveLoanSchema.safeParse({ loan_id: '1', action: 'REJECTED' });
		expect(result.success).toBe(true);
	});

	it('fails with invalid action', () => {
		const result = approveLoanSchema.safeParse({ loan_id: '1', action: 'INVALID' });
		expect(result.success).toBe(false);
	});

	it('fails without loan_id', () => {
		const result = approveLoanSchema.safeParse({ action: 'APPROVED' });
		expect(result.success).toBe(false);
	});
});

describe('repayLoanSchema', () => {
	it('validates positive repay_amount', () => {
		const result = repayLoanSchema.safeParse({ loan_id: '1', repay_amount: '5000' });
		expect(result.success).toBe(true);
	});

	it('fails with zero repay_amount', () => {
		const result = repayLoanSchema.safeParse({ loan_id: '1', repay_amount: '0' });
		expect(result.success).toBe(false);
	});

	it('fails with negative repay_amount', () => {
		const result = repayLoanSchema.safeParse({ loan_id: '1', repay_amount: '-100' });
		expect(result.success).toBe(false);
	});

	it('accepts decimal amounts', () => {
		const result = repayLoanSchema.safeParse({ loan_id: '1', repay_amount: '1234.56' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.repay_amount).toBeCloseTo(1234.56);
		}
	});
});
