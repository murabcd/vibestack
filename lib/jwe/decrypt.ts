import { jwtVerify } from "jose";

const getJweSecret = (): Uint8Array => {
	const secret = process.env.JWE_SECRET;
	if (!secret) {
		throw new Error(
			"JWE_SECRET environment variable is required. Generate one with: openssl rand -base64 32",
		);
	}
	return new TextEncoder().encode(secret);
};

export async function decryptJWE<T>(token: string): Promise<T | null> {
	try {
		const secret = getJweSecret();
		const { payload } = await jwtVerify(token, secret);
		return payload as T;
	} catch {
		return null;
	}
}
