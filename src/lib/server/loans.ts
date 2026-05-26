// Pure business logic for loans — no DB dependencies, fully testable

export type LoanType = 'TAX_POOL' | 'INTER_AGENCY';

export interface LoanApprovalResult {
	valid: boolean;
	reason?: string;
}

export interface RepaymentResult {
	newRepaidAmount: number;
	fullyRepaid: boolean;
	overpayment: boolean;
}

/**
 * Validate whether a loan can be approved.
 * TAX_POOL: source bank account must have sufficient balance.
 * INTER_AGENCY: always valid (actual transfer happens outside system).
 */
export function validateLoanApproval(
	loanType: LoanType,
	loanAmount: number,
	bankBalance?: number | null
): LoanApprovalResult {
	if (loanType === 'TAX_POOL') {
		if (bankBalance == null) {
			return { valid: false, reason: 'ไม่พบบัญชีพักภาษีที่เชื่อมกับรายการยืมนี้' };
		}
		if (bankBalance < loanAmount) {
			return {
				valid: false,
				reason: `ยอดเงินในบัญชีภาษีไม่เพียงพอ (คงเหลือ ${bankBalance.toLocaleString()} บาท, ต้องการ ${loanAmount.toLocaleString()} บาท)`
			};
		}
	}
	return { valid: true };
}

/**
 * Compute display status for a loan — derive OVERDUE at read time.
 * Only APPROVED loans with a past due_date become OVERDUE.
 */
export function computeLoanOverdueStatus(
	status: string,
	dueDate: string | null | undefined,
	now?: Date
): string {
	if (status !== 'APPROVED' || !dueDate) return status;
	const today = now ?? new Date();
	const due = new Date(dueDate + 'T23:59:59');
	return due < today ? 'OVERDUE' : status;
}

/**
 * Calculate repayment amounts and determine if fully repaid.
 * Returns overpayment flag if repay exceeds remaining.
 */
export function calculateRepayment(
	currentRepaid: number,
	loanAmount: number,
	repayAmount: number
): RepaymentResult {
	const remaining = loanAmount - currentRepaid;
	const overpayment = repayAmount > remaining;
	const effectiveRepay = overpayment ? remaining : repayAmount;
	const newRepaidAmount = currentRepaid + effectiveRepay;
	const fullyRepaid = newRepaidAmount >= loanAmount;
	return { newRepaidAmount, fullyRepaid, overpayment };
}
