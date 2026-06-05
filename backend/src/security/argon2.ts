// Argon2id password hashing via @noble/hashes — a pure-JS, audited
// implementation. We use pure JS (not a WASM build) on purpose: Cloudflare
// Workers (workerd) forbid runtime WebAssembly compilation, which breaks
// self-compiling WASM argon2 libraries. Pure JS has no such restriction.
//
// Hashes are stored as a standard PHC string:
//   $argon2id$v=19$m=19456,t=2,p=1$<saltB64>$<hashB64>
import { argon2id } from "@noble/hashes/argon2.js";
import type { PasswordDigest } from "../db/types.ts";

export const ARGON2_ALGORITHM = "argon2id";

// OWASP-recommended argon2id baseline. Lower `m`/`t` if you hit the Workers
// CPU limit on a constrained plan (signups are infrequent).
const ARGON2_PARAMS = { m: 19456, t: 2, p: 1 } as const; // m in KiB
const ARGON2_VERSION = 0x13; // 19
const SALT_LENGTH_BYTES = 16;
const HASH_LENGTH_BYTES = 32;

const PHC_RE = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/;

/** Hash a password and return a digest in the shared credential shape. */
export async function hashPasswordArgon2(password: string): Promise<PasswordDigest> {
	assertPassword(password);

	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
	const hash = argon2id(password, salt, {
		t: ARGON2_PARAMS.t,
		m: ARGON2_PARAMS.m,
		p: ARGON2_PARAMS.p,
		dkLen: HASH_LENGTH_BYTES,
		version: ARGON2_VERSION,
	});

	const phc = `$argon2id$v=${ARGON2_VERSION}$m=${ARGON2_PARAMS.m},t=${ARGON2_PARAMS.t},p=${ARGON2_PARAMS.p}$${toB64(salt)}$${toB64(hash)}`;

	return {
		passwordHash: phc,
		passwordSalt: toB64(salt),
		passwordAlgorithm: ARGON2_ALGORITHM,
		passwordIterations: ARGON2_PARAMS.t,
	};
}

/** Verify a password against an argon2id PHC digest. */
export async function verifyPasswordArgon2(
	password: string,
	digest: Pick<PasswordDigest, "passwordHash">,
): Promise<boolean> {
	if (typeof password !== "string" || password.length === 0) {
		return false;
	}

	const match = typeof digest?.passwordHash === "string" && digest.passwordHash.match(PHC_RE);
	if (!match) {
		return false;
	}

	const [, version, m, t, p, saltB64, hashB64] = match;
	let expected: Uint8Array;
	try {
		expected = fromB64(hashB64);
		const salt = fromB64(saltB64);
		const computed = argon2id(password, salt, {
			t: Number(t),
			m: Number(m),
			p: Number(p),
			dkLen: expected.length,
			version: Number(version),
		});
		return timingSafeEqual(computed, expected);
	} catch {
		return false;
	}
}

function assertPassword(password: string): void {
	if (typeof password !== "string" || password.length === 0) {
		throw new TypeError("Password must be a non-empty string.");
	}
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

function toB64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/=+$/, "");
}

function fromB64(value: string): Uint8Array {
	const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
