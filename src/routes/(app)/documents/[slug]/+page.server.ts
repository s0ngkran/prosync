import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	documents,
	plans,
	documentApprovalSteps,
	users,
	projectItems,
	paymentRounds
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();

	const [doc] = await db
		.select({
			id: documents.id,
			slug: documents.slug,
			agency_id: documents.agency_id,
			plan_id: documents.plan_id,
			status: documents.status,
			doc_type: documents.doc_type,
			procurement_method: documents.procurement_method,
			phase: documents.phase,
			updated_by: documents.updated_by
		})
		.from(documents)
		.where(eq(documents.slug, params.slug));
	const docId = doc?.id;

	if (!doc) throw error(404, 'ไม่พบเอกสาร');

	const [plan] = await db.select().from(plans).where(eq(plans.id, doc.plan_id));

	// Load approval steps with assignee names
	const approvalSteps = await db
		.select({
			id: documentApprovalSteps.id,
			document_id: documentApprovalSteps.document_id,
			step_sequence: documentApprovalSteps.step_sequence,
			step_code: documentApprovalSteps.step_code,
			step_name: documentApprovalSteps.step_name,
			assigned_user_id: documentApprovalSteps.assigned_user_id,
			assigned_user_name: users.name,
			status: documentApprovalSteps.status,
			comment: documentApprovalSteps.comment,
			completed_at: documentApprovalSteps.completed_at,
			created_at: documentApprovalSteps.created_at
		})
		.from(documentApprovalSteps)
		.leftJoin(users, eq(documentApprovalSteps.assigned_user_id, users.id))
		.where(eq(documentApprovalSteps.document_id, docId));

	// Load project items for type5
	let items: any[] = [];
	if (doc.doc_type === 'type5_project') {
		items = await db.select().from(projectItems).where(eq(projectItems.document_id, docId));
	}

	// Load payment rounds (for tracking after approval)
	const rounds = await db.select().from(paymentRounds).where(eq(paymentRounds.document_id, docId));

	return {
		user,
		document: doc,
		plan,
		approvalSteps: approvalSteps.sort((a, b) => a.step_sequence - b.step_sequence),
		projectItems: items,
		paymentRounds: rounds
	};
};

export const actions: Actions = {
	approveStep: async ({ request, params, locals }) => {
		const form = await request.formData();
		const [{ id: docId }] = await db.select({ id: documents.id }).from(documents).where(eq(documents.slug, params.slug));
		const stepId = Number(form.get('step_id'));
		const action = form.get('action') as 'APPROVED' | 'REJECTED';
		const comment = form.get('comment') as string | null;

		if (!stepId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
			return fail(400, { success: false, errors: { step: ['ข้อมูลไม่ถูกต้อง'] } });
		}

		try {
			const { advanceApprovalStep } = await import('$lib/server/approval-flow');
			const result = await advanceApprovalStep(docId, stepId, locals.user.sub, action, comment ?? undefined);

			if (result === 'EXECUTION') {
				// All 5 steps approved. Create first payment round for types that need it.
				const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
				if (doc?.doc_type && doc.doc_type !== 'type5_project') {
					const { createFirstPaymentRound } = await import('$lib/server/payment-rounds');
					await createFirstPaymentRound(docId, doc.doc_type);
				}

				// Route info based on type
				const routeMap: Record<string, string> = {
					type1_nParcel: 'ส่งไปแผนกจัดซื้อจัดจ้างแล้ว',
					type2_iParcelUtil: 'ส่งไปแผนกจัดซื้อจัดจ้างแล้ว',
					type3_iParcel: 'ส่งไปแผนกจัดซื้อจัดจ้างแล้ว',
					type4_iFinance: 'ส่งไปแผนกการเงินแล้ว',
					type5_project: 'เริ่มจัดการโครงการ'
				};
				return { success: true, message: `อนุมัติสำเร็จ — ${routeMap[doc?.doc_type ?? ''] ?? 'เข้าสู่ขั้นตอนดำเนินการ'}` };
			}

			if (result === 'REJECTED') {
				return { success: true, message: 'ปฏิเสธเอกสารแล้ว' };
			}

			return { success: true, message: 'อนุมัติสำเร็จ — ส่งต่อขั้นตอนถัดไป' };
		} catch (err: any) {
			return fail(400, { success: false, errors: { step: [err.message || 'เกิดข้อผิดพลาด'] } });
		}
	},

	createProjectItem: async ({ request, params }) => {
		const form = await request.formData();
		const [{ id: docId }] = await db.select({ id: documents.id }).from(documents).where(eq(documents.slug, params.slug));
		const item_name = form.get('item_name') as string;
		const item_type = form.get('item_type') as string;
		const estimated_amount = form.get('estimated_amount') as string;

		if (!item_name || !item_type || !['pFinance', 'pParcel'].includes(item_type)) {
			return fail(400, { success: false, errors: { item: ['กรุณาระบุข้อมูลให้ครบ'] } });
		}

		try {
			await db.insert(projectItems).values({
				document_id: docId,
				item_name,
				item_type,
				estimated_amount: estimated_amount || '0',
				status: 'PENDING'
			});
			return { success: true, message: 'เพิ่มรายการโครงการสำเร็จ' };
		} catch (err) {
			return fail(500, { success: false, errors: { item: ['เกิดข้อผิดพลาด'] } });
		}
	},

	closeProject: async ({ params }) => {
		const [{ id: docId }] = await db.select({ id: documents.id }).from(documents).where(eq(documents.slug, params.slug));
		try {
			const items = await db.select().from(projectItems).where(eq(projectItems.document_id, docId));
			if (items.length === 0) {
				return fail(400, { success: false, errors: { project: ['ต้องมีรายการโครงการอย่างน้อย 1 รายการ'] } });
			}
			const allDone = items.every((i: any) => i.status === 'COMPLETED');
			if (!allDone) {
				return fail(400, { success: false, errors: { project: ['ต้องดำเนินการรายการทั้งหมดให้เสร็จก่อนปิดโครงการ'] } });
			}

			await db.update(documents).set({ phase: 'COMPLETED', status: 'PAID' }).where(eq(documents.id, docId));
			return { success: true, message: 'ปิดโครงการสำเร็จ' };
		} catch (err) {
			return fail(500, { success: false, errors: { project: ['เกิดข้อผิดพลาด'] } });
		}
	}
};
