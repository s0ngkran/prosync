import { describe, it, expect } from 'vitest';
import {
	getStatusFlow,
	getNextStatus,
	isValidTransition,
	getActorForStatus,
	isMultiRoundType,
	calc90DayStatus
} from './payment-rounds';

describe('getStatusFlow', () => {
	it('returns correct flow for type1_nParcel', () => {
		const flow = getStatusFlow('type1_nParcel');
		expect(flow).toEqual([
			'BILL_PENDING', 'BILL_CREATED', 'SENT_TO_FINANCE',
			'FINANCE_SEEN', 'DIKA_CREATED', 'DIRECTOR_APPROVED', 'PAID', 'STAMPED'
		]);
	});

	it('returns flow without DIRECTOR_APPROVED for type2_iParcelUtil', () => {
		const flow = getStatusFlow('type2_iParcelUtil');
		expect(flow).not.toContain('DIRECTOR_APPROVED');
		expect(flow).toContain('PAID');
	});

	it('returns flow with DIRECTOR_APPROVED for type3_iParcel', () => {
		const flow = getStatusFlow('type3_iParcel');
		expect(flow).toContain('DIRECTOR_APPROVED');
	});

	it('returns short flow for type4_iFinance (no procurement steps)', () => {
		const flow = getStatusFlow('type4_iFinance');
		expect(flow[0]).toBe('DIKA_CREATED');
		expect(flow).not.toContain('BILL_PENDING');
		expect(flow).toContain('DIRECTOR_APPROVED');
	});

	it('falls back to type1 for unknown type', () => {
		const flow = getStatusFlow('unknown_type');
		expect(flow).toEqual(getStatusFlow('type1_nParcel'));
	});
});

describe('getNextStatus', () => {
	it('returns next status in flow', () => {
		expect(getNextStatus('type1_nParcel', 'BILL_PENDING')).toBe('BILL_CREATED');
		expect(getNextStatus('type1_nParcel', 'PAID')).toBe('STAMPED');
	});

	it('returns null for final status', () => {
		expect(getNextStatus('type1_nParcel', 'STAMPED')).toBeNull();
	});

	it('returns null for invalid status', () => {
		expect(getNextStatus('type1_nParcel', 'NONEXISTENT')).toBeNull();
	});

	it('skips DIRECTOR_APPROVED for type2', () => {
		expect(getNextStatus('type2_iParcelUtil', 'DIKA_CREATED')).toBe('PAID');
	});

	it('includes DIRECTOR_APPROVED for type3', () => {
		expect(getNextStatus('type3_iParcel', 'DIKA_CREATED')).toBe('DIRECTOR_APPROVED');
	});
});

describe('isValidTransition', () => {
	it('returns true for consecutive statuses', () => {
		expect(isValidTransition('type1_nParcel', 'BILL_PENDING', 'BILL_CREATED')).toBe(true);
		expect(isValidTransition('type1_nParcel', 'PAID', 'STAMPED')).toBe(true);
	});

	it('returns false for non-consecutive statuses', () => {
		expect(isValidTransition('type1_nParcel', 'BILL_PENDING', 'PAID')).toBe(false);
	});

	it('returns false for backwards transitions', () => {
		expect(isValidTransition('type1_nParcel', 'PAID', 'BILL_PENDING')).toBe(false);
	});

	it('returns false for same status', () => {
		expect(isValidTransition('type1_nParcel', 'PAID', 'PAID')).toBe(false);
	});
});

describe('getActorForStatus', () => {
	it('returns PROCUREMENT for bill-related statuses', () => {
		expect(getActorForStatus('BILL_PENDING')).toBe('PROCUREMENT');
		expect(getActorForStatus('BILL_CREATED')).toBe('PROCUREMENT');
		expect(getActorForStatus('SENT_TO_FINANCE')).toBe('PROCUREMENT');
	});

	it('returns FINANCE for finance-related statuses', () => {
		expect(getActorForStatus('FINANCE_SEEN')).toBe('FINANCE');
		expect(getActorForStatus('DIKA_CREATED')).toBe('FINANCE');
		expect(getActorForStatus('PAID')).toBe('FINANCE');
		expect(getActorForStatus('STAMPED')).toBe('FINANCE');
	});

	it('returns DIRECTOR for director approval', () => {
		expect(getActorForStatus('DIRECTOR_APPROVED')).toBe('DIRECTOR');
	});
});

describe('isMultiRoundType', () => {
	it('returns true for multi-round types', () => {
		expect(isMultiRoundType('type2_iParcelUtil')).toBe(true);
		expect(isMultiRoundType('type3_iParcel')).toBe(true);
		expect(isMultiRoundType('type4_iFinance')).toBe(true);
	});

	it('returns false for single-round types', () => {
		expect(isMultiRoundType('type1_nParcel')).toBe(false);
		expect(isMultiRoundType('type5_project')).toBe(false);
	});
});

describe('calc90DayStatus', () => {
	it('returns null when financeSeenAt is null', () => {
		expect(calc90DayStatus(null)).toBeNull();
	});

	it('calculates correct days remaining', () => {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const result = calc90DayStatus(thirtyDaysAgo);
		expect(result).not.toBeNull();
		expect(result!.daysElapsed).toBe(30);
		expect(result!.daysRemaining).toBe(60);
		expect(result!.isWarning).toBe(false);
		expect(result!.isOverdue).toBe(false);
	});

	it('flags warning when <= 15 days remaining', () => {
		const eightyDaysAgo = new Date();
		eightyDaysAgo.setDate(eightyDaysAgo.getDate() - 80);
		const result = calc90DayStatus(eightyDaysAgo);
		expect(result!.daysRemaining).toBe(10);
		expect(result!.isWarning).toBe(true);
		expect(result!.isOverdue).toBe(false);
	});

	it('flags overdue when > 90 days', () => {
		const hundredDaysAgo = new Date();
		hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
		const result = calc90DayStatus(hundredDaysAgo);
		expect(result!.daysRemaining).toBe(-10);
		expect(result!.isWarning).toBe(false);
		expect(result!.isOverdue).toBe(true);
	});

	it('accepts string dates', () => {
		const result = calc90DayStatus(new Date().toISOString());
		expect(result!.daysElapsed).toBe(0);
		expect(result!.daysRemaining).toBe(90);
	});
});
