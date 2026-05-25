import { z } from 'zod';

// Shared sub-schemas
const pdfUpload = z.string().optional(); // URL to uploaded PDF
const committeeEntry = z.object({
	user_id: z.number(),
	role_in_committee: z.string().optional()
});
const vendorQuotation = z.object({
	vendor_id: z.number(),
	price: z.string(), // monetary
	pdf_url: z.string().optional()
});

// ─── วิธีเฉพาะเจาะจง (≤100K) ───
export const billSpecificLte100k = z.object({
	quotations: z.array(vendorQuotation).min(1, 'ต้องมีใบเสนอราคาอย่างน้อย 1 ราย'),
	vendor_selection: z.object({
		winner_vendor_id: z.number(),
		reason: z.string().optional(),
		report_pdf: pdfUpload
	}),
	purchase_order: z.object({
		details: z.string().optional(),
		pdf_url: pdfUpload
	}).optional(),
	inspection: z.object({
		committee: z.array(committeeEntry).min(1, 'ต้องมีกรรมการตรวจรับอย่างน้อย 1 คน'),
		report_pdf: pdfUpload,
		invoice_pdf: pdfUpload
	})
});

// ─── วิธีเฉพาะเจาะจง (>100K-500K) ───
export const billSpecificGt100k = z.object({
	tor: z.object({
		description: z.string().min(1, 'ต้องระบุรายละเอียด TOR'),
		pdf_url: pdfUpload,
		committee: z.array(committeeEntry).min(1, 'ต้องมีกรรมการ TOR')
	}),
	median_price: z.object({
		committee: z.array(committeeEntry).min(1, 'ต้องมีกรรมการราคากลาง'),
		report_pdf: pdfUpload
	}),
	quotations: z.array(vendorQuotation).min(1),
	vendor_selection: z.object({
		winner_vendor_id: z.number(),
		reason: z.string().optional(),
		report_pdf: pdfUpload
	}),
	contract: z.object({
		details: z.string().optional(),
		pdf_url: pdfUpload
	}),
	inspection: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload,
		invoice_pdf: pdfUpload
	})
});

// ─── วิธีคัดเลือก ───
export const billSelection = z.object({
	tor: z.object({
		description: z.string().min(1),
		pdf_url: pdfUpload,
		committee: z.array(committeeEntry).min(1)
	}),
	median_price: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload
	}),
	invitation: z.object({
		vendors: z.array(z.number()).min(1, 'ต้องเชิญผู้ขายอย่างน้อย 1 ราย'),
		pdf_url: pdfUpload
	}),
	procurement_committee: z.object({
		committee: z.array(committeeEntry).min(1),
		evaluation_pdf: pdfUpload
	}),
	vendor_selection: z.object({
		winner_vendor_id: z.number(),
		evaluation_result: z.string().optional(),
		report_pdf: pdfUpload
	}),
	contract: z.object({
		details: z.string().optional(),
		pdf_url: pdfUpload
	}),
	inspection: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload,
		invoice_pdf: pdfUpload
	})
});

// ─── e-Bidding ───
export const billEBidding = z.object({
	tor: z.object({
		description: z.string().min(1),
		pdf_url: pdfUpload,
		committee: z.array(committeeEntry).min(1)
	}),
	median_price: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload
	}),
	announcement: z.object({
		pdf_url: pdfUpload,
		comment_period_start: z.string().optional(),
		comment_period_end: z.string().optional()
	}),
	procurement_committee: z.object({
		committee: z.array(committeeEntry).min(1)
	}),
	vendor_proposals: z.array(z.object({
		vendor_id: z.number(),
		price: z.string(),
		document_pdf: pdfUpload
	})).min(1),
	evaluation: z.object({
		scores: z.array(z.object({
			vendor_id: z.number(),
			score: z.number()
		})).optional(),
		report_pdf: pdfUpload
	}),
	winner_announcement: z.object({
		pdf_url: pdfUpload
	}),
	contract: z.object({
		details: z.string().optional(),
		pdf_url: pdfUpload
	}),
	inspection: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload,
		invoice_pdf: pdfUpload
	})
});

// ─── e-Market ───
export const billEMarket = z.object({
	tor: z.object({
		description: z.string().min(1),
		pdf_url: pdfUpload
	}),
	median_price: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload
	}),
	e_catalog: z.object({
		items: z.array(z.object({
			name: z.string(),
			quantity: z.number(),
			unit_price: z.string()
		})).min(1)
	}),
	evaluation: z.object({
		report_pdf: pdfUpload
	}),
	contract: z.object({
		details: z.string().optional(),
		pdf_url: pdfUpload
	}),
	inspection: z.object({
		committee: z.array(committeeEntry).min(1),
		report_pdf: pdfUpload,
		invoice_pdf: pdfUpload
	})
});

// ─── Schema lookup by procurement method ───
export const BILL_SCHEMAS: Record<string, z.ZodType<any>> = {
	specific_lte100k: billSpecificLte100k,
	specific_gt100k: billSpecificGt100k,
	selection: billSelection,
	e_bidding: billEBidding,
	e_market: billEMarket
};

export function getBillSchema(procurementMethod: string) {
	return BILL_SCHEMAS[procurementMethod] ?? null;
}

// Re-export section labels from shared types (used by both server validation and client UI)
export { BILL_SECTION_LABELS } from '$lib/types/procurement';
