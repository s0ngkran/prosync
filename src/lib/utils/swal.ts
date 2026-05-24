import Swal from 'sweetalert2';

/** Confirm ลบ — return true if confirmed */
export async function confirmDelete(name?: string): Promise<boolean> {
	const result = await Swal.fire({
		title: 'ยืนยันการลบ',
		text: name ? `ต้องการลบ "${name}" ใช่หรือไม่?` : 'ต้องการลบรายการนี้ใช่หรือไม่?',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#e53935',
		cancelButtonColor: '#78909c',
		confirmButtonText: 'ลบ',
		cancelButtonText: 'ยกเลิก',
		reverseButtons: true
	});
	return result.isConfirmed;
}

/** Confirm action ทั่วไป */
export async function confirmAction(title: string, text?: string): Promise<boolean> {
	const result = await Swal.fire({
		title,
		text,
		icon: 'question',
		showCancelButton: true,
		confirmButtonColor: '#1565c0',
		cancelButtonColor: '#78909c',
		confirmButtonText: 'ยืนยัน',
		cancelButtonText: 'ยกเลิก',
		reverseButtons: true
	});
	return result.isConfirmed;
}

/** Toast สำเร็จ */
export function toastSuccess(message: string) {
	Swal.fire({
		toast: true,
		position: 'top-end',
		icon: 'success',
		title: message,
		showConfirmButton: false,
		timer: 2500,
		timerProgressBar: true
	});
}

/** ใช้กับ onclick ของปุ่ม submit ใน form — preventDefault แล้ว confirm ก่อน submit */
export function swalConfirmDelete(e: Event, name?: string) {
	e.preventDefault();
	const btn = e.currentTarget as HTMLButtonElement;
	const form = btn.closest('form');
	if (!form) return;
	Swal.fire({
		title: 'ยืนยันการลบ',
		text: name ? `ต้องการลบ "${name}" ใช่หรือไม่?` : 'ต้องการลบรายการนี้ใช่หรือไม่?',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#e53935',
		cancelButtonColor: '#78909c',
		confirmButtonText: 'ลบ',
		cancelButtonText: 'ยกเลิก',
		reverseButtons: true
	}).then((result) => {
		if (result.isConfirmed) form.requestSubmit();
	});
}

/** Toast error */
export function toastError(message: string) {
	Swal.fire({
		toast: true,
		position: 'top-end',
		icon: 'error',
		title: message,
		showConfirmButton: false,
		timer: 3000,
		timerProgressBar: true
	});
}
