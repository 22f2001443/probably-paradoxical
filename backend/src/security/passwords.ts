// Single entry point for credential hashing/verification.
//
// - New credentials are hashed with argon2id (signup).
// - Verification dispatches on the stored `passwordAlgorithm`, so existing
//   PBKDF2 digests (seeded data) keep working alongside new argon2id ones.
import type { PasswordDigest } from "../db/types.ts";
import { ARGON2_ALGORITHM, hashPasswordArgon2, verifyPasswordArgon2 } from "./argon2.ts";
import { PASSWORD_ALGORITHM as PBKDF2_ALGORITHM, verifyPassword as verifyPbkdf2 } from "./password.js";

/** Hash a new password (argon2id). */
export async function hashPassword(password: string): Promise<PasswordDigest> {
	return hashPasswordArgon2(password);
}

/** Verify a password against any supported digest. */
export async function verifyPassword(
	password: string,
	digest: Partial<PasswordDigest> | null | undefined,
): Promise<boolean> {
	if (!digest || typeof digest.passwordAlgorithm !== "string") {
		return false;
	}

	if (digest.passwordAlgorithm === ARGON2_ALGORITHM) {
		return verifyPasswordArgon2(password, digest as PasswordDigest);
	}

	if (digest.passwordAlgorithm === PBKDF2_ALGORITHM) {
		return verifyPbkdf2(password, digest);
	}

	return false;
}
