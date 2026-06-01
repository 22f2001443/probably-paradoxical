export const PASSWORD_ALGORITHM = "pbkdf2-sha256";
export const PASSWORD_ITERATIONS = 310000;

const PASSWORD_KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

export async function hashPassword(password) {
	assertPassword(password);

	const passwordSalt = randomBase64(SALT_LENGTH_BYTES);
	const passwordHash = await derivePasswordHash(password, passwordSalt);

	return {
		passwordHash,
		passwordSalt,
		passwordAlgorithm: PASSWORD_ALGORITHM,
		passwordIterations: PASSWORD_ITERATIONS,
	};
}

export async function verifyPassword(password, digest) {
	assertPassword(password);

	if (digest?.passwordAlgorithm !== PASSWORD_ALGORITHM) {
		return false;
	}

	const derivedHash = await derivePasswordHash(password, digest.passwordSalt);
	return timingSafeEqual(derivedHash, digest.passwordHash);
}

async function derivePasswordHash(password, salt) {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: base64ToBytes(salt),
			iterations: PASSWORD_ITERATIONS,
		},
		keyMaterial,
		PASSWORD_KEY_LENGTH_BITS,
	);

	return bytesToBase64(new Uint8Array(derivedBits));
}

function randomBase64(byteLength) {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBytes(value) {
	const binary = atob(value);
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

	const leftBytes = base64ToBytes(left);
	const rightBytes = base64ToBytes(right);
	if (leftBytes.length !== rightBytes.length) {
		return false;
	}

	let difference = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		difference |= leftBytes[index] ^ rightBytes[index];
	}

	return difference === 0;
}

function assertPassword(password) {
	if (typeof password !== "string" || password.length === 0) {
		throw new TypeError("Password must be a non-empty string.");
	}
}
