import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// ──────────────────────────────────────────────
// Helper: Random number in range
// ──────────────────────────────────────────────
function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAmount(min: number, max: number): string {
	return (Math.random() * (max - min) + min).toFixed(2);
}

// ──────────────────────────────────────────────
// Thai name pools
// ──────────────────────────────────────────────
const firstNames = [
	'สมชาย',
	'สมหญิง',
	'วิชัย',
	'สุภาพ',
	'ประเสริฐ',
	'นภา',
	'ธนพล',
	'อรุณี',
	'กิตติ',
	'พิมพ์ใจ',
	'สมศักดิ์',
	'วรรณา',
	'ชัยวัฒน์',
	'นิตยา',
	'สุรชัย',
	'มาลี',
	'อนุชา',
	'รัตนา',
	'พิชัย',
	'สมพร'
];

const lastNames = [
	'สุขใจ',
	'ดีงาม',
	'ศรีสุข',
	'มั่นคง',
	'เจริญรุ่ง',
	'แสงทอง',
	'บุญมี',
	'รักไทย',
	'พงษ์พันธ์',
	'วงศ์สวัสดิ์',
	'แก้วมณี',
	'จันทร์เพ็ญ',
	'ศิริวัฒน์',
	'ทองดี',
	'สมบูรณ์'
];

const positions = ['นาย', 'นาง', 'นางสาว', 'นพ.', 'พญ.', 'ทพ.', 'ภก.', 'พว.'];

const positionRanks = [
	'เจ้าพนักงานพัสดุชำนาญงาน',
	'นักวิชาการเงินและบัญชีชำนาญการ',
	'พยาบาลวิชาชีพชำนาญการพิเศษ',
	'แพทย์ชำนาญการ',
	'เภสัชกรชำนาญการ',
	'นักวิชาการคอมพิวเตอร์ชำนาญการ',
	'เจ้าพนักงานธุรการชำนาญงาน',
	'นักทรัพยากรบุคคลชำนาญการ',
	'วิศวกรโยธาชำนาญการ',
	'นักวิชาการสาธารณสุขชำนาญการ'
];

// ──────────────────────────────────────────────
// Org unit names by department
// ──────────────────────────────────────────────
const departmentUnits = [
	// ศัลยกรรม
	{ name: 'ศัลยกรรมทั่วไป', parent: 'ศัลยกรรม' },
	{ name: 'ศัลยกรรมกระดูก', parent: 'ศัลยกรรม' },
	{ name: 'ศัลยกรรมระบบทางเดินปัสสาวะ', parent: 'ศัลยกรรม' },
	// อายุรกรรม
	{ name: 'อายุรกรรมทั่วไป', parent: 'อายุรกรรม' },
	{ name: 'อายุรกรรมหัวใจ', parent: 'อายุรกรรม' },
	{ name: 'อายุรกรรมระบบทางเดินอาหาร', parent: 'อายุรกรรม' },
	// กุมารเวชกรรม
	{ name: 'กุมารเวชกรรมทั่วไป', parent: 'กุมารเวชกรรม' },
	{ name: 'กุมารเวชกรรมทารกแรกเกิด', parent: 'กุมารเวชกรรม' },
	{ name: 'คลินิกเด็กสุขภาพดี', parent: 'กุมารเวชกรรม' },
	// สูติ-นรีเวชกรรม
	{ name: 'สูติกรรม', parent: 'สูติ-นรีเวชกรรม' },
	{ name: 'นรีเวชกรรม', parent: 'สูติ-นรีเวชกรรม' },
	{ name: 'คลินิกวางแผนครอบครัว', parent: 'สูติ-นรีเวชกรรม' },
	// จักษุวิทยา
	{ name: 'คลินิกจักษุทั่วไป', parent: 'จักษุวิทยา' },
	{ name: 'ห้องตรวจจักษุพิเศษ', parent: 'จักษุวิทยา' },
	{ name: 'ห้องผ่าตัดจักษุ', parent: 'จักษุวิทยา' },
	// โสต ศอ นาสิก
	{ name: 'คลินิกหู', parent: 'โสต ศอ นาสิก' },
	{ name: 'คลินิกจมูก', parent: 'โสต ศอ นาสิก' },
	{ name: 'คลินิกคอ', parent: 'โสต ศอ นาสิก' },
	// ออร์โธปิดิกส์
	{ name: 'คลินิกกระดูกทั่วไป', parent: 'ออร์โธปิดิกส์' },
	{ name: 'คลินิกกระดูกเด็ก', parent: 'ออร์โธปิดิกส์' },
	{ name: 'คลินิกกายภาพบำบัด', parent: 'ออร์โธปิดิกส์' },
	// วิสัญญีวิทยา
	{ name: 'ห้องผ่าตัดใหญ่', parent: 'วิสัญญีวิทยา' },
	{ name: 'ห้องผ่าตัดเล็ก', parent: 'วิสัญญีวิทยา' },
	{ name: 'ห้องฟื้นผู้ป่วย', parent: 'วิสัญญีวิทยา' },
	// รังสีวิทยา
	{ name: 'แผนกเอกซเรย์ทั่วไป', parent: 'รังสีวิทยา' },
	{ name: 'แผนก CT Scan', parent: 'รังสีวิทยา' },
	{ name: 'แผนก MRI', parent: 'รังสีวิทยา' },
	// เภสัชกรรม
	{ name: 'เภสัชกรรมคลินิก', parent: 'เภสัชกรรม' },
	{ name: 'เภสัชกรรมโรงพยาบาล', parent: 'เภสัชกรรม' },
	{ name: 'คลังยา', parent: 'เภสัชกรรม' },
	// การเงิน
	{ name: 'งานบัญชี', parent: 'การเงินและบัญชี' },
	{ name: 'งานงบประมาณ', parent: 'การเงินและบัญชี' },
	{ name: 'งานตรวจสอบ', parent: 'การเงินและบัญชี' },
	// พัสดุ
	{ name: 'งานจัดซื้อ', parent: 'พัสดุและจัดซื้อจัดจ้าง' },
	{ name: 'งานคลังพัสดุ', parent: 'พัสดุและจัดซื้อจัดจ้าง' },
	{ name: 'งานซ่อมบำรุง', parent: 'พัสดุและจัดซื้อจัดจ้าง' },
	// แผนงาน
	{ name: 'งานยุทธศาสตร์', parent: 'แผนงานและประเมินผล' },
	{ name: 'งานติดตามประเมินผล', parent: 'แผนงานและประเมินผล' },
	{ name: 'งานสารสนเทศ', parent: 'แผนงานและประเมินผล' },
	// IT
	{ name: 'งานพัฒนาระบบ', parent: 'เทคโนโลยีสารสนเทศ' },
	{ name: 'งานเครือข่าย', parent: 'เทคโนโลยีสารสนเทศ' },
	{ name: 'งานช่วยเหลือผู้ใช้', parent: 'เทคโนโลยีสารสนเทศ' },
	// ทรัพยากรบุคคล
	{ name: 'งานสรรหา', parent: 'ทรัพยากรบุคคล' },
	{ name: 'งานพัฒนาบุคลากร', parent: 'ทรัพยากรบุคคล' },
	{ name: 'งานสวัสดิการ', parent: 'ทรัพยากรบุคคล' }
];

// ──────────────────────────────────────────────
// Plan templates
// ──────────────────────────────────────────────
const parentPlanTemplates = [
	{ title: 'แผนพัฒนาระบบบริการสุขภาพ', type: 'EXPENSE' as const },
	{ title: 'แผนจัดซื้อครุภัณฑ์การแพทย์', type: 'EXPENSE' as const },
	{ title: 'แผนพัฒนาบุคลากร', type: 'EXPENSE' as const },
	{ title: 'แผนพัฒนาระบบเทคโนโลยีสารสนเทศ', type: 'EXPENSE' as const },
	{ title: 'แผนปรับปรุงโครงสร้างพื้นฐาน', type: 'EXPENSE' as const },
	{ title: 'แผนส่งเสริมสุขภาพชุมชน', type: 'EXPENSE' as const },
	{ title: 'แผนป้องกันควบคุมโรค', type: 'EXPENSE' as const },
	{ title: 'แผนพัฒนาระบบยาและเวชภัณฑ์', type: 'EXPENSE' as const },
	{ title: 'แผนเพิ่มประสิทธิภาพการบริหาร', type: 'EXPENSE' as const },
	{ title: 'แผนรายได้เงินบำรุง', type: 'INCOME' as const }
];

const childPlanTemplates = [
	'จัดซื้ออุปกรณ์ทางการแพทย์',
	'อบรมพัฒนาทักษะบุคลากร',
	'ปรับปรุงระบบเครือข่ายคอมพิวเตอร์',
	'ซ่อมบำรุงอาคารสถานที่',
	'จัดซื้อยาและเวชภัณฑ์',
	'พัฒนาระบบสารสนเทศโรงพยาบาล',
	'จัดซื้อครุภัณฑ์สำนักงาน',
	'โครงการส่งเสริมสุขภาพประชาชน',
	'ปรับปรุงระบบไฟฟ้าและน้ำประปา',
	'จัดซื้อวัสดุทางการแพทย์',
	'อบรมเชิงปฏิบัติการ',
	'พัฒนาระบบฐานข้อมูล',
	'ซ่อมบำรุงเครื่องมือแพทย์',
	'จัดซื้ออุปกรณ์คอมพิวเตอร์',
	'โครงการรณรงค์ป้องกันโรค'
];

async function seed() {
	console.log('🌱 Seeding database...');

	// ──────────────────────────────────────────
	// 0. Hire Types (idempotent)
	// ──────────────────────────────────────────
	let hireTypeList = await db.select().from(schema.hireTypes);
	if (hireTypeList.length === 0) {
		hireTypeList = await db
			.insert(schema.hireTypes)
			.values([
				{ name: 'ข้าราชการ' },
				{ name: 'พนักงานราชการ' },
				{ name: 'ลูกจ้างประจำ' },
				{ name: 'พนักงานจ้างตามภารกิจ' },
				{ name: 'พนักงานจ้างทั่วไป' }
			])
			.returning();
		console.log('✅ Hire types seeded');
	} else {
		console.log('ℹ️  Hire types already exist');
	}

	// ──────────────────────────────────────────
	// 1. Provinces (idempotent)
	// ──────────────────────────────────────────
	let provinces = await db.select().from(schema.provinces);
	if (provinces.length === 0) {
		provinces = await db
			.insert(schema.provinces)
			.values([{ name: 'ร้อยเอ็ด' }, { name: 'ขอนแก่น' }, { name: 'กรุงเทพมหานคร' }])
			.returning();
		console.log('✅ Provinces seeded');
	} else {
		console.log('ℹ️  Provinces already exist');
	}

	// ──────────────────────────────────────────
	// 2. Agencies (idempotent)
	// ──────────────────────────────────────────
	let agencies = await db.select().from(schema.agencies);
	if (agencies.length === 0) {
		agencies = await db
			.insert(schema.agencies)
			.values([
				{
					name: 'โรงพยาบาลร้อยเอ็ด',
					agency_type: 'โรงพยาบาล',
					province_id: provinces[0].id
				}
			])
			.returning();
		console.log('✅ Agencies seeded');
	} else {
		console.log('ℹ️  Agencies already exist');
	}

	const hospital = agencies[0];

	// ──────────────────────────────────────────
	// 3. Roles (idempotent)
	// ──────────────────────────────────────────
	let roles = await db.select().from(schema.roles);
	if (roles.length === 0) {
		roles = await db
			.insert(schema.roles)
			.values([
				// ─── 1. ผู้อำนวยการ (Director) — Step 5: DIRECTOR_APPROVE ───
				{
					name: 'ผู้อำนวยการ',
					permissions: {
						system: { can_manage_users: true, can_manage_org_units: true },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: true },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: true },
						finance: { can_view_dika: true, can_create_dika: true, can_approve_dika: true },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 2. รองผู้อำนวยการ (Deputy Director) ───
				{
					name: 'รองผู้อำนวยการ',
					permissions: {
						system: { can_manage_users: true, can_manage_org_units: true },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: false },
						finance: { can_view_dika: true, can_create_dika: true, can_approve_dika: false },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 3. หัวหน้าแผนก (Division Head) — Step 2: HEAD_APPROVE ───
				{
					name: 'หัวหน้าแผนก',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: true },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: true },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 4. เจ้าหน้าที่ประจำแผนก (Division Staff) — Step 1: DIVISION_DRAFT ───
				{
					name: 'เจ้าหน้าที่ประจำแผนก',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: true, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 5. หัวหน้าแผนกแผนงาน (Planning Head) — Step 4: PLANNER_DIRECTOR_APPROVE ───
				{
					name: 'หัวหน้าแผนกแผนงาน',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: true },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: true },
						procurement: { can_view_document: true, can_create_document: false, can_approve_document: true },
						finance: { can_view_dika: true, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 6. เจ้าหน้าที่แผนงาน (Planning Officer) — Step 3: PLANNER_CHECK ───
				{
					name: 'เจ้าหน้าที่แผนงาน',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: false, can_approve_document: true },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 7. หัวหน้าเจ้าหน้าที่พัสดุ (Procurement Head) — Execution phase ───
				{
					name: 'หัวหน้าเจ้าหน้าที่พัสดุ',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: true, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: true },
						finance: { can_view_dika: true, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 8. เจ้าหน้าที่พัสดุ (Procurement Officer) — Execution phase ───
				{
					name: 'เจ้าหน้าที่พัสดุ',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: true, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 9. หัวหน้ากองคลัง (Finance Head) ───
				{
					name: 'หัวหน้ากองคลัง',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: true, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: true, can_create_dika: true, can_approve_dika: true },
						audit: { can_view_audit_trail: true }
					}
				},
				// ─── 10. เจ้าหน้าที่การเงิน (Finance Officer) ───
				{
					name: 'เจ้าหน้าที่การเงิน',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: false, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: true, can_create_dika: true, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 11. แพทย์ (Doctor) — committee member ───
				{
					name: 'แพทย์',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: false, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 12. พยาบาล (Nurse) — committee member ───
				{
					name: 'พยาบาล',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: false, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 13. นักวิชาการ (Specialist) — committee member ───
				{
					name: 'นักวิชาการ',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
				// ─── 14. เจ้าหน้าที่ธุรการ (Admin) ───
				{
					name: 'เจ้าหน้าที่ธุรการ',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: false, can_create_document: false, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				}
			])
			.returning();
		console.log('✅ Roles seeded');
	} else {
		console.log('ℹ️  Roles already exist');
	}

	// ──────────────────────────────────────────
	// 4. Super Admin user (idempotent)
	// ──────────────────────────────────────────
	const existingSuperAdmins = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.is_super_admin, true));

	if (existingSuperAdmins.length === 0) {
		const superAdminHash = await hash('admin1234');
		await db.insert(schema.users).values({
			password_hash: superAdminHash,
			agency_id: null,
			id_card: '0000000000000',
			position: 'ผู้ดูแลระบบ',
			position_rank: 'Super Admin',
			name: 'ผู้ดูแลระบบสูงสุด',
			email: 'admin@prosync.go.th',
			is_super_admin: true,
			must_change_password: false,
			profile_completed: true
		});
		console.log('✅ Super Admin created (email: admin@prosync.go.th, password: admin1234)');
	} else {
		console.log('ℹ️  Super Admin already exists');
	}

	// ──────────────────────────────────────────
	// 5. Banks (idempotent)
	// ──────────────────────────────────────────
	// All Thai banks (21 banks) — using thai-banks-logo API icons
	const logoBase = 'https://raw.githubusercontent.com/casperstack/thai-banks-logo/master/icons';
	const allBankData = [
		{ bank_code: 'BBL', name: 'ธนาคารกรุงเทพ', logo_url: `${logoBase}/BBL.png` },
		{ bank_code: 'KBANK', name: 'ธนาคารกสิกรไทย', logo_url: `${logoBase}/KBANK.png` },
		{ bank_code: 'KTB', name: 'ธนาคารกรุงไทย', logo_url: `${logoBase}/KTB.png` },
		{ bank_code: 'SCB', name: 'ธนาคารไทยพาณิชย์', logo_url: `${logoBase}/SCB.png` },
		{ bank_code: 'TTB', name: 'ธนาคารทีเอ็มบีธนชาต', logo_url: `${logoBase}/TTB.png` },
		{ bank_code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', logo_url: `${logoBase}/BAY.png` },
		{ bank_code: 'KKP', name: 'ธนาคารเกียรตินาคินภัทร', logo_url: `${logoBase}/KKP.png` },
		{ bank_code: 'CIMB', name: 'ธนาคารซีไอเอ็มบี', logo_url: `${logoBase}/CIMB.png` },
		{ bank_code: 'TISCO', name: 'ธนาคารทิสโก้', logo_url: `${logoBase}/TISCO.png` },
		{ bank_code: 'UOB', name: 'ธนาคารยูโอบี', logo_url: `${logoBase}/UOB.png` },
		{ bank_code: 'LHB', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', logo_url: `${logoBase}/LHB.png` },
		{ bank_code: 'ICBC', name: 'ธนาคารไอซีบีซี', logo_url: `${logoBase}/ICBC.png` },
		{ bank_code: 'GSB', name: 'ธนาคารออมสิน', logo_url: `${logoBase}/GSB.png` },
		{ bank_code: 'BAAC', name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', logo_url: `${logoBase}/BAAC.png` },
		{ bank_code: 'GHB', name: 'ธนาคารอาคารสงเคราะห์', logo_url: `${logoBase}/GHB.png` },
		{ bank_code: 'HSBC', name: 'ธนาคารเอชเอสบีซี', logo_url: `${logoBase}/HSBC.png` },
		{ bank_code: 'IBANK', name: 'ธนาคารอิสลามแห่งประเทศไทย', logo_url: `${logoBase}/IBANK.png` },
		{ bank_code: 'CITI', name: 'ธนาคารซิตี้แบงก์', logo_url: `${logoBase}/CITI.png` },
		{ bank_code: 'TCRB', name: 'ธนาคารไทยเครดิต', logo_url: `${logoBase}/TCRB.png` },
		{ bank_code: 'PromptPay', name: 'พร้อมเพย์', logo_url: `${logoBase}/PromptPay.png` },
		{ bank_code: 'TrueMoney', name: 'ทรูมันนี่', logo_url: `${logoBase}/TrueMoney.png` },
	];
	const existingBanks = await db.select().from(schema.bank);
	const existingCodes = new Set(existingBanks.map((b) => b.bank_code));
	const missingBanks = allBankData.filter((b) => !existingCodes.has(b.bank_code));
	if (missingBanks.length > 0) {
		await db.insert(schema.bank).values(missingBanks);
		console.log(`✅ Banks: inserted ${missingBanks.length} missing (total ${existingBanks.length + missingBanks.length})`);
	} else {
		console.log(`ℹ️  Banks: all ${existingBanks.length} present`);
	}
	let banks = await db.select().from(schema.bank);

	// ──────────────────────────────────────────
	// 6. V2 Flow — ไม่ใช้ workflow steps อีกต่อไป
	//    วิธีจัดซื้อ 5 แบบกำหนดผ่าน procurement_method ในตาราง documents
	//    เอกสารที่ต้องจัดทำกำหนดใน BILL_SECTION_LABELS (src/lib/types/procurement.ts)
	//    ขั้นตอนอนุมัติ 5 ขั้นตอนกำหนดใน approval-flow.ts
	// ──────────────────────────────────────────
	// V2 Flow Reference:
	//   Document Types: type1_nParcel, type2_iParcelUtil, type3_iParcel, type4_iFinance, type5_project
	//   Procurement Methods: specific_lte100k, specific_gt100k, selection, e_bidding, e_market
	//   Approval: DIVISION_DRAFT → HEAD_APPROVE → PLANNER_CHECK → PLANNER_DIRECTOR_APPROVE → DIRECTOR_APPROVE
	//   Execution: Consolidated bill form (1 step) → Finance (dika)

	let workflows = await db.select().from(schema.workflows);
	if (workflows.length === 0) {
		// Keep workflow table for reference/legacy compat but no steps needed
		workflows = await db
			.insert(schema.workflows)
			.values([
				{ name: 'วิธีเฉพาะเจาะจง (ไม่เกิน 100,000 บาท)', total_steps: 1, agency_id: null },
				{ name: 'วิธีเฉพาะเจาะจง (เกิน 100,000 - 500,000 บาท)', total_steps: 1, agency_id: null },
				{ name: 'วิธีคัดเลือก', total_steps: 1, agency_id: null },
				{ name: 'วิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)', total_steps: 1, agency_id: null },
				{ name: 'วิธีตลาดอิเล็กทรอนิกส์ (e-market)', total_steps: 1, agency_id: null }
			])
			.returning();
		console.log('✅ Workflows seeded (5 วิธี — V2: consolidated bill form)');
		// V2: ไม่ seed workflow steps — ทุกอย่างใช้ consolidated bill form (1 ขั้นตอน)
	} else {
		console.log('ℹ️  Workflows already exist');
	}

	// ──────────────────────────────────────────
	// 7. Fiscal Year (idempotent)
	// ──────────────────────────────────────────
	let fiscalYears = await db.select().from(schema.fiscalYears);
	if (fiscalYears.length === 0) {
		fiscalYears = await db
			.insert(schema.fiscalYears)
			.values({
				agency_id: hospital.id,
				year_name: '2569',
				is_active: true
			})
			.returning();
		console.log('✅ Fiscal Year seeded');
	} else {
		console.log('ℹ️  Fiscal Years already exist');
	}
	const fiscalYear = fiscalYears[0];

	// ──────────────────────────────────────────
	// 8. Org Units (idempotent)
	// ──────────────────────────────────────────
	let orgUnits = await db.select().from(schema.orgUnits);
	if (orgUnits.length === 0) {
		// Root unit
		const [rootUnit] = await db
			.insert(schema.orgUnits)
			.values({
				agency_id: hospital.id,
				name: 'คณะกรรมการบริหารโรงพยาบาลร้อยเอ็ด',
				parent_id: null,
				head_of_unit_id: null
			})
			.returning();

		// Department-level units (parents)
		const parentUnitNames = [
			'ศัลยกรรม',
			'อายุรกรรม',
			'กุมารเวชกรรม',
			'สูติ-นรีเวชกรรม',
			'จักษุวิทยา',
			'โสต ศอ นาสิก',
			'ออร์โธปิดิกส์',
			'วิสัญญีวิทยา',
			'รังสีวิทยา',
			'เภสัชกรรม',
			'การเงินและบัญชี',
			'พัสดุและจัดซื้อจัดจ้าง',
			'แผนงานและประเมินผล',
			'เทคโนโลยีสารสนเทศ',
			'ทรัพยากรบุคคล'
		];

		const parentUnits = await db
			.insert(schema.orgUnits)
			.values(
				parentUnitNames.map((name) => ({
					agency_id: hospital.id,
					name,
					parent_id: rootUnit.id,
					head_of_unit_id: null
				}))
			)
			.returning();

		// Sub-units
		const parentUnitMap = new Map(parentUnits.map((u) => [u.name, u.id]));

		const subUnits = await db
			.insert(schema.orgUnits)
			.values(
				departmentUnits.map((du) => ({
					agency_id: hospital.id,
					name: du.name,
					parent_id: parentUnitMap.get(du.parent) || rootUnit.id,
					head_of_unit_id: null
				}))
			)
			.returning();

		orgUnits = [rootUnit, ...parentUnits, ...subUnits];
		console.log(`✅ Org Units seeded (${orgUnits.length} units)`);
	} else {
		console.log('ℹ️  Org Units already exist');
	}

	// ──────────────────────────────────────────
	// 9. Named workflow users + sample users
	// ──────────────────────────────────────────
	const existingUsers = await db.select().from(schema.users);
	const existingCount = existingUsers.filter((u) => !u.is_super_admin).length;
	const roleMap = new Map(roles.map((r) => [r.name, r.id]));
	const rootUnit = orgUnits.find((u) => u.parent_id === null)!;
	const procurementUnit = orgUnits.find((u) => u.name === 'พัสดุและจัดซื้อจัดจ้าง');
	const financeUnit = orgUnits.find((u) => u.name === 'การเงินและบัญชี');
	const planningUnit = orgUnits.find((u) => u.name === 'แผนงานและประเมินผล');
	const surgeryUnit = orgUnits.find((u) => u.name === 'ศัลยกรรม');
	const medicineUnit = orgUnits.find((u) => u.name === 'อายุรกรรม');
	const pediatricUnit = orgUnits.find((u) => u.name === 'กุมารเวชกรรม');
	const pharmacyUnit = orgUnits.find((u) => u.name === 'เภสัชกรรม');
	const itUnit = orgUnits.find((u) => u.name === 'เทคโนโลยีสารสนเทศ');
	const subUnits = orgUnits.filter((u) => u.parent_id !== null);

	if (existingCount < 30) {
		const passwordHash = await hash('password1234');

		// ── Named users for the v2 procurement workflow ──
		// Flow: Division Staff (draft) → Division Head (approve) → Planner (check) → Planning Head (recommend) → Director (approve)
		const namedUsers = [
			// ─── Executive Level ───
			{ name: 'นพ.สมชาย สุขใจ', email: 'director@hospital.go.th', position: 'นพ.', positionRank: 'ผู้อำนวยการโรงพยาบาล', roleName: 'ผู้อำนวยการ', orgUnit: rootUnit, idCard: '1100100010001' },
			{ name: 'นางสมหญิง ดีงาม', email: 'vice-director@hospital.go.th', position: 'นาง', positionRank: 'รองผู้อำนวยการฝ่ายบริหาร', roleName: 'รองผู้อำนวยการ', orgUnit: rootUnit, idCard: '1100100010002' },

			// ─── Division Heads (Step 2: HEAD_APPROVE) ───
			{ name: 'นพ.ชัยวัฒน์ แก้วมณี', email: 'head-surgery@hospital.go.th', position: 'นพ.', positionRank: 'หัวหน้ากลุ่มงานศัลยกรรม', roleName: 'หัวหน้าแผนก', orgUnit: surgeryUnit || subUnits[0], idCard: '1100100010011' },
			{ name: 'นพ.สุรชัย ศิริวัฒน์', email: 'head-medicine@hospital.go.th', position: 'นพ.', positionRank: 'หัวหน้ากลุ่มงานอายุรกรรม', roleName: 'หัวหน้าแผนก', orgUnit: medicineUnit || subUnits[1], idCard: '1100100010012' },
			{ name: 'พญ.นิตยา ทองดี', email: 'head-pediatric@hospital.go.th', position: 'พญ.', positionRank: 'หัวหน้ากลุ่มงานกุมารเวชกรรม', roleName: 'หัวหน้าแผนก', orgUnit: pediatricUnit || subUnits[2], idCard: '1100100010013' },
			{ name: 'ภก.พิชัย สมบูรณ์', email: 'head-pharmacy@hospital.go.th', position: 'ภก.', positionRank: 'หัวหน้ากลุ่มงานเภสัชกรรม', roleName: 'หัวหน้าแผนก', orgUnit: pharmacyUnit || subUnits[3], idCard: '1100100010014' },

			// ─── Division Staff (Step 1: DIVISION_DRAFT) ───
			{ name: 'นางรัตนา จันทร์เพ็ญ', email: 'staff-surgery@hospital.go.th', position: 'นาง', positionRank: 'เจ้าพนักงานธุรการชำนาญงาน', roleName: 'เจ้าหน้าที่ประจำแผนก', orgUnit: surgeryUnit || subUnits[0], idCard: '1100100010015' },
			{ name: 'นายอนุชา เจริญรุ่ง', email: 'staff-medicine@hospital.go.th', position: 'นาย', positionRank: 'เจ้าพนักงานธุรการชำนาญงาน', roleName: 'เจ้าหน้าที่ประจำแผนก', orgUnit: medicineUnit || subUnits[1], idCard: '1100100010016' },
			{ name: 'นางสาวมาลี แสงทอง', email: 'staff-pediatric@hospital.go.th', position: 'นางสาว', positionRank: 'เจ้าพนักงานธุรการชำนาญงาน', roleName: 'เจ้าหน้าที่ประจำแผนก', orgUnit: pediatricUnit || subUnits[2], idCard: '1100100010017' },
			{ name: 'นางสาวสมพร บุญมี', email: 'staff-pharmacy@hospital.go.th', position: 'นางสาว', positionRank: 'เจ้าพนักงานเภสัชกรรมชำนาญงาน', roleName: 'เจ้าหน้าที่ประจำแผนก', orgUnit: pharmacyUnit || subUnits[3], idCard: '1100100010018' },

			// ─── Planning Unit (Steps 3 & 4: PLANNER_CHECK & PLANNER_DIRECTOR_APPROVE) ───
			{ name: 'นางวรรณา มั่นคง', email: 'planning-head@hospital.go.th', position: 'นาง', positionRank: 'หัวหน้ากลุ่มงานแผนงานและประเมินผล', roleName: 'หัวหน้าแผนกแผนงาน', orgUnit: planningUnit || subUnits[5], idCard: '1100100010019' },
			{ name: 'นายสมศักดิ์ รักไทย', email: 'planner1@hospital.go.th', position: 'นาย', positionRank: 'นักวิเคราะห์นโยบายและแผนชำนาญการ', roleName: 'เจ้าหน้าที่แผนงาน', orgUnit: planningUnit || subUnits[5], idCard: '1100100010020' },
			{ name: 'นางสาวนภา พงษ์พันธ์', email: 'planner2@hospital.go.th', position: 'นางสาว', positionRank: 'นักวิเคราะห์นโยบายและแผนปฏิบัติการ', roleName: 'เจ้าหน้าที่แผนงาน', orgUnit: planningUnit || subUnits[5], idCard: '1100100010021' },

			// ─── Procurement Unit (Execution phase — after approval) ───
			{ name: 'นายวิชัย ศรีสุข', email: 'procurement-head@hospital.go.th', position: 'นาย', positionRank: 'หัวหน้าเจ้าหน้าที่พัสดุ', roleName: 'หัวหน้าเจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010003' },
			{ name: 'นางสุภาพ วงศ์สวัสดิ์', email: 'procurement1@hospital.go.th', position: 'นาง', positionRank: 'เจ้าพนักงานพัสดุชำนาญงาน', roleName: 'เจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010004' },
			{ name: 'นายประเสริฐ ดีงาม', email: 'procurement2@hospital.go.th', position: 'นาย', positionRank: 'เจ้าพนักงานพัสดุชำนาญงาน', roleName: 'เจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010005' },

			// ─── Finance Unit ───
			{ name: 'นางนภา ศรีสุข', email: 'finance-head@hospital.go.th', position: 'นาง', positionRank: 'หัวหน้ากองคลัง', roleName: 'หัวหน้ากองคลัง', orgUnit: financeUnit || subUnits[1], idCard: '1100100010006' },
			{ name: 'นายธนพล สุขใจ', email: 'finance1@hospital.go.th', position: 'นาย', positionRank: 'นักวิชาการเงินและบัญชีชำนาญการ', roleName: 'เจ้าหน้าที่การเงิน', orgUnit: financeUnit || subUnits[1], idCard: '1100100010007' },

			// ─── Committee Members ───
			{ name: 'นางอรุณี รักไทย', email: 'committee1@hospital.go.th', position: 'นาง', positionRank: 'พยาบาลวิชาชีพชำนาญการพิเศษ', roleName: 'พยาบาล', orgUnit: subUnits[2], idCard: '1100100010008' },
			{ name: 'นายกิตติ พงษ์พันธ์', email: 'committee2@hospital.go.th', position: 'นาย', positionRank: 'เภสัชกรชำนาญการ', roleName: 'นักวิชาการ', orgUnit: subUnits[3], idCard: '1100100010009' },
			{ name: 'นางพิมพ์ใจ วงศ์สวัสดิ์', email: 'committee3@hospital.go.th', position: 'นาง', positionRank: 'นักวิชาการคอมพิวเตอร์ชำนาญการ', roleName: 'นักวิชาการ', orgUnit: itUnit || subUnits[4], idCard: '1100100010010' }
		];

		const createdNamedUsers: { id: number; name: string; email: string }[] = [];

		for (const nu of namedUsers) {
			const existing = existingUsers.find((u) => u.id_card === nu.idCard);
			if (existing) {
				createdNamedUsers.push({ id: existing.id, name: existing.name, email: existing.email || '' });
				continue;
			}

			const [user] = await db
				.insert(schema.users)
				.values({
					password_hash: passwordHash,
					agency_id: hospital.id,
					id_card: nu.idCard,
					position: nu.position,
					position_rank: nu.positionRank,
					name: nu.name,
					email: nu.email,
					phone: `08${randomInt(10000000, 99999999)}`,
					is_super_admin: false,
					must_change_password: false,
					profile_completed: true
				})
				.returning();

			createdNamedUsers.push({ id: user.id, name: user.name, email: nu.email });

			const roleId = roleMap.get(nu.roleName);
			if (roleId && nu.orgUnit) {
				await db.insert(schema.userAssignments).values({
					user_id: user.id,
					role_id: roleId,
					org_unit_id: nu.orgUnit.id,
					is_primary_unit: true
				});
			}
		}

		// ── Set head_of_unit for all key org units ──
		const headMappings: { email: string; unit: typeof rootUnit | undefined }[] = [
			{ email: 'director@hospital.go.th', unit: rootUnit },
			{ email: 'head-surgery@hospital.go.th', unit: surgeryUnit },
			{ email: 'head-medicine@hospital.go.th', unit: medicineUnit },
			{ email: 'head-pediatric@hospital.go.th', unit: pediatricUnit },
			{ email: 'head-pharmacy@hospital.go.th', unit: pharmacyUnit },
			{ email: 'planning-head@hospital.go.th', unit: planningUnit },
			{ email: 'procurement-head@hospital.go.th', unit: procurementUnit },
			{ email: 'finance-head@hospital.go.th', unit: financeUnit },
		];

		for (const hm of headMappings) {
			const headUser = createdNamedUsers.find((u) => u.email === hm.email);
			if (headUser && hm.unit) {
				await db.update(schema.orgUnits).set({ head_of_unit_id: headUser.id }).where(eq(schema.orgUnits.id, hm.unit.id));
			}
		}

		console.log(`✅ Named workflow users created (${createdNamedUsers.length} users)`);

		// ── Additional random users to fill to 30 ──
		const remainingCount = 30 - existingCount - createdNamedUsers.length;
		if (remainingCount > 0) {
			const roleNames = ['แพทย์', 'พยาบาล', 'นักวิชาการ', 'เจ้าหน้าที่ธุรการ'];
			for (let i = 0; i < remainingCount; i++) {
				const firstName = firstNames[(i + 10) % firstNames.length];
				const lastName = lastNames[(i + 10) % lastNames.length];
				const position = positions[(i + 4) % positions.length];
				const positionRank = positionRanks[(i + 4) % positionRanks.length];
				const roleName = roleNames[i % roleNames.length];
				const roleId = roleMap.get(roleName);
				const orgUnit = subUnits[(i + 5) % subUnits.length];
				const idCard = `1${String(345678901234 + existingCount + createdNamedUsers.length + i).padStart(12, '0')}`;

				const [user] = await db
					.insert(schema.users)
					.values({
						password_hash: passwordHash,
						agency_id: hospital.id,
						id_card: idCard,
						position,
						position_rank: positionRank,
						name: `${firstName} ${lastName}`,
						email: `user${existingCount + createdNamedUsers.length + i + 1}@hospital.go.th`,
						phone: `08${randomInt(10000000, 99999999)}`,
						is_super_admin: false,
						must_change_password: false,
						profile_completed: true
					})
					.returning();

				if (roleId && orgUnit) {
					await db.insert(schema.userAssignments).values({
						user_id: user.id,
						role_id: roleId,
						org_unit_id: orgUnit.id,
						is_primary_unit: true
					});
				}
			}
			console.log(`✅ Additional users created (${remainingCount} random users)`);
		}
	} else {
		console.log('ℹ️  Users already exist (20+ users)');
	}

	// ──────────────────────────────────────────
	// 10a. Bank Account Types (idempotent)
	// ──────────────────────────────────────────
	let baTypes = await db.select().from(schema.bankAccountTypes);
	if (baTypes.length === 0) {
		baTypes = await db.insert(schema.bankAccountTypes).values([
			{ name: 'บัญชีออมทรัพย์' },
			{ name: 'บัญชีกระแสรายวัน' },
			{ name: 'บัญชีฝากประจำ' },
			{ name: 'บัญชีเงินบำรุง' },
			{ name: 'บัญชีงบประมาณ' }
		]).returning();
		console.log('✅ Bank Account Types seeded');
	}

	const baTypeMap = Object.fromEntries(baTypes.map((t) => [t.name, t.id]));

	// ──────────────────────────────────────────
	// 10b. Bank Accounts (idempotent)
	// ──────────────────────────────────────────
	let bankAccounts = await db.select().from(schema.bankAccounts);
	if (bankAccounts.length === 0) {
		const ktbBank = banks.find((b) => b.bank_code === 'KTB') || banks[0];
		bankAccounts = await db
			.insert(schema.bankAccounts)
			.values([
				{
					agency_id: hospital.id,
					bank_id: ktbBank.id,
					account_type_id: baTypeMap['บัญชีเงินบำรุง'],
					account_name: 'บัญชีเงินบำรุง',
					account_number: '123-4-56789-0',
					balance: '5000000.00',
					is_tax_pool: false
				},
				{
					agency_id: hospital.id,
					bank_id: ktbBank.id,
					account_type_id: baTypeMap['บัญชีกระแสรายวัน'],
					account_name: 'บัญชีพักหักภาษี',
					account_number: '123-4-56789-1',
					balance: '0.00',
					is_tax_pool: true
				}
			])
			.returning();
		console.log('✅ Bank Accounts seeded');
	} else {
		console.log('ℹ️  Bank Accounts already exist');
	}

	// ──────────────────────────────────────────
	// 11a. Median Price Categories & Units (idempotent)
	// ──────────────────────────────────────────
	let mpCategories = await db.select().from(schema.medianPriceCategories);
	if (mpCategories.length === 0) {
		mpCategories = await db.insert(schema.medianPriceCategories).values([
			{ name: 'เวชภัณฑ์' },
			{ name: 'ครุภัณฑ์การแพทย์' },
			{ name: 'วัสดุสำนักงาน' },
			{ name: 'วัสดุการแพทย์' },
			{ name: 'วัสดุงานบ้านงานครัว' },
			{ name: 'ครุภัณฑ์สำนักงาน' },
			{ name: 'ครุภัณฑ์คอมพิวเตอร์' }
		]).returning();
		console.log('✅ Median Price Categories seeded');
	}

	let mpUnits = await db.select().from(schema.medianPriceUnits);
	if (mpUnits.length === 0) {
		mpUnits = await db.insert(schema.medianPriceUnits).values([
			{ name: 'ชิ้น' },
			{ name: 'กล่อง' },
			{ name: 'ลัง' },
			{ name: 'เครื่อง' },
			{ name: 'ชุด' },
			{ name: 'รายการ' },
			{ name: 'ขวด' },
			{ name: 'แผ่น' },
			{ name: 'ม้วน' },
			{ name: 'รีม' }
		]).returning();
		console.log('✅ Median Price Units seeded');
	}

	// ──────────────────────────────────────────
	// 11b. Median Prices (idempotent)
	// ──────────────────────────────────────────
	const catMap = Object.fromEntries(mpCategories.map((c) => [c.name, c.id]));
	const unitMap = Object.fromEntries(mpUnits.map((u) => [u.name, u.id]));

	const existingPrices = await db.select().from(schema.medianPrices);
	if (existingPrices.length === 0) {
		await db.insert(schema.medianPrices).values([
			{
				category_id: catMap['เวชภัณฑ์'],
				item_name: 'ยาสามัญประจำโรงพยาบาล',
				unit_id: unitMap['รายการ'],
				price: '150000.00',
				province_id: provinces[0].id,
				effective_date: '2026-01-01'
			},
			{
				category_id: catMap['ครุภัณฑ์การแพทย์'],
				item_name: 'เครื่อง X-Ray ดิจิตอล',
				unit_id: unitMap['เครื่อง'],
				price: '3500000.00',
				province_id: provinces[0].id,
				effective_date: '2026-01-01'
			},
			{
				category_id: catMap['วัสดุสำนักงาน'],
				item_name: 'กระดาษ A4',
				unit_id: unitMap['ลัง'],
				price: '850.00',
				province_id: provinces[0].id,
				effective_date: '2026-01-01'
			}
		]);
		console.log('✅ Median Prices seeded');
	} else {
		console.log('ℹ️  Median Prices already exist');
	}

	// ──────────────────────────────────────────
	// 12. Plans (50 total: 10 parent + 40 child)
	// ──────────────────────────────────────────
	const existingPlans = await db.select().from(schema.plans);

	if (existingPlans.length < 50) {
		// ── Parent departments (level 1 under root) — for parent plans ──
		const parentDepartments = orgUnits.filter((u) => u.parent_id === rootUnit.id);

		// ── Build a map: parent department id → its sub-units ──
		const subUnitsByParent = new Map<number, typeof orgUnits>();
		for (const dept of parentDepartments) {
			const children = orgUnits.filter((u) => u.parent_id === dept.id);
			subUnitsByParent.set(dept.id, children);
		}

		// Create 10 parent plans — each assigned to a PARENT department
		const parentPlans = await db
			.insert(schema.plans)
			.values(
				parentPlanTemplates.map((template, idx) => {
					const responsibleDept = parentDepartments[idx % parentDepartments.length];
					const estimatedAmount =
						template.type === 'INCOME'
							? randomAmount(5000000, 20000000)
							: randomAmount(2000000, 15000000);
					const actualAmount = randomAmount(0, Number(estimatedAmount) * 0.8);

					return {
						agency_id: hospital.id,
						fiscal_year_id: fiscalYear.id,
						title: template.title,
						parent_id: null,
						responsible_unit_id: responsibleDept?.id || null,
						start_date: '2025-10-01',
						end_date: '2026-09-30',
						duration_text: '12 เดือน',
						expected_outputs: JSON.stringify({
							outputs: [`ผลลัพธ์ของ${template.title}`]
						}),
						description: `รายละเอียด${template.title} ประจำปีงบประมาณ ${fiscalYear.year_name}`,
						stakeholder_unit_ids: JSON.stringify([]),
						is_leaf_node: false,
						plan_type: template.type,
						estimated_amount: estimatedAmount,
						actual_amount: actualAmount
					};
				})
			)
			.returning();

		// Create 40 child plans (4 per parent)
		// Child plans MUST be assigned to sub-units under the parent plan's department
		const childPlans = [];
		for (const parentPlan of parentPlans) {
			// Get sub-units of the parent plan's responsible department
			const parentDeptId = parentPlan.responsible_unit_id;
			const availableSubUnits = parentDeptId ? (subUnitsByParent.get(parentDeptId) || []) : [];

			for (let i = 0; i < 4; i++) {
				const template =
					childPlanTemplates[(parentPlan.id + i) % childPlanTemplates.length];
				// Assign to sub-unit within parent's department hierarchy
				// If no sub-units exist, fall back to the parent department itself
				const responsibleUnit = availableSubUnits.length > 0
					? availableSubUnits[i % availableSubUnits.length]
					: { id: parentDeptId };
				const estimatedAmount = randomAmount(100000, 3000000);
				const actualAmount = randomAmount(0, Number(estimatedAmount) * 0.9);

				childPlans.push({
					agency_id: hospital.id,
					fiscal_year_id: fiscalYear.id,
					title: `${template} - ${parentPlan.title}`,
					parent_id: parentPlan.id,
					responsible_unit_id: responsibleUnit?.id || null,
					start_date: '2025-10-01',
					end_date: '2026-09-30',
					duration_text: '12 เดือน',
					expected_outputs: JSON.stringify({
						outputs: [`ผลลัพธ์ของ${template}`]
					}),
					description: `รายละเอียด${template} ภายใต้${parentPlan.title}`,
					stakeholder_unit_ids: JSON.stringify([]),
					is_leaf_node: true,
					plan_type: parentPlan.plan_type,
					estimated_amount: estimatedAmount,
					actual_amount: actualAmount
				});
			}
		}

		await db.insert(schema.plans).values(childPlans);

		console.log(
			`✅ Plans seeded (${parentPlans.length} parent + ${childPlans.length} child = ${parentPlans.length + childPlans.length} total)`
		);
		console.log('   ℹ️  Child plans assigned to sub-units under parent plan\'s responsible department');
	} else {
		console.log('ℹ️  Plans already exist (50+ plans)');
	}

	// ──────────────────────────────────────────
	// 13a. Vendor Types (idempotent)
	// ──────────────────────────────────────────
	let vendorTypeList = await db.select().from(schema.vendorTypes);
	if (vendorTypeList.length === 0) {
		vendorTypeList = await db.insert(schema.vendorTypes).values([
			{ name: 'นิติบุคคล' },
			{ name: 'บุคคลธรรมดา' },
			{ name: 'ห้างหุ้นส่วนจำกัด' },
			{ name: 'บริษัทมหาชน' }
		]).returning();
		console.log('✅ Vendor Types seeded');
	}

	const vtMap = Object.fromEntries(vendorTypeList.map((v) => [v.name, v.id]));

	// ──────────────────────────────────────────
	// 13b. Vendors (idempotent)
	// ──────────────────────────────────────────
	let vendors = await db.select().from(schema.vendors);
	if (vendors.length === 0) {
		const vendorNames = [
			'บริษัท อุปกรณ์การแพทย์ จำกัด',
			'ห้างหุ้นส่วน ยาดีเวชภัณฑ์',
			'บริษัท เทคโนโลยีสุขภาพ จำกัด',
			'ร้าน ครุภัณฑ์การแพทย์',
			'บริษัท ก่อสร้างมั่นคง จำกัด',
			'ห้างหุ้นส่วน คอมพิวเตอร์สมัยใหม่',
			'บริษัท วัสดุสำนักงานไทย จำกัด',
			'ร้าน เฟอร์นิเจอร์คุณภาพ'
		];
		const typeNames = ['นิติบุคคล', 'บุคคลธรรมดา'];
		vendors = await db
			.insert(schema.vendors)
			.values(
				vendorNames.map((name, i) => {
					const typeName = typeNames[i % 2];
					return {
						vendor_type_id: vtMap[typeName],
						vendor_type: typeName,
						tax_id: `${String(1000000000000 + i).padStart(13, '0')}`,
						company_name: name,
						contact_person: `ผู้ติดต่อ ${i + 1}`,
						contact_email: `vendor${i + 1}@example.com`,
						contact_phone: `02${randomInt(1000000, 9999999)}`
					};
				})
			)
			.returning();
		console.log(`✅ Vendors seeded (${vendors.length} vendors)`);
	} else {
		console.log('ℹ️  Vendors already exist');
	}

	// ──────────────────────────────────────────
	// 14. Documents with proper step assignments
	// ──────────────────────────────────────────
	const existingDocs = await db.select().from(schema.documents);

	if (existingDocs.length === 0) {
		const allUsers = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(isNull(schema.users.deleted_at));
		const directorU = allUsers.find((u) => u.email === 'director@hospital.go.th');
		const planningHeadU = allUsers.find((u) => u.email === 'planning-head@hospital.go.th');
		const planner1U = allUsers.find((u) => u.email === 'planner1@hospital.go.th');
		const procHeadU = allUsers.find((u) => u.email === 'procurement-head@hospital.go.th');
		const finHeadU = allUsers.find((u) => u.email === 'finance-head@hospital.go.th');

		// Division staff & heads for workflow
		const staffSurgeryU = allUsers.find((u) => u.email === 'staff-surgery@hospital.go.th');
		const headSurgeryU = allUsers.find((u) => u.email === 'head-surgery@hospital.go.th');

		const leafPlans = await db.select().from(schema.plans).where(eq(schema.plans.is_leaf_node, true));

		if (leafPlans.length >= 30 && staffSurgeryU && directorU && vendors.length >= 3) {
			const { randomUUID } = await import('crypto');
			const now = new Date();
			const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

			const creatorId = staffSurgeryU.id;
			const headId = headSurgeryU?.id || null;
			const plannerId = planner1U?.id || null;
			const planningHeadId = planningHeadU?.id || null;
			const directorId = directorU?.id || null;
			const procHeadId = procHeadU?.id || null;
			const finHeadId = finHeadU?.id || null;
			const committee1Id = allUsers.find(u => u.email === 'committee1@hospital.go.th')?.id || null;
			const committee2Id = allUsers.find(u => u.email === 'committee2@hospital.go.th')?.id || null;
			const committee3Id = allUsers.find(u => u.email === 'committee3@hospital.go.th')?.id || null;

			let planIdx = 0;
			const nextPlan = () => leafPlans[planIdx++];

			// ── Shared helpers ──
			const makeSteps = (docId: number, approvedUpTo: number) => {
				const defs = [
					{ seq: 1, code: 'DIVISION_DRAFT', name: 'แผนกรับผิดชอบ — ร่าง', userId: creatorId },
					{ seq: 2, code: 'HEAD_APPROVE', name: 'หัวหน้าแผนก — อนุมัติ', userId: headId },
					{ seq: 3, code: 'PLANNER_CHECK', name: 'แผนกแผนงาน — ตรวจสอบ', userId: plannerId },
					{ seq: 4, code: 'PLANNER_DIRECTOR_APPROVE', name: 'หัวหน้าแผนงาน — เสนอ ผอ.', userId: planningHeadId },
					{ seq: 5, code: 'DIRECTOR_APPROVE', name: 'ผู้อำนวยการ — อนุมัติ', userId: directorId }
				];
				return defs.map(d => ({
					document_id: docId, step_sequence: d.seq, step_code: d.code, step_name: d.name,
					assigned_user_id: d.userId,
					status: d.seq <= approvedUpTo ? 'APPROVED' : (d.seq === approvedUpTo + 1 ? 'IN_PROGRESS' : 'PENDING'),
					completed_at: d.seq <= approvedUpTo ? daysAgo(5 - d.seq) : null
				}));
			};

			const fullBillPayload = {
				purchase_request: { report_pdf: '/uploads/sample/purchase_request.pdf', report_pdf_name: 'รายงานขอซื้อขอจ้าง.pdf' },
				quotation: {
					vendors: [
						{ vendor_id: vendors[0].id, company_name: vendors[0].company_name, proposed_price: '85000.00' },
						{ vendor_id: vendors[1].id, company_name: vendors[1].company_name, proposed_price: '92000.00' },
						{ vendor_id: vendors[2].id, company_name: vendors[2].company_name, proposed_price: '88500.00' }
					],
					winner_vendor_id: vendors[0].id
				},
				approval: { approval_pdf: '/uploads/sample/approval.pdf', approval_pdf_name: 'เอกสารอนุมัติ.pdf' },
				winner_announcement: { announcement_pdf: '/uploads/sample/winner.pdf', announcement_pdf_name: 'ประกาศผู้ชนะ.pdf' },
				purchase_order: { po_pdf: '/uploads/sample/po.pdf', po_pdf_name: 'ใบสั่งซื้อ.pdf' },
				inspection_committee: { committee: [{ user_id: committee1Id, role: 'ประธาน' }, { user_id: committee2Id, role: 'กรรมการ' }, { user_id: committee3Id, role: 'กรรมการ' }] },
				inspection_report: { inspection_pdf: '/uploads/sample/inspection.pdf', inspection_pdf_name: 'ใบตรวจรับ.pdf', invoice_pdf: '/uploads/sample/invoice.pdf', invoice_pdf_name: 'ใบแจ้งหนี้.pdf' }
			};

			const addBidders = async (docId: number, winnerPrice = '85000.00') => {
				await db.insert(schema.documentBidders).values([
					{ document_id: docId, vendor_id: vendors[0].id, proposed_price: winnerPrice, is_winner: true, submitted_at: daysAgo(7) },
					{ document_id: docId, vendor_id: vendors[1].id, proposed_price: '92000.00', is_winner: false, submitted_at: daysAgo(7) },
					{ document_id: docId, vendor_id: vendors[2].id, proposed_price: '88500.00', is_winner: false, submitted_at: daysAgo(7) }
				]);
			};

			const makePaymentRound = (docId: number, status: string, roundNum = 1) => {
				const pr: any = { document_id: docId, round_number: roundNum, status, current_actor_role: ['BILL_PENDING','BILL_CREATED'].includes(status) ? 'PROCUREMENT' : (['DIRECTOR_APPROVED'].includes(status) ? 'DIRECTOR' : 'FINANCE') };
				if (!['BILL_PENDING'].includes(status)) { pr.bill_payload = fullBillPayload; pr.bill_created_by = procHeadId; pr.bill_created_at = daysAgo(6); }
				if (!['BILL_PENDING','BILL_CREATED'].includes(status)) pr.sent_to_finance_at = daysAgo(5);
				if (!['BILL_PENDING','BILL_CREATED','SENT_TO_FINANCE'].includes(status)) { pr.finance_seen_at = daysAgo(4); pr.finance_seen_by = finHeadId; }
				if (['PAID','STAMPED'].includes(status)) { pr.check_no = `CHK-2569-${String(docId).padStart(3,'0')}`; pr.check_date = '2026-05-20'; pr.paid_at = daysAgo(1); pr.paid_by = finHeadId; }
				if (status === 'STAMPED') { pr.stamped_at = now; pr.stamped_by = finHeadId; }
				return pr;
			};

			// Generic doc creator
			const createDoc = async (plan: any, title: string, docType: string, procMethod: string | null, phase: string, docStatus: string, approvedSteps: number, paymentStatus: string | null, opts?: { addBids?: boolean; winnerPrice?: string }) => {
				const [doc] = await db.insert(schema.documents).values({
					slug: randomUUID(), agency_id: hospital.id, plan_id: plan.id, workflow_id: null,
					payload: { title }, status: docStatus, updated_by: creatorId,
					doc_type: docType, procurement_method: procMethod, phase
				}).returning();
				for (const s of makeSteps(doc.id, approvedSteps)) await db.insert(schema.documentApprovalSteps).values(s);
				if (paymentStatus) await db.insert(schema.paymentRounds).values(makePaymentRound(doc.id, paymentStatus));
				if (opts?.addBids !== false && (phase === 'EXECUTION' || phase === 'COMPLETED')) await addBidders(doc.id, opts?.winnerPrice);
				return doc;
			};

			// ══════════════════════════════════════════════════════════
			// TYPE 1: nParcel — ซื้อเครื่องฟอกอากาศ 50 เครื่อง
			// ตั้งงบครั้งแรก จ่ายครั้งเดียวจบ
			// Flow: procurement bill → finance → director approve dika → pay → stamp
			// ══════════════════════════════════════════════════════════
			console.log('   Seeding type1_nParcel...');
			await createDoc(nextPlan(), '[T1] รอแผนกร่าง — จัดซื้อเครื่องฟอกอากาศ', 'type1_nParcel', 'specific_lte100k', 'APPROVAL', 'IN_PROGRESS', 0, null);
			await createDoc(nextPlan(), '[T1] รอหัวหน้าแผนกอนุมัติ', 'type1_nParcel', 'specific_lte100k', 'APPROVAL', 'IN_PROGRESS', 1, null);
			await createDoc(nextPlan(), '[T1] รอแผนงานตรวจสอบ', 'type1_nParcel', 'specific_lte100k', 'APPROVAL', 'IN_PROGRESS', 2, null);
			await createDoc(nextPlan(), '[T1] รอหัวหน้าแผนงานเสนอ', 'type1_nParcel', 'specific_lte100k', 'APPROVAL', 'IN_PROGRESS', 3, null);
			await createDoc(nextPlan(), '[T1] รอ ผอ. อนุมัติ', 'type1_nParcel', 'specific_lte100k', 'APPROVAL', 'IN_PROGRESS', 4, null);
			await createDoc(nextPlan(), '[T1] รอจัดทำเอกสาร (BILL_PENDING)', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'BILL_PENDING');
			await createDoc(nextPlan(), '[T1] จัดทำเอกสารแล้ว (BILL_CREATED)', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'BILL_CREATED');
			await createDoc(nextPlan(), '[T1] ส่งการเงินแล้ว (SENT_TO_FINANCE)', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'SENT_TO_FINANCE');
			await createDoc(nextPlan(), '[T1] การเงินรับทราบ — พร้อมทำฎีกา', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'FINANCE_SEEN');
			await createDoc(nextPlan(), '[T1] สร้างฎีกาแล้ว — รอ ผอ.', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIKA_CREATED');
			await createDoc(nextPlan(), '[T1] ผอ. อนุมัติฎีกา — รอจ่าย', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIRECTOR_APPROVED');
			await createDoc(nextPlan(), '[T1] จ่ายเงินแล้ว — รอประทับ', 'type1_nParcel', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'PAID');
			await createDoc(nextPlan(), '[T1] เสร็จสิ้น (STAMPED)', 'type1_nParcel', 'specific_lte100k', 'COMPLETED', 'PAID', 5, 'STAMPED');

			// ══════════════════════════════════════════════════════════
			// TYPE 2: iParcelUtil — ค่าไฟฟ้า
			// รอบ 1: ผ่าน ผอ. (DIKA_CREATED → DIRECTOR_APPROVED → PAID → STAMPED)
			// รอบ 2+: ไม่ผ่าน ผอ. (DIKA_CREATED → PAID → STAMPED)
			// ══════════════════════════════════════════════════════════
			console.log('   Seeding type2_iParcelUtil...');
			await createDoc(nextPlan(), '[T2] ค่าไฟฟ้า — รอจัดทำเอกสาร (รอบ 1)', 'type2_iParcelUtil', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'BILL_PENDING');
			await createDoc(nextPlan(), '[T2] ค่าไฟฟ้า — การเงินรับทราบ (รอบ 1)', 'type2_iParcelUtil', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'FINANCE_SEEN');
			await createDoc(nextPlan(), '[T2] ค่าไฟฟ้า — สร้างฎีกา รอ ผอ. (รอบ 1)', 'type2_iParcelUtil', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIKA_CREATED');
			await createDoc(nextPlan(), '[T2] ค่าไฟฟ้า — ผอ. อนุมัติ (รอบ 1)', 'type2_iParcelUtil', 'specific_lte100k', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIRECTOR_APPROVED');
			// Multi-round: round 1 STAMPED + round 2 in progress (no director)
			const t2MultiPlan = nextPlan();
			const [t2MultiDoc] = await db.insert(schema.documents).values({
				slug: randomUUID(), agency_id: hospital.id, plan_id: t2MultiPlan.id, workflow_id: null,
				payload: { title: '[T2] ค่าไฟฟ้า — รอบ 2 (ไม่ผ่าน ผอ.)' },
				status: 'APPROVED_PROCUREMENT', updated_by: creatorId,
				doc_type: 'type2_iParcelUtil', procurement_method: 'specific_lte100k', phase: 'EXECUTION'
			}).returning();
			for (const s of makeSteps(t2MultiDoc.id, 5)) await db.insert(schema.documentApprovalSteps).values(s);
			await addBidders(t2MultiDoc.id);
			// Round 1: STAMPED (complete)
			await db.insert(schema.paymentRounds).values({ ...makePaymentRound(t2MultiDoc.id, 'STAMPED', 1) });
			// Round 2: FINANCE_SEEN (in progress, no director needed)
			await db.insert(schema.paymentRounds).values({ ...makePaymentRound(t2MultiDoc.id, 'FINANCE_SEEN', 2) });

			// ══════════════════════════════════════════════════════════
			// TYPE 3: iParcel — ค่าซ่อมบำรุง
			// จ่ายหลายรอบ ผ่าน ผอ. (DIKA_CREATED → DIRECTOR_APPROVED → PAID → STAMPED)
			// ══════════════════════════════════════════════════════════
			console.log('   Seeding type3_iParcel...');
			await createDoc(nextPlan(), '[T3] ซ่อมแอร์ — รอจัดทำเอกสาร', 'type3_iParcel', 'selection', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'BILL_PENDING');
			await createDoc(nextPlan(), '[T3] ซ่อมแอร์ — การเงินรับทราบ', 'type3_iParcel', 'selection', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'FINANCE_SEEN');
			await createDoc(nextPlan(), '[T3] ซ่อมแอร์ — สร้างฎีกาแล้ว รอ ผอ.', 'type3_iParcel', 'selection', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIKA_CREATED');
			await createDoc(nextPlan(), '[T3] ซ่อมแอร์ — ผอ. อนุมัติ รอจ่าย', 'type3_iParcel', 'selection', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIRECTOR_APPROVED');
			await createDoc(nextPlan(), '[T3] ซ่อมแอร์ — เสร็จรอบ 1 (STAMPED)', 'type3_iParcel', 'selection', 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'STAMPED');

			// ══════════════════════════════════════════════════════════
			// TYPE 4: iFinance — ค่าล่วงเวลา
			// ไม่ผ่านจัดซื้อ ไปการเงินเลย (DIKA_CREATED → DIRECTOR_APPROVED → PAID → STAMPED)
			// ══════════════════════════════════════════════════════════
			console.log('   Seeding type4_iFinance...');
			const t4plan1 = nextPlan();
			const t4doc1 = await createDoc(t4plan1, '[T4] ค่าล่วงเวลา — สร้างฎีกาเลย', 'type4_iFinance', null, 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIKA_CREATED', { addBids: false });
			const t4plan2 = nextPlan();
			const t4doc2 = await createDoc(t4plan2, '[T4] ค่าล่วงเวลา — ผอ. อนุมัติ รอจ่าย', 'type4_iFinance', null, 'EXECUTION', 'APPROVED_PROCUREMENT', 5, 'DIRECTOR_APPROVED', { addBids: false });
			const t4plan3 = nextPlan();
			const t4doc3 = await createDoc(t4plan3, '[T4] ค่าล่วงเวลา — เสร็จสิ้น', 'type4_iFinance', null, 'COMPLETED', 'PAID', 5, 'STAMPED', { addBids: false });

			// ══════════════════════════════════════════════════════════
			// TYPE 5: project — โครงการอบรมพัฒนาบุคลากร
			// รายการย่อย: type4_iFinance (ยืมเงิน) + type1_nParcel (จัดซื้อ) หลายอัน
			// ══════════════════════════════════════════════════════════
			console.log('   Seeding type5_project...');
			const projPlan = nextPlan();
			const [projDoc] = await db.insert(schema.documents).values({
				slug: randomUUID(), agency_id: hospital.id, plan_id: projPlan.id, workflow_id: null,
				payload: { title: '[T5] โครงการอบรมพัฒนาบุคลากร' },
				status: 'APPROVED_PROCUREMENT', updated_by: creatorId,
				doc_type: 'type5_project', procurement_method: null, phase: 'EXECUTION'
			}).returning();
			for (const s of makeSteps(projDoc.id, 5)) await db.insert(schema.documentApprovalSteps).values(s);

			// Helper: create child doc for project
			const createChildDoc = async (title: string, docType: string, procMethod: string | null, payStatus: string, phase: string, docStatus: string, price?: string) => {
				const cp = nextPlan();
				const [cd] = await db.insert(schema.documents).values({
					slug: randomUUID(), agency_id: hospital.id, plan_id: cp.id, workflow_id: null,
					payload: { title }, status: docStatus, updated_by: creatorId,
					doc_type: docType, procurement_method: procMethod, phase
				}).returning();
				for (const s of makeSteps(cd.id, 5)) await db.insert(schema.documentApprovalSteps).values(s);
				await db.insert(schema.paymentRounds).values(makePaymentRound(cd.id, payStatus));
				if (docType !== 'type4_iFinance' && price) await addBidders(cd.id, price);
				return cd;
			};

			// ── type4_iFinance children (ค่าตอบแทน/ยืมเงิน — ตรงไปการเงิน) ──
			const child1 = await createChildDoc('[T5] ค่าสมนาคุณวิทยากร 1', 'type4_iFinance', null, 'DIKA_CREATED', 'EXECUTION', 'APPROVED_PROCUREMENT');
			const child2 = await createChildDoc('[T5] ค่าเช่าห้องประชุม', 'type4_iFinance', null, 'STAMPED', 'COMPLETED', 'PAID');

			// ── type1_nParcel children (จัดซื้อ — ผ่านจัดซื้อปกติ) ──
			const child3 = await createChildDoc('[T5] ซื้อปากกาและเครื่องเขียน', 'type1_nParcel', 'specific_lte100k', 'FINANCE_SEEN', 'EXECUTION', 'APPROVED_PROCUREMENT', '12000.00');
			const child4 = await createChildDoc('[T5] ซื้อเก้าอี้สำนักงาน', 'type1_nParcel', 'specific_lte100k', 'STAMPED', 'COMPLETED', 'PAID', '45000.00');
			const child5 = await createChildDoc('[T5] ซื้อโปรเจกเตอร์', 'type1_nParcel', 'specific_gt100k', 'BILL_PENDING', 'EXECUTION', 'APPROVED_PROCUREMENT', '80000.00');

			// ── Project items linking to child docs (using real doc_types) ──
			await db.insert(schema.projectItems).values([
				{ document_id: projDoc.id, item_name: 'ค่าสมนาคุณวิทยากร (ยืมเงิน)', item_type: 'type4_iFinance', estimated_amount: '50000.00', actual_amount: '0', status: 'IN_PROGRESS', child_document_id: child1.id },
				{ document_id: projDoc.id, item_name: 'ค่าเช่าห้องประชุม', item_type: 'type4_iFinance', estimated_amount: '15000.00', actual_amount: '15000.00', status: 'COMPLETED', child_document_id: child2.id },
				{ document_id: projDoc.id, item_name: 'ซื้อปากกาและเครื่องเขียน', item_type: 'type1_nParcel', estimated_amount: '15000.00', actual_amount: '0', status: 'IN_PROGRESS', child_document_id: child3.id },
				{ document_id: projDoc.id, item_name: 'ซื้อเก้าอี้สำนักงาน', item_type: 'type1_nParcel', estimated_amount: '50000.00', actual_amount: '45000.00', status: 'COMPLETED', child_document_id: child4.id },
				{ document_id: projDoc.id, item_name: 'ซื้อโปรเจกเตอร์', item_type: 'type1_nParcel', estimated_amount: '85000.00', actual_amount: '0', status: 'IN_PROGRESS', child_document_id: child5.id },
			]);

			const totalDocs = planIdx + 5; // main docs + 5 child docs
			console.log(`✅ V2 Documents seeded — ${totalDocs} total across all 5 types`);
			console.log('   type1_nParcel:    13 docs (approval ①-⑤ + execution ⑥-⑬)');
			console.log('   type2_iParcelUtil: 6 docs (round 1 ผ่าน ผอ. + multi-round demo)');
			console.log('   type3_iParcel:     5 docs (execution stages, with director)');
			console.log('   type4_iFinance:    3 docs (direct to finance, no bill)');
			console.log('   type5_project:     1 project + 5 child docs (2 type4 + 3 type1)');
		}
	} else {
		console.log('ℹ️  Documents already exist');
	}

	// ──────────────────────────────────────────
	// 15. Dika Vouchers — สัมพันธ์กับ documents ที่อยู่ขั้นฎีกา
	// ──────────────────────────────────────────
	const existingDika = await db.select().from(schema.dikaVouchers);

	if (existingDika.length === 0) {
		// สร้างฎีกาตาม payment round status จริง
		// Dika flow: PENDING_EXAMINE → EXAMINED → APPROVED → PAID
		// Payment round DIKA_CREATED     → dika PENDING_EXAMINE (วางฎีกาแล้ว รอตรวจสอบ)
		// Payment round DIRECTOR_APPROVED → dika EXAMINED (ตรวจสอบแล้ว) หรือ APPROVED (อนุมัติแล้ว)
		// Payment round PAID/STAMPED      → dika PAID (จ่ายแล้ว)

		const dikaStatuses = ['DIKA_CREATED', 'DIRECTOR_APPROVED', 'PAID', 'STAMPED'];
		const allRounds = await db.select().from(schema.paymentRounds);
		const dikaRounds = allRounds.filter(r => dikaStatuses.includes(r.status));

		if (dikaRounds.length > 0 && vendors.length > 0 && bankAccounts.length > 0) {
			const allDocs = await db.select().from(schema.documents);
			const docMap = new Map(allDocs.map(d => [d.id, d]));

			const allUsersForDika = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(isNull(schema.users.deleted_at));
			const dirU = allUsersForDika.find(u => u.email === 'director@hospital.go.th');
			const finHdU = allUsersForDika.find(u => u.email === 'finance-head@hospital.go.th');

			// Distribute dika statuses evenly to cover all 4 statuses
			// Group rounds by their status to assign different dika statuses
			const dikaCreatedRounds = dikaRounds.filter(r => r.status === 'DIKA_CREATED');
			const dirApprovedRounds = dikaRounds.filter(r => r.status === 'DIRECTOR_APPROVED');
			const paidRounds = dikaRounds.filter(r => r.status === 'PAID');
			const stampedRounds = dikaRounds.filter(r => r.status === 'STAMPED');

			const dikaList: any[] = [];
			const makeDikaEntry = (docId: number, planId: number, vendorIdx: number, dikaStatus: string) => {
				const grossAmount = randomAmount(10000, 500000);
				const taxAmount = randomAmount(0, Number(grossAmount) * 0.07);
				const netAmount = (Number(grossAmount) - Number(taxAmount)).toFixed(2);
				return {
					agency_id: hospital.id,
					document_id: docId,
					vendor_id: vendors[vendorIdx % vendors.length].id,
					plan_id: planId,
					payment_bank_account_id: bankAccounts[0].id,
					tax_pool_account_id: bankAccounts.length > 1 ? bankAccounts[1].id : null,
					gross_amount: grossAmount, fine_amount: '0.00', tax_amount: taxAmount, net_amount: netAmount,
					status: dikaStatus,
					examiner_id: ['EXAMINED','APPROVED','PAID'].includes(dikaStatus) ? (finHdU?.id || null) : null,
					director_id: ['APPROVED','PAID'].includes(dikaStatus) ? (dirU?.id || null) : null
				};
			};

			// DIKA_CREATED payment rounds → dika PENDING_EXAMINE
			for (const r of dikaCreatedRounds) {
				const doc = docMap.get(r.document_id);
				if (doc) dikaList.push(makeDikaEntry(doc.id, doc.plan_id, dikaList.length, 'PENDING_EXAMINE'));
			}
			// DIRECTOR_APPROVED payment rounds → split: half EXAMINED, half APPROVED
			for (let i = 0; i < dirApprovedRounds.length; i++) {
				const doc = docMap.get(dirApprovedRounds[i].document_id);
				if (doc) dikaList.push(makeDikaEntry(doc.id, doc.plan_id, dikaList.length, i % 2 === 0 ? 'EXAMINED' : 'APPROVED'));
			}
			// PAID payment rounds → dika APPROVED (รออนุมัติจ่ายเงิน)
			for (const r of paidRounds) {
				const doc = docMap.get(r.document_id);
				if (doc) dikaList.push(makeDikaEntry(doc.id, doc.plan_id, dikaList.length, 'APPROVED'));
			}
			// STAMPED payment rounds → dika PAID
			for (const r of stampedRounds) {
				const doc = docMap.get(r.document_id);
				if (doc) dikaList.push(makeDikaEntry(doc.id, doc.plan_id, dikaList.length, 'PAID'));
			}

			if (dikaList.length > 0) {
				await db.insert(schema.dikaVouchers).values(dikaList);
				const counts: Record<string, number> = {};
				for (const d of dikaList) counts[d.status] = (counts[d.status] || 0) + 1;
				console.log(`✅ Dika Vouchers seeded (${dikaList.length} total — ${Object.entries(counts).map(([k,v]) => `${k}:${v}`).join(', ')})`);
			}
		}
	} else {
		console.log('ℹ️  Dika Vouchers already exist');
	}

	// ──────────────────────────────────────────
	// Summary
	// ──────────────────────────────────────────
	console.log('\n🎉 Database seeding complete!');
	console.log('\n📊 Summary:');
	console.log('   - Super Admin: 1 (email: admin@prosync.go.th, password: admin1234)');
	console.log('   - Roles: 14 (aligned with v2 procurement workflow)');
	console.log('   - Plans: 10 parent + 40 child (child plans under parent\'s department hierarchy)');
	console.log('');
	console.log('🔄 V2 Procurement Workflow (5 steps):');
	console.log('   1. เจ้าหน้าที่ประจำแผนก (DIVISION_DRAFT) — ร่างเอกสาร');
	console.log('   2. หัวหน้าแผนก (HEAD_APPROVE) — อนุมัติร่าง');
	console.log('   3. เจ้าหน้าที่แผนงาน (PLANNER_CHECK) — ตรวจสอบ');
	console.log('   4. หัวหน้าแผนกแผนงาน (PLANNER_DIRECTOR_APPROVE) — เสนอ ผอ.');
	console.log('   5. ผู้อำนวยการ (DIRECTOR_APPROVE) — อนุมัติ');
	console.log('');
	console.log('🔐 User Credentials (password: password1234):');
	console.log('');
	console.log('   ── Executive ──');
	console.log('   ผู้อำนวยการ (Step 5):            director@hospital.go.th');
	console.log('   รอง ผอ.:                         vice-director@hospital.go.th');
	console.log('');
	console.log('   ── Division Heads (Step 2: HEAD_APPROVE) ──');
	console.log('   หัวหน้าศัลยกรรม:                 head-surgery@hospital.go.th');
	console.log('   หัวหน้าอายุรกรรม:                head-medicine@hospital.go.th');
	console.log('   หัวหน้ากุมารเวชกรรม:             head-pediatric@hospital.go.th');
	console.log('   หัวหน้าเภสัชกรรม:                head-pharmacy@hospital.go.th');
	console.log('');
	console.log('   ── Division Staff (Step 1: DIVISION_DRAFT) ──');
	console.log('   เจ้าหน้าที่ศัลยกรรม:             staff-surgery@hospital.go.th');
	console.log('   เจ้าหน้าที่อายุรกรรม:            staff-medicine@hospital.go.th');
	console.log('   เจ้าหน้าที่กุมารเวชกรรม:         staff-pediatric@hospital.go.th');
	console.log('   เจ้าหน้าที่เภสัชกรรม:            staff-pharmacy@hospital.go.th');
	console.log('');
	console.log('   ── Planning Unit (Steps 3 & 4) ──');
	console.log('   หัวหน้าแผนกแผนงาน (Step 4):      planning-head@hospital.go.th');
	console.log('   เจ้าหน้าที่แผนงาน (Step 3):      planner1@hospital.go.th');
	console.log('   เจ้าหน้าที่แผนงาน 2:             planner2@hospital.go.th');
	console.log('');
	console.log('   ── Procurement Unit (Execution phase) ──');
	console.log('   หัวหน้าพัสดุ:                    procurement-head@hospital.go.th');
	console.log('   เจ้าหน้าที่พัสดุ 1:              procurement1@hospital.go.th');
	console.log('   เจ้าหน้าที่พัสดุ 2:              procurement2@hospital.go.th');
	console.log('');
	console.log('   ── Finance Unit ──');
	console.log('   หัวหน้าการเงิน:                  finance-head@hospital.go.th');
	console.log('   เจ้าหน้าที่การเงิน:              finance1@hospital.go.th');
	console.log('');
	console.log('   ── Committee Members ──');
	console.log('   กรรมการ 1 (พยาบาล):              committee1@hospital.go.th');
	console.log('   กรรมการ 2 (เภสัชกร):             committee2@hospital.go.th');
	console.log('   กรรมการ 3 (IT):                  committee3@hospital.go.th');

	// ──────────────────────────────────────────
	// V2: Agency Settings (แผนกหลัก)
	// ──────────────────────────────────────────
	const allAgencies = await db.select().from(schema.agencies);
	for (const agency of allAgencies) {
		const units = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.agency_id, agency.id));
		if (units.length === 0) continue;

		// Try to find planning/procurement/finance units by name
		const planningUnit = units.find(u => u.name.includes('แผนงาน') || u.name.includes('วิชาการ'));
		const procurementUnit = units.find(u => u.name.includes('พัสดุ') || u.name.includes('จัดซื้อ'));
		const financeUnit = units.find(u => u.name.includes('การเงิน') || u.name.includes('บัญชี'));

		if (planningUnit || procurementUnit || financeUnit) {
			const existing = await db.select().from(schema.agencySettings).where(eq(schema.agencySettings.agency_id, agency.id));
			if (existing.length === 0) {
				await db.insert(schema.agencySettings).values({
					agency_id: agency.id,
					planning_unit_id: planningUnit?.id ?? null,
					procurement_unit_id: procurementUnit?.id ?? null,
					finance_unit_id: financeUnit?.id ?? null
				});
			}
		}
	}
	console.log('✅ Agency settings seeded (v2)');

	// ──────────────────────────────────────────
	// V2: Document type + procurement method reference
	// ──────────────────────────────────────────
	console.log('');
	console.log('═══════════════════════════════════════════');
	console.log('  V2 Procurement Flow Reference');
	console.log('═══════════════════════════════════════════');
	console.log('');
	console.log('📋 Document Types:');
	console.log('   type1_nParcel     — ซื้อครั้งเดียว จ่ายครั้งเดียว');
	console.log('   type2_iParcelUtil — ค่าสาธารณูปโภค (จ่ายหลายรอบ ไม่ผ่าน ผอ.)');
	console.log('   type3_iParcel     — ค่าซ่อมบำรุง (จ่ายหลายรอบ ผ่าน ผอ.)');
	console.log('   type4_iFinance    — ค่าตอบแทน (ตรงไปการเงิน)');
	console.log('   type5_project     — โครงการ (มีเอกสารย่อย)');
	console.log('');
	console.log('📦 Procurement Methods (for type1/2/3):');
	console.log('   specific_lte100k  — วิธีเฉพาะเจาะจง ≤100K   → quotations, vendor_selection, purchase_order, inspection');
	console.log('   specific_gt100k   — วิธีเฉพาะเจาะจง >100K   → tor, median_price, quotations, vendor_selection, contract, inspection');
	console.log('   selection          — วิธีคัดเลือก             → tor, median_price, invitation, procurement_committee, vendor_selection, contract, inspection');
	console.log('   e_bidding          — e-Bidding                → tor, median_price, announcement, procurement_committee, vendor_proposals, evaluation, winner_announcement, contract, inspection');
	console.log('   e_market           — e-Market                 → tor, median_price, e_catalog, evaluation, contract, inspection');
	console.log('');
	console.log('🔄 Approval Flow (ทุก type):');
	console.log('   1. แผนกรับผิดชอบ — ร่าง');
	console.log('   2. หัวหน้าแผนก — อนุมัติ');
	console.log('   3. แผนกแผนงาน — ตรวจสอบ');
	console.log('   4. หัวหน้าแผนงาน — เสนอ ผอ.');
	console.log('   5. ผู้อำนวยการ — อนุมัติ');
	console.log('');
	console.log('💰 Payment Flow (after approval):');
	console.log('   type1/2/3 → procurement (consolidated bill) → finance (dika)');
	console.log('   type4     → finance (dika) directly');
	console.log('   type5     → project items management');

	process.exit(0);
}

seed().catch((err) => {
	console.error('❌ Seed failed:', err);
	process.exit(1);
});
