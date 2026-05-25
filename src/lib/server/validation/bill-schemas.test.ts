import { describe, it, expect } from 'vitest';
import {
	billSpecificLte100k,
	billSpecificGt100k,
	billSelection,
	billEBidding,
	billEMarket,
	getBillSchema
} from './bill-schemas';
import { BILL_SECTION_LABELS } from '$lib/types/procurement';

describe('billSpecificLte100k schema', () => {
	it('validates a correct bill', () => {
		const data = {
			quotations: [{ vendor_id: 1, price: '50000' }],
			vendor_selection: { winner_vendor_id: 1 },
			inspection: {
				committee: [{ user_id: 1, role_in_committee: 'ประธาน' }]
			}
		};
		const result = billSpecificLte100k.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('fails when quotations are empty', () => {
		const data = {
			quotations: [],
			vendor_selection: { winner_vendor_id: 1 },
			inspection: { committee: [{ user_id: 1 }] }
		};
		const result = billSpecificLte100k.safeParse(data);
		expect(result.success).toBe(false);
	});

	it('fails when inspection committee is missing', () => {
		const data = {
			quotations: [{ vendor_id: 1, price: '50000' }],
			vendor_selection: { winner_vendor_id: 1 },
			inspection: { committee: [] }
		};
		const result = billSpecificLte100k.safeParse(data);
		expect(result.success).toBe(false);
	});
});

describe('billSpecificGt100k schema', () => {
	it('validates a complete bill with TOR and contract', () => {
		const data = {
			tor: {
				description: 'จัดซื้อครุภัณฑ์คอมพิวเตอร์',
				committee: [{ user_id: 1 }]
			},
			median_price: {
				committee: [{ user_id: 2 }]
			},
			quotations: [{ vendor_id: 1, price: '250000' }],
			vendor_selection: { winner_vendor_id: 1 },
			contract: { details: 'สัญญาซื้อขาย' },
			inspection: { committee: [{ user_id: 3 }] }
		};
		const result = billSpecificGt100k.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('fails when TOR description is empty', () => {
		const data = {
			tor: { description: '', committee: [{ user_id: 1 }] },
			median_price: { committee: [{ user_id: 2 }] },
			quotations: [{ vendor_id: 1, price: '250000' }],
			vendor_selection: { winner_vendor_id: 1 },
			contract: {},
			inspection: { committee: [{ user_id: 3 }] }
		};
		const result = billSpecificGt100k.safeParse(data);
		expect(result.success).toBe(false);
	});
});

describe('billEBidding schema', () => {
	it('validates complete e-bidding bill', () => {
		const data = {
			tor: { description: 'TOR', committee: [{ user_id: 1 }] },
			median_price: { committee: [{ user_id: 2 }] },
			announcement: {},
			procurement_committee: { committee: [{ user_id: 3 }] },
			vendor_proposals: [{ vendor_id: 1, price: '1000000' }],
			evaluation: {},
			winner_announcement: {},
			contract: {},
			inspection: { committee: [{ user_id: 4 }] }
		};
		const result = billEBidding.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('fails when vendor_proposals is empty', () => {
		const data = {
			tor: { description: 'TOR', committee: [{ user_id: 1 }] },
			median_price: { committee: [{ user_id: 2 }] },
			announcement: {},
			procurement_committee: { committee: [{ user_id: 3 }] },
			vendor_proposals: [],
			evaluation: {},
			winner_announcement: {},
			contract: {},
			inspection: { committee: [{ user_id: 4 }] }
		};
		const result = billEBidding.safeParse(data);
		expect(result.success).toBe(false);
	});
});

describe('billEMarket schema', () => {
	it('validates complete e-market bill', () => {
		const data = {
			tor: { description: 'TOR' },
			median_price: { committee: [{ user_id: 1 }] },
			e_catalog: { items: [{ name: 'ปากกา', quantity: 100, unit_price: '15' }] },
			evaluation: {},
			contract: {},
			inspection: { committee: [{ user_id: 2 }] }
		};
		const result = billEMarket.safeParse(data);
		expect(result.success).toBe(true);
	});

	it('fails when e_catalog items are empty', () => {
		const data = {
			tor: { description: 'TOR' },
			median_price: { committee: [{ user_id: 1 }] },
			e_catalog: { items: [] },
			evaluation: {},
			contract: {},
			inspection: { committee: [{ user_id: 2 }] }
		};
		const result = billEMarket.safeParse(data);
		expect(result.success).toBe(false);
	});
});

describe('getBillSchema', () => {
	it('returns correct schema for each method', () => {
		expect(getBillSchema('specific_lte100k')).toBe(billSpecificLte100k);
		expect(getBillSchema('specific_gt100k')).toBe(billSpecificGt100k);
		expect(getBillSchema('selection')).toBe(billSelection);
		expect(getBillSchema('e_bidding')).toBe(billEBidding);
		expect(getBillSchema('e_market')).toBe(billEMarket);
	});

	it('returns null for unknown method', () => {
		expect(getBillSchema('unknown')).toBeNull();
	});
});

describe('BILL_SECTION_LABELS', () => {
	it('has labels for all 5 procurement methods', () => {
		expect(Object.keys(BILL_SECTION_LABELS)).toHaveLength(5);
		expect(BILL_SECTION_LABELS.specific_lte100k).toBeDefined();
		expect(BILL_SECTION_LABELS.specific_gt100k).toBeDefined();
		expect(BILL_SECTION_LABELS.selection).toBeDefined();
		expect(BILL_SECTION_LABELS.e_bidding).toBeDefined();
		expect(BILL_SECTION_LABELS.e_market).toBeDefined();
	});

	it('e_bidding has the most sections', () => {
		const eBiddingSections = Object.keys(BILL_SECTION_LABELS.e_bidding).length;
		const lte100kSections = Object.keys(BILL_SECTION_LABELS.specific_lte100k).length;
		expect(eBiddingSections).toBeGreaterThan(lte100kSections);
	});

	it('all methods have inspection section', () => {
		for (const method of Object.keys(BILL_SECTION_LABELS)) {
			expect(BILL_SECTION_LABELS[method].inspection).toBeDefined();
		}
	});
});
