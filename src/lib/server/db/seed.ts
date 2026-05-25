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
				{
					name: 'หัวหน้าแผนก',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: true },
						planning: { can_view_plan: true, can_create_plan: true, can_edit_plan: true, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: true }
					}
				},
				{
					name: 'เจ้าหน้าที่พัสดุ',
					permissions: {
						system: { can_manage_users: false, can_manage_org_units: false },
						planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
						procurement: { can_view_document: true, can_create_document: true, can_approve_document: false },
						finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
						audit: { can_view_audit_trail: false }
					}
				},
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
	const subUnits = orgUnits.filter((u) => u.parent_id !== null);

	if (existingCount < 20) {
		const passwordHash = await hash('password1234');

		// ── Named users for the 15-step workflow ──
		const namedUsers = [
			{ name: 'นพ.สมชาย สุขใจ', email: 'director@hospital.go.th', position: 'นพ.', positionRank: 'ผู้อำนวยการโรงพยาบาล', roleName: 'ผู้อำนวยการ', orgUnit: rootUnit, idCard: '1100100010001' },
			{ name: 'นางสมหญิง ดีงาม', email: 'vice-director@hospital.go.th', position: 'นาง', positionRank: 'รองผู้อำนวยการฝ่ายบริหาร', roleName: 'รองผู้อำนวยการ', orgUnit: rootUnit, idCard: '1100100010002' },
			{ name: 'นายวิชัย ศรีสุข', email: 'procurement-head@hospital.go.th', position: 'นาย', positionRank: 'หัวหน้าเจ้าหน้าที่พัสดุ', roleName: 'หัวหน้าเจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010003' },
			{ name: 'นางสุภาพ มั่นคง', email: 'procurement1@hospital.go.th', position: 'นาง', positionRank: 'เจ้าพนักงานพัสดุชำนาญงาน', roleName: 'เจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010004' },
			{ name: 'นายประเสริฐ เจริญรุ่ง', email: 'procurement2@hospital.go.th', position: 'นาย', positionRank: 'เจ้าพนักงานพัสดุชำนาญงาน', roleName: 'เจ้าหน้าที่พัสดุ', orgUnit: procurementUnit || subUnits[0], idCard: '1100100010005' },
			{ name: 'นางนภา แสงทอง', email: 'finance-head@hospital.go.th', position: 'นาง', positionRank: 'หัวหน้ากองคลัง', roleName: 'หัวหน้ากองคลัง', orgUnit: financeUnit || subUnits[1], idCard: '1100100010006' },
			{ name: 'นายธนพล บุญมี', email: 'finance1@hospital.go.th', position: 'นาย', positionRank: 'นักวิชาการเงินและบัญชีชำนาญการ', roleName: 'เจ้าหน้าที่การเงิน', orgUnit: financeUnit || subUnits[1], idCard: '1100100010007' },
			{ name: 'นางอรุณี รักไทย', email: 'committee1@hospital.go.th', position: 'นาง', positionRank: 'พยาบาลวิชาชีพชำนาญการพิเศษ', roleName: 'พยาบาล', orgUnit: subUnits[2], idCard: '1100100010008' },
			{ name: 'นายกิตติ พงษ์พันธ์', email: 'committee2@hospital.go.th', position: 'นาย', positionRank: 'เภสัชกรชำนาญการ', roleName: 'นักวิชาการ', orgUnit: subUnits[3], idCard: '1100100010009' },
			{ name: 'นางพิมพ์ใจ วงศ์สวัสดิ์', email: 'committee3@hospital.go.th', position: 'นาง', positionRank: 'นักวิชาการคอมพิวเตอร์ชำนาญการ', roleName: 'นักวิชาการ', orgUnit: subUnits[4], idCard: '1100100010010' }
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

		// Set director as head of root org unit
		const directorUser = createdNamedUsers.find((u) => u.email === 'director@hospital.go.th');
		if (directorUser && rootUnit) {
			await db.update(schema.orgUnits).set({ head_of_unit_id: directorUser.id }).where(eq(schema.orgUnits.id, rootUnit.id));
		}

		// Set procurement head as head of procurement unit
		const procHead = createdNamedUsers.find((u) => u.email === 'procurement-head@hospital.go.th');
		if (procHead && procurementUnit) {
			await db.update(schema.orgUnits).set({ head_of_unit_id: procHead.id }).where(eq(schema.orgUnits.id, procurementUnit.id));
		}

		// Set finance head as head of finance unit
		const finHead = createdNamedUsers.find((u) => u.email === 'finance-head@hospital.go.th');
		if (finHead && financeUnit) {
			await db.update(schema.orgUnits).set({ head_of_unit_id: finHead.id }).where(eq(schema.orgUnits.id, financeUnit.id));
		}

		console.log(`✅ Named workflow users created (${createdNamedUsers.length} users)`);

		// ── Additional random users to fill to 20 ──
		const remainingCount = 20 - existingCount - createdNamedUsers.length;
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
		const parentUnits = orgUnits.filter((u) => {
			const parent = orgUnits.find((ou) => ou.id === u.parent_id);
			return parent && parent.parent_id !== null;
		});

		const allUnits = orgUnits.filter((u) => u.parent_id !== null);

		// Create 10 parent plans
		const parentPlans = await db
			.insert(schema.plans)
			.values(
				parentPlanTemplates.map((template, idx) => {
					const responsibleUnit = parentUnits[idx % parentUnits.length];
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
						responsible_unit_id: responsibleUnit?.id || null,
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
		const childPlans = [];
		for (const parentPlan of parentPlans) {
			for (let i = 0; i < 4; i++) {
				const template =
					childPlanTemplates[(parentPlan.id + i) % childPlanTemplates.length];
				const responsibleUnit = allUnits[randomInt(0, allUnits.length - 1)];
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
		const procHeadU = allUsers.find((u) => u.email === 'procurement-head@hospital.go.th');
		const proc1U = allUsers.find((u) => u.email === 'procurement1@hospital.go.th');
		const proc2U = allUsers.find((u) => u.email === 'procurement2@hospital.go.th');
		const finHeadU = allUsers.find((u) => u.email === 'finance-head@hospital.go.th');
		const fin1U = allUsers.find((u) => u.email === 'finance1@hospital.go.th');

		const leafPlans = await db.select().from(schema.plans).where(eq(schema.plans.is_leaf_node, true));

		// V2: สร้างเอกสารตัวอย่างแบบใหม่ (ใช้ approval-flow + payment-rounds)
		const createV2Doc = async (planId, docType, procMethod, creatorId, title, phase = 'APPROVAL') => {
			const { randomUUID } = await import('crypto');
			const [doc] = await db.insert(schema.documents).values({
				slug: randomUUID(), agency_id: hospital.id, plan_id: planId, workflow_id: null,
				payload: { title }, status: phase === 'EXECUTION' ? 'APPROVED_PROCUREMENT' : 'IN_PROGRESS',
				updated_by: creatorId, doc_type: docType, procurement_method: procMethod, phase
			}).returning();
			if (!doc) return null;
			const stepDefs = [
				{ seq: 1, code: 'DIVISION_DRAFT', name: 'แผนกรับผิดชอบ — ร่าง' },
				{ seq: 2, code: 'HEAD_APPROVE', name: 'หัวหน้าแผนก — อนุมัติ' },
				{ seq: 3, code: 'PLANNER_CHECK', name: 'แผนกแผนงาน — ตรวจสอบ' },
				{ seq: 4, code: 'PLANNER_DIRECTOR_APPROVE', name: 'หัวหน้าแผนงาน — เสนอ ผอ.' },
				{ seq: 5, code: 'DIRECTOR_APPROVE', name: 'ผู้อำนวยการ — อนุมัติ' }
			];
			const isApproved = phase === 'EXECUTION' || phase === 'COMPLETED';
			for (const sd of stepDefs) {
				await db.insert(schema.documentApprovalSteps).values({
					document_id: doc.id, step_sequence: sd.seq, step_code: sd.code, step_name: sd.name,
					assigned_user_id: creatorId, status: isApproved ? 'APPROVED' : (sd.seq === 1 ? 'IN_PROGRESS' : 'PENDING'),
					completed_at: isApproved ? new Date() : null
				});
			}
			if (phase === 'EXECUTION' && ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(docType)) {
				await db.insert(schema.paymentRounds).values({
					document_id: doc.id, round_number: 1, status: 'BILL_PENDING', current_actor_role: 'PROCUREMENT'
				});
			}
			return doc;
		};

		if (leafPlans.length >= 6 && proc1U && directorU) {
			await createV2Doc(leafPlans[0].id, 'type1_nParcel', 'specific_lte100k', proc1U.id, 'จัดซื้อวัสดุสำนักงาน');
			await createV2Doc(leafPlans[1].id, 'type1_nParcel', 'specific_gt100k', proc1U.id, 'จัดซื้อเครื่องพิมพ์ Laser');
			await createV2Doc(leafPlans[2].id, 'type2_iParcelUtil', 'specific_lte100k', proc1U.id, 'ค่าไฟฟ้าประจำเดือน');
			await createV2Doc(leafPlans[3].id, 'type3_iParcel', 'selection', proc1U.id, 'ค่าซ่อมบำรุงเครื่องปรับอากาศ');
			await createV2Doc(leafPlans[4].id, 'type1_nParcel', 'e_bidding', proc1U.id, 'จัดซื้อเครื่อง CT Scan (รอจัดทำเอกสาร)', 'EXECUTION');
			await createV2Doc(leafPlans[5].id, 'type1_nParcel', 'selection', proc1U.id, 'จัดซื้อครุภัณฑ์ห้องผ่าตัด (รอจัดทำเอกสาร)', 'EXECUTION');
			if (leafPlans[6]) await createV2Doc(leafPlans[6].id, 'type2_iParcelUtil', 'specific_lte100k', proc1U.id, 'ค่าน้ำประปา (รอจัดทำเอกสาร)', 'EXECUTION');
			if (leafPlans[7]) await createV2Doc(leafPlans[7].id, 'type4_iFinance', null, proc1U.id, 'ค่าล่วงเวลาบุคลากร');
			if (leafPlans[8]) await createV2Doc(leafPlans[8].id, 'type5_project', null, proc1U.id, 'โครงการอบรมพัฒนาบุคลากร');
			if (leafPlans[9]) await createV2Doc(leafPlans[9].id, 'type1_nParcel', 'specific_lte100k', proc1U.id, 'จัดซื้อกระดาษ A4 (เสร็จสิ้น)', 'COMPLETED');
			console.log('✅ V2 Documents seeded with approval steps + payment rounds');
		}
	} else {
		console.log('ℹ️  Documents already exist');
	}

	// ──────────────────────────────────────────
	// 15. Dika Vouchers — สัมพันธ์กับ documents ที่อยู่ขั้นฎีกา
	// ──────────────────────────────────────────
	const existingDika = await db.select().from(schema.dikaVouchers);

	if (existingDika.length === 0) {
		const allDocs = await db.select().from(schema.documents);

		if (allDocs.length > 0 && vendors.length > 0 && bankAccounts.length > 0) {
			const allUsers = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(isNull(schema.users.deleted_at));
			const dirU = allUsers.find((u) => u.email === 'director@hospital.go.th');
			const procHdU = allUsers.find((u) => u.email === 'procurement-head@hospital.go.th');
			const finHdU = allUsers.find((u) => u.email === 'finance-head@hospital.go.th');

			const makeDika = (docId: number, planId: number, vendorIdx: number, status: string, examinerId: number | null, directorId: number | null) => {
				const vendor = vendors[vendorIdx % vendors.length];
				const grossAmount = randomAmount(10000, 500000);
				const taxAmount = randomAmount(0, Number(grossAmount) * 0.07);
				const netAmount = (Number(grossAmount) - Number(taxAmount)).toFixed(2);
				return {
					agency_id: hospital.id,
					document_id: docId,
					vendor_id: vendor.id,
					plan_id: planId,
					payment_bank_account_id: bankAccounts[0].id,
					tax_pool_account_id: bankAccounts.length > 1 ? bankAccounts[1].id : null,
					gross_amount: grossAmount,
					fine_amount: '0.00',
					tax_amount: taxAmount,
					net_amount: netAmount,
					status,
					examiner_id: examinerId,
					director_id: directorId
				};
			};

			const dikaList = [];

			// เอกสารที่จบแล้ว (APPROVED_PROCUREMENT) → ฎีกา PAID
			const completedDocs = allDocs.filter((d) => d.status === 'APPROVED_PROCUREMENT');
			for (let i = 0; i < completedDocs.length; i++) {
				dikaList.push(makeDika(completedDocs[i].id, completedDocs[i].plan_id, i, 'PAID', procHdU?.id || null, dirU?.id || null));
			}

			// เอกสารที่อยู่ขั้นฎีกา (step 9-12 ของ wf1, step 11-14 ของ wf2)
			// หาจาก payload ที่มีคำว่า "ฎีกา" หรือ "จ่ายเงิน" ในชื่อ
			const inProgressDocs = allDocs.filter((d) => d.status === 'IN_PROGRESS');
			const dikaRelatedDocs = inProgressDocs.filter((d) => {
				const payload = typeof d.payload === 'string' ? JSON.parse(d.payload) : d.payload;
				const title = (payload as any)?.title || '';
				return title.includes('ฎีกา') || title.includes('จ่ายเงิน') || title.includes('ตรวจสอบฎีกา') || title.includes('เบิกจ่าย');
			});

			// PENDING_EXAMINE — เอกสาร "วางฎีกา" และ "ตรวจสอบฎีกา"
			const examDocs = dikaRelatedDocs.filter((d) => {
				const p = typeof d.payload === 'string' ? JSON.parse(d.payload) : d.payload;
				return ((p as any)?.title || '').includes('วางฎีกา') || ((p as any)?.title || '').includes('ตรวจสอบฎีกา');
			});
			for (let i = 0; i < examDocs.length; i++) {
				dikaList.push(makeDika(examDocs[i].id, examDocs[i].plan_id, i, 'PENDING_EXAMINE', null, null));
			}

			// EXAMINED — เอกสาร "อนุมัติเบิกจ่าย"
			const approveDocs = dikaRelatedDocs.filter((d) => {
				const p = typeof d.payload === 'string' ? JSON.parse(d.payload) : d.payload;
				return ((p as any)?.title || '').includes('รออนุมัติเบิกจ่าย');
			});
			for (let i = 0; i < approveDocs.length; i++) {
				dikaList.push(makeDika(approveDocs[i].id, approveDocs[i].plan_id, i + examDocs.length, 'EXAMINED', procHdU?.id || null, null));
			}

			// APPROVED — เอกสาร "รอจ่ายเงิน"
			const payDocs = dikaRelatedDocs.filter((d) => {
				const p = typeof d.payload === 'string' ? JSON.parse(d.payload) : d.payload;
				return ((p as any)?.title || '').includes('รอจ่ายเงิน');
			});
			for (let i = 0; i < payDocs.length; i++) {
				dikaList.push(makeDika(payDocs[i].id, payDocs[i].plan_id, i + examDocs.length + approveDocs.length, 'APPROVED', procHdU?.id || null, dirU?.id || null));
			}

			if (dikaList.length > 0) {
				await db.insert(schema.dikaVouchers).values(dikaList);

				// สร้าง notifications สำหรับฎีกาที่ยังไม่จบ
				const notifs = [];
				for (const d of dikaList) {
					if (d.status === 'PENDING_EXAMINE' && finHdU) {
						notifs.push({ user_id: finHdU.id, document_id: d.document_id, step_id: null, title: 'ฎีการอตรวจสอบ', message: `ฎีกาเบิกจ่ายสำหรับเอกสาร #${d.document_id} รอการตรวจสอบ (${d.net_amount} บาท)`, action_url: '/finance', notification_type: 'APPROVAL_REQUIRED', is_read: false });
					}
					if (d.status === 'EXAMINED' && dirU) {
						notifs.push({ user_id: dirU.id, document_id: d.document_id, step_id: null, title: 'ฎีการออนุมัติเบิกจ่าย', message: `ฎีกาเบิกจ่ายสำหรับเอกสาร #${d.document_id} รอการอนุมัติ (${d.net_amount} บาท)`, action_url: '/finance', notification_type: 'APPROVAL_REQUIRED', is_read: false });
					}
					if (d.status === 'APPROVED' && finHdU) {
						notifs.push({ user_id: finHdU.id, document_id: d.document_id, step_id: null, title: 'ฎีการอจ่ายเงิน', message: `ฎีกาเบิกจ่ายสำหรับเอกสาร #${d.document_id} ได้รับอนุมัติแล้ว — รอจ่ายเงิน (${d.net_amount} บาท)`, action_url: '/finance', notification_type: 'APPROVAL_REQUIRED', is_read: false });
					}
				}
				if (notifs.length > 0) await db.insert(schema.notifications).values(notifs);

				const counts = { PAID: completedDocs.length, PENDING_EXAMINE: examDocs.length, EXAMINED: approveDocs.length, APPROVED: payDocs.length };
				console.log(`✅ Dika Vouchers seeded (${dikaList.length} total — PAID:${counts.PAID}, PENDING_EXAMINE:${counts.PENDING_EXAMINE}, EXAMINED:${counts.EXAMINED}, APPROVED:${counts.APPROVED})`);
				console.log(`✅ Dika notifications seeded (${notifs.length})`);
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
	console.log('   - Workflows: 5 วิธีจัดซื้อจัดจ้าง (ทุกวิธีจบด้วยฎีกา 4 ขั้นตอน)');
	console.log('     🟢 วิธีเฉพาะเจาะจง ≤100K (12 steps)');
	console.log('     🟡 วิธีเฉพาะเจาะจง 100K-500K (14 steps)');
	console.log('     🟠 วิธีคัดเลือก (14 steps)');
	console.log('     🔵 วิธี e-Bidding >500K (15 steps)');
	console.log('     🟣 วิธี e-Market >500K (11 steps)');
	console.log('   - Documents: IN_PROGRESS at various steps + APPROVED/REJECTED/CANCELLED');
	console.log('   - Dika Sub-steps seeded: วางฎีกา → ตรวจสอบ → อนุมัติ → จ่ายเงิน');
	console.log('\n🔐 Workflow User Credentials (password: password1234):');
	console.log('   ผู้อำนวยการ (DIRECTOR):       director@hospital.go.th');
	console.log('   รอง ผอ. (REVIEWER):            vice-director@hospital.go.th');
	console.log('   หัวหน้าพัสดุ (REVIEWER):       procurement-head@hospital.go.th');
	console.log('   เจ้าหน้าที่พัสดุ (CREATOR):    procurement1@hospital.go.th');
	console.log('   เจ้าหน้าที่พัสดุ 2:            procurement2@hospital.go.th');
	console.log('   หัวหน้าการเงิน:                finance-head@hospital.go.th');
	console.log('   เจ้าหน้าที่การเงิน:            finance1@hospital.go.th');
	console.log('   กรรมการ 1 (พยาบาล):            committee1@hospital.go.th');
	console.log('   กรรมการ 2 (เภสัชกร):           committee2@hospital.go.th');
	console.log('   กรรมการ 3 (IT):                committee3@hospital.go.th');

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
