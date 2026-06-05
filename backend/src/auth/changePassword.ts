import type { Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { PasswordDigest } from "../db/types.ts";
import { getAuthPayload, type AuthPayload } from "./requireAuth.ts";
import { hashPassword, verifyPassword } from "../security/passwords.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const MIN_PASSWORD_LENGTH = 8;

export async function handleChangePassword(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}

	const parsed = await readJson(request);
	if ("error" in parsed) {
		return parsed.error;
	}

	const currentPassword = asString(parsed.body.currentPassword);
	const newPassword = asString(parsed.body.newPassword);
	if (!currentPassword || !newPassword) {
		return { status: 400, body: { error: "currentPassword and newPassword are required." } };
	}
	if (newPassword.length < MIN_PASSWORD_LENGTH) {
		return { status: 400, body: { error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters.` } };
	}
	if (newPassword === currentPassword) {
		return { status: 400, body: { error: "New password must be different from the current password." } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const digest = await loadDigest(db, auth);
			if (!digest || !(await verifyPassword(currentPassword, digest))) {
				return { status: 401, body: { error: "Current password is incorrect." } };
			}

			const newDigest = await hashPassword(newPassword);
			await applyNewPassword(db, auth, newDigest);
			return { status: 200, body: { message: "Password updated." } };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to change the password." },
		};
	}
}

async function loadDigest(db: Db, auth: AuthPayload): Promise<PasswordDigest | null> {
	if (auth.role === "admin" || auth.role === "judge") {
		const { ObjectId } = await import("mongodb");
		const collection = auth.role === "admin" ? COLLECTIONS.admins : COLLECTIONS.judges;
		let id: InstanceType<typeof ObjectId>;
		try {
			id = new ObjectId(auth.sub);
		} catch {
			return null;
		}
		return db.collection<PasswordDigest>(collection).findOne({ _id: id });
	}

	// team: shared credential keyed by teamId (the team JWT's `sub`).
	return db
		.collection<PasswordDigest>(COLLECTIONS.teamCredentials)
		.findOne({ teamId: auth.teamId ?? auth.sub });
}

async function applyNewPassword(db: Db, auth: AuthPayload, digest: PasswordDigest): Promise<void> {
	const set = { ...digest, updatedAt: new Date() };

	if (auth.role === "admin" || auth.role === "judge") {
		const { ObjectId } = await import("mongodb");
		const collection = auth.role === "admin" ? COLLECTIONS.admins : COLLECTIONS.judges;
		await db.collection(collection).updateOne({ _id: new ObjectId(auth.sub) }, { $set: set });
		return;
	}

	const teamId = auth.teamId ?? auth.sub;
	await db
		.collection(COLLECTIONS.teamCredentials)
		.updateOne({ teamId }, { $set: { teamId, ...set } });
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

async function readJson(
	request: Request,
): Promise<{ body: { currentPassword?: unknown; newPassword?: unknown } } | { error: Result }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return { error: { status: 400, body: { error: "Request body must be a JSON object." } } };
		}
		return { body: body as { currentPassword?: unknown; newPassword?: unknown } };
	} catch {
		return { error: { status: 400, body: { error: "Request body must be valid JSON." } } };
	}
}
