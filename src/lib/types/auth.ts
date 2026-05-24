export interface JWTPayload {
	sub: number; // users.id
	id_card: string; // users.id_card
	name: string; // users.name
	position_rank: string | null; // users.position_rank (job title)
	profile_picture: string | null; // users.profile_picture URL
	agency_id: number | null; // agencies.id (null for super admin)
	is_super_admin: boolean;
	is_director: boolean;
	primary_org_unit_id: number | null;
	must_change_password: boolean;
	profile_completed: boolean;
	permissions: {
		can_manage_users: boolean;
		can_manage_plans: boolean;
		can_manage_procurement: boolean;
		can_manage_finance: boolean;
		can_view_audit_trail: boolean;
		can_view_plans: boolean;
		can_view_procurement: boolean;
		can_view_finance: boolean;
		can_view_dashboard: boolean;
	};
	exp?: number;
}
