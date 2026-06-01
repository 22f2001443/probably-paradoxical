export const JWT_ALGORITHM = "HS256";
export const DEFAULT_JWT_EXPIRES_IN_SECONDS = 8 * 60 * 60;

export async function createJwt(payload, secret, options = {}) {
	assertSecret(secret);

	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresInSeconds =
		options.expiresInSeconds ?? DEFAULT_JWT_EXPIRES_IN_SECONDS;
	const header = {
		alg: JWT_ALGORITHM,
		typ: "JWT",
	};
	const claims = {
		...payload,
		iat: issuedAt,
		exp: issuedAt + expiresInSeconds,
	};
	const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
	const signature = await sign(signingInput, secret);

	return `${signingInput}.${signature}`;
}

export async function verifyJwt(token, secret) {
	assertSecret(secret);

	if (typeof token !== "string") {
		return null;
	}

	const parts = token.split(".");
	if (parts.length !== 3) {
		return null;
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
	if (!timingSafeEqual(encodedSignature, expectedSignature)) {
		return null;
	}

	const header = parseBase64UrlJson(encodedHeader);
	if (header?.alg !== JWT_ALGORITHM || header?.typ !== "JWT") {
		return null;
	}

	const payload = parseBase64UrlJson(encodedPayload);
	if (!payload || typeof payload.exp !== "number") {
		return null;
	}

	if (payload.exp <= Math.floor(Date.now() / 1000)) {
		return null;
	}

	return payload;
}

export function parseJwtExpiresInSeconds(value) {
	if (!value) {
		return DEFAULT_JWT_EXPIRES_IN_SECONDS;
	}

	const parsedValue = Number(value);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new TypeError("JWT_EXPIRES_IN_SECONDS must be a positive integer.");
	}

	return parsedValue;
}

async function sign(value, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{
			name: "HMAC",
			hash: "SHA-256",
		},
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

	return bytesToBase64Url(new Uint8Array(signature));
}

function base64UrlJson(value) {
	return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseBase64UrlJson(value) {
	try {
		return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
	} catch {
		return null;
	}
}

function bytesToBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlToBytes(value) {
	const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	const paddedBase64 = base64.padEnd(
		base64.length + ((4 - (base64.length % 4)) % 4),
		"=",
	);
	const binary = atob(paddedBase64);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function timingSafeEqual(left, right) {
	if (typeof left !== "string" || typeof right !== "string") {
		return false;
	}

	if (left.length !== right.length) {
		return false;
	}

	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return difference === 0;
}

function assertSecret(secret) {
	if (typeof secret !== "string" || secret.length < 32) {
		throw new TypeError("JWT_SECRET must be at least 32 characters.");
	}
}
