// Password-reset token helpers. The raw token is sent to the user (e.g. by
// email); only its SHA-256 hash is stored, so a database leak does not expose
// usable tokens.

const TOKEN_BYTES = 32;

/** Generate a reset token: returns the raw token and the hash to store. */
export async function generateResetToken(): Promise<{ token: string; tokenHash: string }> {
	const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
	const token = bytesToBase64Url(bytes);
	const tokenHash = await hashToken(token);
	return { token, tokenHash };
}

/** SHA-256 hash (hex) of a token, used for storage and lookup. */
export async function hashToken(token: string): Promise<string> {
	const data = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
	let hex = "";
	for (const byte of bytes) {
		hex += byte.toString(16).padStart(2, "0");
	}
	return hex;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
