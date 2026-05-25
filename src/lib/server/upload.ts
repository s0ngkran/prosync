import { env } from '$env/dynamic/private';

const isLocalhost = env.NODE_ENV === 'localhost';

/**
 * Upload a file — S3 on production, local filesystem on localhost.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
	file: File,
	path: string // e.g. "procurement/abc-123/tor.pdf"
): Promise<string> {
	const buffer = Buffer.from(await file.arrayBuffer());

	if (isLocalhost) {
		return uploadLocal(buffer, path, file.name);
	} else {
		return uploadS3(buffer, path, file.type);
	}
}

/**
 * Upload to local filesystem (static/uploads/)
 */
async function uploadLocal(buffer: Buffer, path: string, originalName: string): Promise<string> {
	const { writeFileSync, mkdirSync, existsSync } = await import('fs');
	const { join, dirname } = await import('path');

	const filePath = join('static', 'uploads', path);
	const dir = dirname(filePath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(filePath, buffer);
	return `/uploads/${path}`;
}

/**
 * Upload to AWS S3
 */
async function uploadS3(buffer: Buffer, path: string, contentType: string): Promise<string> {
	const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

	const bucket = env.S3_BUCKET;
	const region = env.S3_REGION || 'ap-southeast-1';

	if (!bucket) {
		throw new Error('S3_BUCKET environment variable is not set');
	}

	const client = new S3Client({
		region,
		credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
			? {
					accessKeyId: env.S3_ACCESS_KEY_ID,
					secretAccessKey: env.S3_SECRET_ACCESS_KEY
				}
			: undefined // uses default credential chain (IAM role, etc.)
	});

	const key = `prosync/${path}`;

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
			// public-read if using S3 website hosting, otherwise use CloudFront/signed URLs
		})
	);

	// Return the S3 URL
	const cdnUrl = env.S3_CDN_URL;
	if (cdnUrl) {
		return `${cdnUrl}/${key}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Generate a unique file path for a document upload
 */
export function generateUploadPath(
	documentSlug: string,
	sectionKey: string,
	fieldKey: string,
	originalFilename: string
): string {
	const timestamp = Date.now();
	const ext = originalFilename.split('.').pop() || 'pdf';
	return `procurement/${documentSlug}/${sectionKey}/${fieldKey}_${timestamp}.${ext}`;
}

/**
 * Check if running on localhost
 */
export function isLocal(): boolean {
	return isLocalhost;
}
