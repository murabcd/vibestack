import { SignJWT } from "jose";

const getJweSecret = (): Uint8Array => {
	const secret = process.env.JWE_SECRET;
	if (!secret) {
		throw new Error(
			"JWE_SECRET environment variable is required. Generate one with: openssl rand -base64 32",
		);
	}
	return new TextEncoder().encode(secret);
};

export async function encryptJWE<T>(
	payload: T,
	expiresIn: string = "1h",
): Promise<string> {
	const secret = getJweSecret();

	const jwt = await new SignJWT(payload as Record<string, unknown>)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(secret);

	return jwt;
}
