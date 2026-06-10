// Single entry point for credential hashing/verification.
//
// - New credentials are hashed with PBKDF2-SHA256 via the WebCrypto API. It runs
//   natively on Cloudflare Workers and stays well inside the CPU budget; pure-JS
//   argon2id (19 MiB, memory-hard) was exhausting that budget and crashing login.
// - Verification dispatches on the stored `passwordAlgorithm`, so legacy argon2id
//   digests keep verifying alongside the PBKDF2 ones.
import type { PasswordDigest } from "../db/types.ts";
import { ARGON2_ALGORITHM, verifyPasswordArgon2 } from "./argon2.ts";
import {
	PASSWORD_ALGORITHM as PBKDF2_ALGORITHM,
	hashPassword as hashPasswordPbkdf2,
	verifyPassword as verifyPbkdf2,
} from "./password.js";

/** Hash a new password (PBKDF2-SHA256, WebCrypto). */
export async function hashPassword(password: string): Promise<PasswordDigest> {
	return hashPasswordPbkdf2(password) as Promise<PasswordDigest>;
}

/** Verify a password against any supported digest. */
export async function verifyPassword(
	password: string,
	digest: Partial<PasswordDigest> | null | undefined,
): Promise<boolean> {
	if (!digest || typeof digest.passwordAlgorithm !== "string") {
		return false;
	}

	if (digest.passwordAlgorithm === PBKDF2_ALGORITHM) {
		return verifyPbkdf2(password, digest);
	}

	if (digest.passwordAlgorithm === ARGON2_ALGORITHM) {
		return verifyPasswordArgon2(password, digest as PasswordDigest);
	}

	return false;
}
