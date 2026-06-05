import type { Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { PasswordResetDocument } from "../db/types.ts";
import { hashPassword } from "../security/passwords.ts";
import { hashToken } from "../security/resetToken.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const MIN_PASSWORD_LENGTH = 8;
const INVALID = { status: 400, body: { error: "Invalid or expired reset token." } } as const;

export async function handleResetPassword(request: Request, env: AppEnv): Promise<Result> {
	const parsed = await readJson(request);
	if ("error" in parsed) {
		return parsed.error;
	}

	const token = typeof parsed.body.token === "string" ? parsed.body.token : "";
	const password = typeof parsed.body.password === "string" ? parsed.body.password : "";
	if (!token) {
		return { status: 400, body: { error: "A reset token is required." } };
	}
	if (password.length < MIN_PASSWORD_LENGTH) {
		return { status: 400, body: { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters.` } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const tokenHash = await hashToken(token);
			const resets = db.collection<PasswordResetDocument>(COLLECTIONS.passwordResets);
			const record = await resets.findOne({ tokenHash });

			if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
				return INVALID;
			}

			const digest = await hashPassword(password);
			await applyNewPassword(db, record, digest);

			// Consume this token and invalidate any others for the same email.
			await resets.deleteMany({ email: record.email });

			return { status: 200, body: { message: "Your password has been reset. You can now sign in." } };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to reset the password." },
		};
	}
}

async function applyNewPassword(
	db: Db,
	record: PasswordResetDocument,
	digest: Awaited<ReturnType<typeof hashPassword>>,
): Promise<void> {
	const now = new Date();
	const set = { ...digest, updatedAt: now };

	if (record.subjectType === "admin") {
		const { ObjectId } = await import("mongodb");
		await db.collection(COLLECTIONS.admins).updateOne({ _id: new ObjectId(record.subjectId) }, { $set: set });
		return;
	}
	if (record.subjectType === "judge") {
		const { ObjectId } = await import("mongodb");
		await db.collection(COLLECTIONS.judges).updateOne({ _id: new ObjectId(record.subjectId) }, { $set: set });
		return;
	}
	// team: shared credential keyed by teamId
	await db.collection(COLLECTIONS.teamCredentials).updateOne(
		{ teamId: record.subjectId },
		{ $set: { teamId: record.subjectId, ...set }, $setOnInsert: { createdAt: now } },
		{ upsert: true },
	);
}

async function readJson(
	request: Request,
): Promise<{ body: { token?: unknown; password?: unknown } } | { error: Result }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return { error: { status: 400, body: { error: "Request body must be a JSON object." } } };
		}
		return { body: body as { token?: unknown; password?: unknown } };
	} catch {
		return { error: { status: 400, body: { error: "Request body must be valid JSON." } } };
	}
}
