import { db } from '$lib/server/db';
import { paymentRounds, documents, notifications } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// Status transitions per document type
const STATUS_FLOWS: Record<string, string[]> = {
	type1_nParcel: [
		'BILL_PENDING',
		'BILL_CREATED',
		'SENT_TO_FINANCE',
		'FINANCE_SEEN',
		'DIKA_CREATED',
		'DIRECTOR_APPROVED',
		'PAID',
		'STAMPED'
	],
	type2_iParcelUtil: [
		'BILL_PENDING',
		'BILL_CREATED',
		'SENT_TO_FINANCE',
		'FINANCE_SEEN',
		'DIKA_CREATED',
		'PAID', // No director approval
		'STAMPED'
	],
	type3_iParcel: [
		'BILL_PENDING',
		'BILL_CREATED',
		'SENT_TO_FINANCE',
		'FINANCE_SEEN',
		'DIKA_CREATED',
		'DIRECTOR_APPROVED',
		'PAID',
		'STAMPED'
	],
	type4_iFinance: [
		'DIKA_CREATED',
		'DIRECTOR_APPROVED',
		'PAID',
		'STAMPED'
	]
};

export type PaymentRoundStatus = string;

/**
 * Get the valid status flow for a document type
 */
export function getStatusFlow(docType: string): string[] {
	return STATUS_FLOWS[docType] ?? STATUS_FLOWS.type1_nParcel;
}

/**
 * Get the next valid status for a payment round
 */
export function getNextStatus(docType: string, currentStatus: string): string | null {
	const flow = getStatusFlow(docType);
	const idx = flow.indexOf(currentStatus);
	if (idx === -1 || idx >= flow.length - 1) return null;
	return flow[idx + 1];
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(docType: string, from: string, to: string): boolean {
	const flow = getStatusFlow(docType);
	const fromIdx = flow.indexOf(from);
	const toIdx = flow.indexOf(to);
	return fromIdx !== -1 && toIdx === fromIdx + 1;
}

/**
 * Get the actor role for a given status
 */
export function getActorForStatus(status: string): string {
	switch (status) {
		case 'BILL_PENDING':
		case 'BILL_CREATED':
		case 'SENT_TO_FINANCE':
			return 'PROCUREMENT';
		case 'FINANCE_SEEN':
		case 'DIKA_CREATED':
		case 'PAID':
		case 'STAMPED':
			return 'FINANCE';
		case 'DIRECTOR_APPROVED':
			return 'DIRECTOR';
		default:
			return 'PROCUREMENT';
	}
}

/**
 * Create the first payment round for a document entering execution phase
 */
export async function createFirstPaymentRound(documentId: number, docType: string) {
	const flow = getStatusFlow(docType);
	const initialStatus = flow[0];
	const actorRole = getActorForStatus(initialStatus);

	const [round] = await db
		.insert(paymentRounds)
		.values({
			document_id: documentId,
			round_number: 1,
			status: initialStatus,
			current_actor_role: actorRole
		})
		.returning();

	return round;
}

/**
 * Create the next payment round (for multi-round types: type2, type3, type4)
 */
export async function createNextPaymentRound(documentId: number, docType: string) {
	// Get the latest round number
	const existingRounds = await db
		.select()
		.from(paymentRounds)
		.where(eq(paymentRounds.document_id, documentId));

	const maxRound = Math.max(0, ...existingRounds.map((r) => r.round_number));
	const nextRoundNumber = maxRound + 1;

	const flow = getStatusFlow(docType);
	const initialStatus = flow[0];

	const [round] = await db
		.insert(paymentRounds)
		.values({
			document_id: documentId,
			round_number: nextRoundNumber,
			status: initialStatus,
			current_actor_role: getActorForStatus(initialStatus)
		})
		.returning();

	return round;
}

/**
 * Advance a payment round to its next status.
 * Returns the new status, or null if already at final status.
 */
export async function advancePaymentRound(
	roundId: number,
	docType: string,
	additionalData?: Partial<{
		bill_payload: any;
		bill_created_by: number;
		finance_seen_by: number;
		dika_voucher_id: number;
		check_no: string;
		check_date: string;
		paid_by: number;
		stamped_by: number;
	}>
) {
	const [round] = await db
		.select()
		.from(paymentRounds)
		.where(eq(paymentRounds.id, roundId));

	if (!round) throw new Error('ไม่พบรอบการจ่ายเงิน');

	const nextStatus = getNextStatus(docType, round.status);
	if (!nextStatus) throw new Error('รอบนี้อยู่ในสถานะสุดท้ายแล้ว');

	const now = new Date();
	const updateData: Record<string, any> = {
		status: nextStatus,
		current_actor_role: getActorForStatus(nextStatus)
	};

	// Set timestamps based on the new status
	switch (nextStatus) {
		case 'BILL_CREATED':
			updateData.bill_payload = additionalData?.bill_payload ?? round.bill_payload;
			updateData.bill_created_by = additionalData?.bill_created_by ?? null;
			updateData.bill_created_at = now;
			break;
		case 'SENT_TO_FINANCE':
			updateData.sent_to_finance_at = now;
			break;
		case 'FINANCE_SEEN':
			updateData.finance_seen_at = now;
			updateData.finance_seen_by = additionalData?.finance_seen_by ?? null;
			break;
		case 'DIKA_CREATED':
			updateData.dika_voucher_id = additionalData?.dika_voucher_id ?? null;
			break;
		case 'PAID':
			updateData.check_no = additionalData?.check_no ?? null;
			updateData.check_date = additionalData?.check_date ?? null;
			updateData.paid_at = now;
			updateData.paid_by = additionalData?.paid_by ?? null;
			break;
		case 'STAMPED':
			updateData.stamped_at = now;
			updateData.stamped_by = additionalData?.stamped_by ?? null;
			break;
	}

	await db
		.update(paymentRounds)
		.set(updateData)
		.where(eq(paymentRounds.id, roundId));

	// If this is the final status (STAMPED) and it's type1 (single payment), mark document as completed
	if (nextStatus === 'STAMPED' && docType === 'type1_nParcel') {
		await db
			.update(documents)
			.set({ phase: 'COMPLETED', status: 'PAID' })
			.where(eq(documents.id, round.document_id));
	}

	return nextStatus;
}

/**
 * Check if a document type supports multiple payment rounds
 */
export function isMultiRoundType(docType: string): boolean {
	return ['type2_iParcelUtil', 'type3_iParcel', 'type4_iFinance'].includes(docType);
}

/**
 * Calculate days remaining in the 90-day payment window
 */
export function calc90DayStatus(financeSeenAt: Date | string | null): {
	daysElapsed: number;
	daysRemaining: number;
	isWarning: boolean;
	isOverdue: boolean;
} | null {
	if (!financeSeenAt) return null;
	const seen = new Date(financeSeenAt);
	const now = new Date();
	const diffMs = now.getTime() - seen.getTime();
	const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const daysRemaining = 90 - daysElapsed;

	return {
		daysElapsed,
		daysRemaining,
		isWarning: daysRemaining <= 15 && daysRemaining > 0,
		isOverdue: daysRemaining <= 0
	};
}
