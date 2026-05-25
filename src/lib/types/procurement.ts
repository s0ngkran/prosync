// Shared procurement types and constants (safe to use on client + server)
// อ้างอิง: พ.ร.บ.จัดซื้อจัดจ้างฯ 2560 + ระเบียบกระทรวงการคลังฯ 2560

export const DOC_TYPES = ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel', 'type4_iFinance', 'type5_project'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const PROCUREMENT_METHODS = ['specific_lte100k', 'specific_gt100k', 'selection', 'e_bidding', 'e_market'] as const;
export type ProcurementMethod = (typeof PROCUREMENT_METHODS)[number];

// ═══════════════════════════════════════════════════════════════════
// Section definitions per procurement method
// แต่ละ section กำหนดว่าต้องรับข้อมูลประเภทใดบ้าง
// ═══════════════════════════════════════════════════════════════════

export type SectionFieldType = 'pdf' | 'committee' | 'vendors' | 'text' | 'date_range' | 'items';

export interface BillSectionDef {
	label: string;
	description: string;
	legalRef: string; // อ้างอิงกฎหมาย
	fields: {
		key: string;
		label: string;
		type: SectionFieldType;
		required: boolean;
		description?: string;
	}[];
}

// ─── วิธีเฉพาะเจาะจง ≤100,000 (ม.56(2)(ค), ข้อ 79-82) ───
const SPECIFIC_LTE100K_SECTIONS: Record<string, BillSectionDef> = {
	purchase_request: {
		label: 'รายงานขอซื้อขอจ้าง',
		description: 'บันทึกขออนุมัติจัดซื้อจัดจ้าง เสนอหัวหน้าหน่วยงาน',
		legalRef: 'ข้อ 22',
		fields: [
			{ key: 'report_pdf', label: 'บันทึกรายงานขอซื้อขอจ้าง', type: 'pdf', required: true },
		]
	},
	quotation: {
		label: 'ใบเสนอราคา',
		description: 'ใบเสนอราคาจากผู้ขาย อย่างน้อย 1 ราย',
		legalRef: 'ข้อ 79',
		fields: [
			{ key: 'vendors', label: 'ผู้เสนอราคา + จำนวนเงิน', type: 'vendors', required: true },
		]
	},
	approval: {
		label: 'อนุมัติสั่งซื้อ/สั่งจ้าง',
		description: 'หัวหน้าหน่วยงานอนุมัติผลการพิจารณาและสั่งซื้อ/จ้าง',
		legalRef: 'ข้อ 80',
		fields: [
			{ key: 'approval_pdf', label: 'เอกสารอนุมัติ', type: 'pdf', required: false },
		]
	},
	winner_announcement: {
		label: 'ประกาศผู้ชนะการเสนอราคา',
		description: 'ประกาศผลในระบบ e-GP ตาม ม.66',
		legalRef: 'ม.66',
		fields: [
			{ key: 'announcement_pdf', label: 'ประกาศผู้ชนะ', type: 'pdf', required: true },
		]
	},
	purchase_order: {
		label: 'ใบสั่งซื้อ/สั่งจ้าง',
		description: 'ใบสั่งซื้อ (≤500,000 บาท ใช้ใบสั่งซื้อแทนสัญญาได้)',
		legalRef: 'ข้อ 162',
		fields: [
			{ key: 'po_pdf', label: 'ใบสั่งซื้อ/สั่งจ้าง', type: 'pdf', required: true },
		]
	},
	inspection_committee: {
		label: 'คณะกรรมการตรวจรับพัสดุ',
		description: 'แต่งตั้งคณะกรรมการตรวจรับ ≥3 คน (ม.100, ข้อ 175-176)',
		legalRef: 'ม.100, ข้อ 175',
		fields: [
			{ key: 'committee', label: 'รายชื่อคณะกรรมการ', type: 'committee', required: true },
			{ key: 'appointment_pdf', label: 'คำสั่งแต่งตั้ง', type: 'pdf', required: false },
		]
	},
	inspection_report: {
		label: 'ตรวจรับพัสดุ',
		description: 'ใบตรวจรับพัสดุ + ใบแจ้งหนี้/Invoice',
		legalRef: 'ข้อ 175(1)',
		fields: [
			{ key: 'inspection_pdf', label: 'ใบตรวจรับพัสดุ', type: 'pdf', required: true },
			{ key: 'invoice_pdf', label: 'ใบแจ้งหนี้/Invoice', type: 'pdf', required: true },
		]
	}
};

// ─── วิธีเฉพาะเจาะจง >100,000 (ม.56(2)(ค), ข้อ 79-82) ───
const SPECIFIC_GT100K_SECTIONS: Record<string, BillSectionDef> = {
	tor: {
		label: 'ขอบเขตงาน (TOR)',
		description: 'จัดทำร่างขอบเขตของงาน/รายละเอียดคุณลักษณะ อาจตั้งกรรมการจัดทำ TOR',
		legalRef: 'ม.9, ข้อ 21',
		fields: [
			{ key: 'tor_pdf', label: 'เอกสาร TOR', type: 'pdf', required: true },
			{ key: 'tor_committee', label: 'กรรมการจัดทำ TOR', type: 'committee', required: false, description: '≥3 คน (ถ้ามี)' },
		]
	},
	median_price: {
		label: 'ราคากลาง',
		description: 'จัดทำราคากลาง ตั้งคณะกรรมการกำหนดราคากลาง ≥3 คน',
		legalRef: 'ม.4, กฎกระทรวง ม.34',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการราคากลาง', type: 'committee', required: true, description: '≥3 คน' },
			{ key: 'report_pdf', label: 'รายงานราคากลาง', type: 'pdf', required: true },
		]
	},
	purchase_request: {
		label: 'รายงานขอซื้อขอจ้าง',
		description: 'บันทึกขออนุมัติพร้อมแนบ TOR และราคากลาง',
		legalRef: 'ข้อ 22',
		fields: [
			{ key: 'report_pdf', label: 'รายงานขอซื้อขอจ้าง', type: 'pdf', required: true },
		]
	},
	quotation: {
		label: 'ใบเสนอราคา',
		description: 'ใบเสนอราคาจากผู้ขาย',
		legalRef: 'ข้อ 79',
		fields: [
			{ key: 'vendors', label: 'ผู้เสนอราคา + จำนวนเงิน', type: 'vendors', required: true },
		]
	},
	winner_announcement: {
		label: 'ประกาศผู้ชนะการเสนอราคา',
		description: 'ประกาศผลในระบบ e-GP',
		legalRef: 'ม.66',
		fields: [
			{ key: 'announcement_pdf', label: 'ประกาศผู้ชนะ', type: 'pdf', required: true },
		]
	},
	contract: {
		label: 'สัญญา',
		description: 'จัดทำสัญญา (>500,000 บาท) หรือใบสั่งซื้อ (≤500,000 บาท)',
		legalRef: 'ข้อ 162-168',
		fields: [
			{ key: 'contract_pdf', label: 'สัญญา/ใบสั่งซื้อ', type: 'pdf', required: true },
			{ key: 'details', label: 'รายละเอียดสัญญา', type: 'text', required: false },
		]
	},
	inspection_committee: {
		label: 'คณะกรรมการตรวจรับพัสดุ',
		description: 'แต่งตั้งคณะกรรมการตรวจรับ ≥3 คน',
		legalRef: 'ม.100, ข้อ 175',
		fields: [
			{ key: 'committee', label: 'รายชื่อคณะกรรมการ', type: 'committee', required: true },
			{ key: 'appointment_pdf', label: 'คำสั่งแต่งตั้ง', type: 'pdf', required: false },
		]
	},
	inspection_report: {
		label: 'ตรวจรับพัสดุ',
		description: 'ใบตรวจรับพัสดุ + ใบแจ้งหนี้/Invoice',
		legalRef: 'ข้อ 175(1)',
		fields: [
			{ key: 'inspection_pdf', label: 'ใบตรวจรับพัสดุ', type: 'pdf', required: true },
			{ key: 'invoice_pdf', label: 'ใบแจ้งหนี้/Invoice', type: 'pdf', required: true },
		]
	}
};

// ─── วิธีคัดเลือก (ม.56(1)(ค), ข้อ 75-78) ───
const SELECTION_SECTIONS: Record<string, BillSectionDef> = {
	tor: {
		label: 'ขอบเขตงาน (TOR)',
		description: 'จัดทำ TOR + ตั้งคณะกรรมการจัดทำ TOR ≥3 คน',
		legalRef: 'ม.9, ข้อ 21',
		fields: [
			{ key: 'tor_pdf', label: 'เอกสาร TOR', type: 'pdf', required: true },
			{ key: 'tor_committee', label: 'คณะกรรมการจัดทำ TOR', type: 'committee', required: true, description: '≥3 คน' },
		]
	},
	median_price: {
		label: 'ราคากลาง',
		description: 'ตั้งคณะกรรมการกำหนดราคากลาง ≥3 คน',
		legalRef: 'ม.4, กฎกระทรวง ม.34',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการราคากลาง', type: 'committee', required: true },
			{ key: 'report_pdf', label: 'รายงานราคากลาง', type: 'pdf', required: true },
		]
	},
	purchase_request: {
		label: 'รายงานขอซื้อขอจ้าง',
		description: 'จัดทำรายงานเสนอหัวหน้าหน่วยงาน',
		legalRef: 'ข้อ 22',
		fields: [
			{ key: 'report_pdf', label: 'รายงานขอซื้อขอจ้าง', type: 'pdf', required: true },
		]
	},
	invitation: {
		label: 'หนังสือเชิญชวน',
		description: 'ส่งหนังสือเชิญผู้ประกอบการ ≥3 ราย',
		legalRef: 'ข้อ 75',
		fields: [
			{ key: 'invitation_pdf', label: 'หนังสือเชิญชวน', type: 'pdf', required: true },
			{ key: 'invited_vendors', label: 'รายชื่อผู้ที่เชิญ', type: 'vendors', required: true, description: '≥3 ราย' },
		]
	},
	procurement_committee: {
		label: 'คณะกรรมการจัดซื้อจัดจ้าง',
		description: 'ตั้งคณะกรรมการซื้อหรือจ้างโดยวิธีคัดเลือก ≥3 คน (เปิดซอง + พิจารณาผล)',
		legalRef: 'ข้อ 76, ข้อ 77',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการจัดซื้อจัดจ้าง', type: 'committee', required: true, description: '≥3 คน' },
			{ key: 'appointment_pdf', label: 'คำสั่งแต่งตั้ง', type: 'pdf', required: false },
		]
	},
	vendor_proposals: {
		label: 'ซองข้อเสนอ/ใบเสนอราคา',
		description: 'รับซองจากผู้เสนอราคา พร้อมเอกสาร',
		legalRef: 'ข้อ 76',
		fields: [
			{ key: 'vendors', label: 'ผู้เสนอราคา + จำนวนเงิน', type: 'vendors', required: true },
		]
	},
	evaluation: {
		label: 'รายงานผลการพิจารณา',
		description: 'คณะกรรมการจัดทำรายงานผลการพิจารณาเสนอหัวหน้าหน่วยงาน',
		legalRef: 'ข้อ 78',
		fields: [
			{ key: 'evaluation_pdf', label: 'รายงานผลการพิจารณา', type: 'pdf', required: true },
		]
	},
	winner_announcement: {
		label: 'ประกาศผู้ชนะการเสนอราคา',
		description: 'ประกาศผลในระบบ e-GP',
		legalRef: 'ม.66',
		fields: [
			{ key: 'announcement_pdf', label: 'ประกาศผู้ชนะ', type: 'pdf', required: true },
		]
	},
	contract: {
		label: 'สัญญา',
		description: 'จัดทำสัญญา + หลักประกันสัญญา (ถ้ามี)',
		legalRef: 'ข้อ 162-168',
		fields: [
			{ key: 'contract_pdf', label: 'สัญญา', type: 'pdf', required: true },
			{ key: 'guarantee_pdf', label: 'หลักประกันสัญญา', type: 'pdf', required: false },
		]
	},
	inspection_committee: {
		label: 'คณะกรรมการตรวจรับพัสดุ',
		description: 'แต่งตั้งคณะกรรมการตรวจรับ ≥3 คน',
		legalRef: 'ม.100, ข้อ 175',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการตรวจรับ', type: 'committee', required: true },
		]
	},
	inspection_report: {
		label: 'ตรวจรับพัสดุ',
		description: 'ใบตรวจรับ + ใบแจ้งหนี้',
		legalRef: 'ข้อ 175(1)',
		fields: [
			{ key: 'inspection_pdf', label: 'ใบตรวจรับพัสดุ', type: 'pdf', required: true },
			{ key: 'invoice_pdf', label: 'ใบแจ้งหนี้/Invoice', type: 'pdf', required: true },
		]
	}
};

// ─── วิธี e-Bidding (ม.55(1), ข้อ 47-54) ───
const E_BIDDING_SECTIONS: Record<string, BillSectionDef> = {
	tor: {
		label: 'ขอบเขตงาน (TOR)',
		description: 'จัดทำ TOR + ตั้งคณะกรรมการจัดทำ TOR ≥3 คน',
		legalRef: 'ม.9, ข้อ 21',
		fields: [
			{ key: 'tor_pdf', label: 'เอกสาร TOR', type: 'pdf', required: true },
			{ key: 'tor_committee', label: 'คณะกรรมการจัดทำ TOR', type: 'committee', required: true },
		]
	},
	median_price: {
		label: 'ราคากลาง',
		description: 'ตั้งคณะกรรมการกำหนดราคากลาง ≥3 คน',
		legalRef: 'ม.4, กฎกระทรวง ม.34',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการราคากลาง', type: 'committee', required: true },
			{ key: 'report_pdf', label: 'รายงานราคากลาง', type: 'pdf', required: true },
		]
	},
	purchase_request: {
		label: 'รายงานขอซื้อขอจ้าง + ร่างประกาศ',
		description: 'จัดทำรายงานขอซื้อขอจ้างพร้อมร่างประกาศประกวดราคา',
		legalRef: 'ข้อ 22, ข้อ 47',
		fields: [
			{ key: 'report_pdf', label: 'รายงานขอซื้อขอจ้าง', type: 'pdf', required: true },
			{ key: 'draft_announcement_pdf', label: 'ร่างประกาศประกวดราคา', type: 'pdf', required: true },
		]
	},
	tor_feedback: {
		label: 'รับฟังวิจารณ์ร่าง TOR',
		description: 'เปิดรับฟังความเห็น 3 วันทำการ (เฉพาะวงเงิน >500,000)',
		legalRef: 'ข้อ 48',
		fields: [
			{ key: 'feedback_summary_pdf', label: 'สรุปผลการรับฟังวิจารณ์', type: 'pdf', required: false, description: 'ถ้ามีการแก้ไข' },
			{ key: 'feedback_period', label: 'ช่วงเวลารับฟัง', type: 'date_range', required: false },
		]
	},
	announcement: {
		label: 'ประกาศเชิญชวน',
		description: 'ประกาศประกวดราคาในระบบ e-GP (5-20 วันทำการ)',
		legalRef: 'ข้อ 49, ม.62',
		fields: [
			{ key: 'announcement_pdf', label: 'ประกาศประกวดราคา', type: 'pdf', required: true },
		]
	},
	procurement_committee: {
		label: 'คณะกรรมการพิจารณาผล',
		description: 'ตั้งคณะกรรมการพิจารณาผลการประกวดราคา ≥3 คน',
		legalRef: 'ข้อ 51',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการพิจารณาผล', type: 'committee', required: true },
			{ key: 'appointment_pdf', label: 'คำสั่งแต่งตั้ง', type: 'pdf', required: false },
		]
	},
	vendor_proposals: {
		label: 'ข้อเสนอจากผู้ประกอบการ',
		description: 'ผู้ประกอบการเสนอราคาผ่านระบบ e-GP',
		legalRef: 'ข้อ 50',
		fields: [
			{ key: 'vendors', label: 'ผู้เสนอราคา + จำนวนเงิน + เอกสาร', type: 'vendors', required: true },
		]
	},
	evaluation: {
		label: 'รายงานผลการพิจารณา',
		description: 'คณะกรรมการตรวจสอบคุณสมบัติและพิจารณาราคา จัดทำรายงานผล',
		legalRef: 'ข้อ 52',
		fields: [
			{ key: 'evaluation_pdf', label: 'รายงานผลการพิจารณา', type: 'pdf', required: true },
		]
	},
	winner_announcement: {
		label: 'ประกาศผู้ชนะ + ระยะอุทธรณ์',
		description: 'ประกาศผู้ชนะใน e-GP + เปิดระยะอุทธรณ์ 7 วันทำการ',
		legalRef: 'ม.66, ม.117',
		fields: [
			{ key: 'winner_pdf', label: 'ประกาศผู้ชนะ', type: 'pdf', required: true },
			{ key: 'appeal_pdf', label: 'บันทึกผลอุทธรณ์ (ถ้ามี)', type: 'pdf', required: false },
		]
	},
	contract: {
		label: 'สัญญา',
		description: 'จัดทำสัญญา + หลักประกันสัญญา',
		legalRef: 'ข้อ 162-168, ม.98',
		fields: [
			{ key: 'contract_pdf', label: 'สัญญา', type: 'pdf', required: true },
			{ key: 'guarantee_pdf', label: 'หลักประกันสัญญา', type: 'pdf', required: true },
		]
	},
	inspection_committee: {
		label: 'คณะกรรมการตรวจรับพัสดุ',
		description: 'แต่งตั้งคณะกรรมการตรวจรับ ≥3 คน',
		legalRef: 'ม.100, ข้อ 175',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการตรวจรับ', type: 'committee', required: true },
		]
	},
	inspection_report: {
		label: 'ตรวจรับพัสดุ',
		description: 'ใบตรวจรับ + ใบแจ้งหนี้',
		legalRef: 'ข้อ 175(1)',
		fields: [
			{ key: 'inspection_pdf', label: 'ใบตรวจรับพัสดุ', type: 'pdf', required: true },
			{ key: 'invoice_pdf', label: 'ใบแจ้งหนี้/Invoice', type: 'pdf', required: true },
		]
	}
};

// ─── วิธี e-Market (ม.55(1), ข้อ 43-46) ───
const E_MARKET_SECTIONS: Record<string, BillSectionDef> = {
	median_price: {
		label: 'ราคากลาง',
		description: 'ตั้งคณะกรรมการกำหนดราคากลาง ≥3 คน (ต้องตรงกับ e-Catalog)',
		legalRef: 'ม.4, กฎกระทรวง ม.34',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการราคากลาง', type: 'committee', required: true },
			{ key: 'report_pdf', label: 'รายงานราคากลาง', type: 'pdf', required: true },
		]
	},
	purchase_request: {
		label: 'รายงานขอซื้อขอจ้าง',
		description: 'จัดทำรายงานเสนอหัวหน้าหน่วยงาน + ร่างประกาศ e-Market',
		legalRef: 'ข้อ 22, ข้อ 43',
		fields: [
			{ key: 'report_pdf', label: 'รายงานขอซื้อขอจ้าง', type: 'pdf', required: true },
		]
	},
	e_catalog: {
		label: 'รายการสินค้าจาก e-Catalog',
		description: 'เลือกสินค้าจาก e-Catalog ส่วนกลาง (ต้องตรงกับ TOR)',
		legalRef: 'ข้อ 43',
		fields: [
			{ key: 'items', label: 'รายการสินค้า (ชื่อ, จำนวน, ราคาต่อหน่วย)', type: 'items', required: true },
		]
	},
	announcement: {
		label: 'ประกาศ e-Market',
		description: 'ประกาศในระบบ e-GP (ระบบส่งแจ้งเตือนผู้ค้าอัตโนมัติ)',
		legalRef: 'ข้อ 44, ม.62',
		fields: [
			{ key: 'announcement_pdf', label: 'ประกาศ e-Market', type: 'pdf', required: true },
		]
	},
	vendor_proposals: {
		label: 'ข้อเสนอราคา',
		description: 'ผู้ประกอบการเสนอราคาผ่าน e-GP (≤5ล้าน: ครั้งเดียว / >5ล้าน: ประมูล 30 นาที)',
		legalRef: 'ข้อ 45',
		fields: [
			{ key: 'vendors', label: 'ผู้เสนอราคา + จำนวนเงิน', type: 'vendors', required: true },
		]
	},
	winner_announcement: {
		label: 'ประกาศผู้ชนะ + ระยะอุทธรณ์',
		description: 'ประกาศผู้ชนะ + เปิดอุทธรณ์ 7 วันทำการ',
		legalRef: 'ม.66, ม.117',
		fields: [
			{ key: 'winner_pdf', label: 'ประกาศผู้ชนะ', type: 'pdf', required: true },
			{ key: 'appeal_pdf', label: 'บันทึกผลอุทธรณ์ (ถ้ามี)', type: 'pdf', required: false },
		]
	},
	contract: {
		label: 'สัญญา',
		description: 'จัดทำสัญญา + หลักประกัน',
		legalRef: 'ข้อ 162-168',
		fields: [
			{ key: 'contract_pdf', label: 'สัญญา', type: 'pdf', required: true },
			{ key: 'guarantee_pdf', label: 'หลักประกันสัญญา', type: 'pdf', required: false },
		]
	},
	inspection_committee: {
		label: 'คณะกรรมการตรวจรับพัสดุ',
		description: 'แต่งตั้งคณะกรรมการตรวจรับ ≥3 คน',
		legalRef: 'ม.100, ข้อ 175',
		fields: [
			{ key: 'committee', label: 'คณะกรรมการตรวจรับ', type: 'committee', required: true },
		]
	},
	inspection_report: {
		label: 'ตรวจรับพัสดุ',
		description: 'ใบตรวจรับ + ใบแจ้งหนี้',
		legalRef: 'ข้อ 175(1)',
		fields: [
			{ key: 'inspection_pdf', label: 'ใบตรวจรับพัสดุ', type: 'pdf', required: true },
			{ key: 'invoice_pdf', label: 'ใบแจ้งหนี้/Invoice', type: 'pdf', required: true },
		]
	}
};

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

export const BILL_SECTION_DEFS: Record<string, Record<string, BillSectionDef>> = {
	specific_lte100k: SPECIFIC_LTE100K_SECTIONS,
	specific_gt100k: SPECIFIC_GT100K_SECTIONS,
	selection: SELECTION_SECTIONS,
	e_bidding: E_BIDDING_SECTIONS,
	e_market: E_MARKET_SECTIONS
};

// Simple label map (backward compat for existing UI)
export const BILL_SECTION_LABELS: Record<string, Record<string, string>> = Object.fromEntries(
	Object.entries(BILL_SECTION_DEFS).map(([method, sections]) => [
		method,
		Object.fromEntries(Object.entries(sections).map(([key, def]) => [key, def.label]))
	])
);
