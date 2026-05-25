import { db } from '$lib/server/db';
import {
	documentApprovalSteps,
	documents,
	plans,
	orgUnits,
	agencySettings,
	userAssignments,
	notifications
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Step definitions for the universal 5-step approval flow
const APPROVAL_STEPS = [
	{ sequence: 1, code: 'DIVISION_DRAFT', name: 'แผนกรับผิดชอบ — ร่าง' },
	{ sequence: 2, code: 'HEAD_APPROVE', name: 'หัวหน้าแผนก — อนุมัติ' },
	{ sequence: 3, code: 'PLANNER_CHECK', name: 'แผนกแผนงาน — ตรวจสอบ' },
	{ sequence: 4, code: 'PLANNER_DIRECTOR_APPROVE', name: 'หัวหน้าแผนงาน — เสนอ ผอ.' },
	{ sequence: 5, code: 'DIRECTOR_APPROVE', name: 'ผู้อำนวยการ — อนุมัติ' }
] as const;

export type ApprovalStepCode = (typeof APPROVAL_STEPS)[number]['code'];

/**
 * Create the 5 approval steps for a new document.
 * Called when a new document is created with the v2 flow.
 */
export async function createApprovalSteps(documentId: number, planId: number, creatorUserId: number, agencyId: number) {
	// Resolve assignees
	const assignees = await resolveApprovalAssignees(planId, creatorUserId, agencyId);

	const steps = APPROVAL_STEPS.map((step) => ({
		document_id: documentId,
		step_sequence: step.sequence,
		step_code: step.code,
		step_name: step.name,
		assigned_user_id: assignees[step.code] ?? null,
		status: step.sequence === 1 ? 'IN_PROGRESS' : 'PENDING'
	}));

	await db.insert(documentApprovalSteps).values(steps);

	// Notify the first step assignee (the creator — they need to complete the draft)
	if (assignees.DIVISION_DRAFT) {
		await db.insert(notifications).values({
			user_id: assignees.DIVISION_DRAFT,
			document_id: documentId,
			title: 'เอกสารจัดซื้อจัดจ้างใหม่',
			message: 'คุณได้รับมอบหมายให้ร่างเอกสารจัดซื้อจัดจ้าง',
			action_url: `/procurement/${documentId}`,
			notification_type: 'DRAFT_REQUIRED'
		});
	}
}

/**
 * Resolve who should be assigned to each approval step.
 */
async function resolveApprovalAssignees(
	planId: number,
	creatorUserId: number,
	agencyId: number
): Promise<Record<ApprovalStepCode, number | null>> {
	const result: Record<ApprovalStepCode, number | null> = {
		DIVISION_DRAFT: creatorUserId,
		HEAD_APPROVE: null,
		PLANNER_CHECK: null,
		PLANNER_DIRECTOR_APPROVE: null,
		DIRECTOR_APPROVE: null
	};

	// Get the plan's responsible unit for step 2 (head of division)
	const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
	if (plan?.responsible_unit_id) {
		const [unit] = await db
			.select()
			.from(orgUnits)
			.where(eq(orgUnits.id, plan.responsible_unit_id));
		if (unit?.head_of_unit_id) {
			result.HEAD_APPROVE = unit.head_of_unit_id;
		}
	}

	// Get agency settings for planning unit (steps 3 & 4)
	const [settings] = await db
		.select()
		.from(agencySettings)
		.where(eq(agencySettings.agency_id, agencyId));

	if (settings?.planning_unit_id) {
		// Step 3: any user assigned to the planning unit
		const planningUsers = await db
			.select({ user_id: userAssignments.user_id })
			.from(userAssignments)
			.where(eq(userAssignments.org_unit_id, settings.planning_unit_id))
			.limit(1);
		if (planningUsers.length > 0) {
			result.PLANNER_CHECK = planningUsers[0].user_id;
		}

		// Step 4: head of planning unit
		const [planningUnit] = await db
			.select()
			.from(orgUnits)
			.where(eq(orgUnits.id, settings.planning_unit_id));
		if (planningUnit?.head_of_unit_id) {
			result.PLANNER_DIRECTOR_APPROVE = planningUnit.head_of_unit_id;
		}
	}

	// Step 5: Director = head of root org unit (parent_id IS NULL)
	const [rootUnit] = await db
		.select()
		.from(orgUnits)
		.where(and(eq(orgUnits.agency_id, agencyId), isNull(orgUnits.parent_id)));
	if (rootUnit?.head_of_unit_id) {
		result.DIRECTOR_APPROVE = rootUnit.head_of_unit_id;
	}

	return result;
}

/**
 * Advance the approval flow: approve the current step and move to the next one.
 * Returns the new phase if all steps are done ('EXECUTION'), otherwise null.
 */
export async function advanceApprovalStep(
	documentId: number,
	stepId: number,
	userId: number,
	action: 'APPROVED' | 'REJECTED',
	comment?: string
) {
	// Get the step
	const [step] = await db
		.select()
		.from(documentApprovalSteps)
		.where(eq(documentApprovalSteps.id, stepId));

	if (!step || step.document_id !== documentId) {
		throw new Error('ไม่พบขั้นตอนอนุมัติ');
	}
	if (step.status !== 'IN_PROGRESS') {
		throw new Error('ขั้นตอนนี้ไม่ได้อยู่ในสถานะรอดำเนินการ');
	}

	// Update this step
	await db
		.update(documentApprovalSteps)
		.set({
			status: action,
			comment: comment ?? null,
			completed_at: new Date()
		})
		.where(eq(documentApprovalSteps.id, stepId));

	if (action === 'REJECTED') {
		// Mark document as rejected
		await db
			.update(documents)
			.set({ status: 'REJECTED' })
			.where(eq(documents.id, documentId));

		// Notify the creator
		const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
		if (doc?.updated_by) {
			await db.insert(notifications).values({
				user_id: doc.updated_by,
				document_id: documentId,
				title: 'เอกสารถูกปฏิเสธ',
				message: `ขั้นตอน "${step.step_name}" ถูกปฏิเสธ${comment ? `: ${comment}` : ''}`,
				action_url: `/procurement/${documentId}`,
				notification_type: 'DOCUMENT_REJECTED'
			});
		}

		return 'REJECTED';
	}

	// APPROVED — check if there's a next step
	const allSteps = await db
		.select()
		.from(documentApprovalSteps)
		.where(eq(documentApprovalSteps.document_id, documentId));

	const nextStep = allSteps.find((s) => s.step_sequence === step.step_sequence + 1);

	if (nextStep) {
		// Activate the next step
		await db
			.update(documentApprovalSteps)
			.set({ status: 'IN_PROGRESS' })
			.where(eq(documentApprovalSteps.id, nextStep.id));

		// Notify the next assignee
		if (nextStep.assigned_user_id) {
			await db.insert(notifications).values({
				user_id: nextStep.assigned_user_id,
				document_id: documentId,
				title: 'รอดำเนินการ',
				message: `ขั้นตอน "${nextStep.step_name}" รอการดำเนินการของคุณ`,
				action_url: `/procurement/${documentId}`,
				notification_type: 'APPROVAL_REQUIRED'
			});
		}

		return null; // Still in approval phase
	}

	// All steps done — move document to execution phase
	await db
		.update(documents)
		.set({ phase: 'EXECUTION', status: 'APPROVED_PROCUREMENT' })
		.where(eq(documents.id, documentId));

	return 'EXECUTION';
}

/**
 * Get current approval status for a document.
 */
export async function getApprovalStatus(documentId: number) {
	const steps = await db
		.select()
		.from(documentApprovalSteps)
		.where(eq(documentApprovalSteps.document_id, documentId));

	const currentStep = steps.find((s) => s.status === 'IN_PROGRESS');
	const completedCount = steps.filter((s) => s.status === 'APPROVED').length;
	const isRejected = steps.some((s) => s.status === 'REJECTED');

	return {
		steps,
		currentStep,
		completedCount,
		totalSteps: steps.length,
		isRejected,
		isComplete: completedCount === steps.length
	};
}
