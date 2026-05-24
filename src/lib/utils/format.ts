/**
 * Thai locale formatting utilities for ProSync ERP
 */

/** แปลงวันที่เป็น DD/MM/YYYY พ.ศ. */
export function formatThaiDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '-';
	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const buddhistYear = d.getFullYear() + 543;
	return `${day}/${month}/${buddhistYear}`;
}

/** แปลงวันที่เป็น DD/MM/YYYY พ.ศ. HH:mm น. */
export function formatThaiDateTime(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '-';
	const datePart = formatThaiDate(d);
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	return `${datePart} ${hours}:${minutes} น.`;
}

/** จัดรูปแบบเงินบาท เช่น 1,234,567.89 บาท */
export function formatBaht(amount: number | string): string {
	const num = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(num)) return '0.00 บาท';
	return `${num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

/** จัดรูปแบบตัวเลขเงินบาท (ไม่มีคำว่า "บาท") */
export function formatNumber(amount: number | string): string {
	const num = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(num)) return '0.00';
	return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** คำนวณปีงบประมาณ: เริ่ม 1 ต.ค. - สิ้นสุด 30 ก.ย. ปี พ.ศ. ที่ ก.ย. ตกอยู่ */
export function getCurrentFiscalYear(): number {
	const now = new Date();
	const month = now.getMonth(); // 0-based
	const year = now.getFullYear() + 543;
	// ถ้าเดือน ต.ค.(9) - ธ.ค.(11) ให้ใช้ปีถัดไป
	return month >= 9 ? year + 1 : year;
}

/** สถานะ → สี badge ตาม convention */
export const STATUS_COLORS: Record<string, string> = {
	DRAFT: 'bg-gray-100 text-gray-700',
	IN_PROGRESS: 'bg-blue-100 text-blue-700',
	COMPLETED: 'bg-green-100 text-green-700',
	APPROVED: 'bg-green-100 text-green-700',
	APPROVED_PROCUREMENT: 'bg-green-100 text-green-700',
	REJECTED: 'bg-red-100 text-red-700',
	PAID: 'bg-green-100 text-green-700',
	PENDING: 'bg-yellow-100 text-yellow-700',
	PENDING_EXAMINE: 'bg-yellow-100 text-yellow-700',
	SUBMITTED: 'bg-green-100 text-green-700'
};

/** สถานะ → label ภาษาไทย */
export const STATUS_LABELS: Record<string, string> = {
	DRAFT: 'ร่าง',
	IN_PROGRESS: 'กำลังดำเนินการ',
	COMPLETED: 'เสร็จสิ้น',
	APPROVED: 'อนุมัติแล้ว',
	APPROVED_PROCUREMENT: 'อนุมัติแล้ว',
	REJECTED: 'ปฏิเสธ',
	PAID: 'จ่ายแล้ว',
	PENDING: 'รอดำเนินการ',
	PENDING_EXAMINE: 'รอตรวจสอบ',
	SUBMITTED: 'ส่งแล้ว'
};

/** Parse CSV text เป็น array of objects โดยใช้ header row แรกเป็น keys */
export function parseCsv(text: string): Record<string, string>[] {
	// Remove BOM if present
	const clean = text.replace(/^\uFEFF/, '');
	const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
	if (lines.length < 2) return [];

	const parseRow = (line: string): string[] => {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"') {
					if (line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = false;
					}
				} else {
					current += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				result.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	};

	const headers = parseRow(lines[0]);
	return lines.slice(1).map((line) => {
		const values = parseRow(line);
		const obj: Record<string, string> = {};
		headers.forEach((h, i) => {
			obj[h] = values[i] ?? '';
		});
		return obj;
	});
}

/** ดาวน์โหลด CSV template สำหรับ import */
export function downloadCsvTemplate(filename: string, headers: string[]): void {
	const BOM = '\uFEFF';
	const csv = BOM + headers.map((h) => `"${h}"`).join(',');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${filename}_template.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

/** Export ข้อมูลเป็น CSV และดาวน์โหลด */
export function exportToCsv(
	filename: string,
	headers: { key: string; label: string }[],
	data: readonly Record<string, unknown>[] | readonly object[]
): void {
	const BOM = '\uFEFF'; // UTF-8 BOM for Thai text in Excel
	const headerRow = headers.map((h) => `"${h.label}"`).join(',');
	const rows = data.map((row) =>
		headers
			.map((h) => {
				const val = (row as Record<string, unknown>)[h.key];
				if (val === null || val === undefined) return '""';
				const str = String(val).replace(/"/g, '""');
				return `"${str}"`;
			})
			.join(',')
	);
	const csv = BOM + [headerRow, ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${filename}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}
