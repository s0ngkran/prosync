import 'dotenv/config';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const sql = postgres(process.env.DATABASE_URL!);

const passwordHash = await hash('admin');

await sql`
	INSERT INTO users (id_card, email, password_hash, name, position, position_rank, is_super_admin, profile_completed)
	VALUES ('admin', 'admin', ${passwordHash}, 'Admin', 'ผู้ดูแลระบบ', 'Super Admin', true, true)
	ON CONFLICT (id_card) DO UPDATE SET
		password_hash = EXCLUDED.password_hash,
		email = EXCLUDED.email,
		is_super_admin = EXCLUDED.is_super_admin,
		profile_completed = EXCLUDED.profile_completed
`;

const [u] = await sql`SELECT id, id_card, email, name, is_super_admin FROM users WHERE id_card = 'admin'`;
console.log('✅ admin user ready:', u);

await sql.end();
