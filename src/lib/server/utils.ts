import { randomUUID } from 'crypto';

/** Generate a UUID v4 for document slugs */
export function generateSlug(): string {
	return randomUUID();
}
