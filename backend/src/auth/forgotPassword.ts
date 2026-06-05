import type { Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type {
	AdminDocument,
	JudgeDocument,
	MemberDocument,
	PasswordResetDocument,
	TeamMemberDocument,
} from "../db/types.ts";
import { generateResetToken } from "../security/resetToken.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const RESET_TTL_SECONDS = 30 * 60; // 30 minutes
const GENERIC_MESSAGE =
	"If an account exists for that email, a password reset link has been sent.";

type Subject = { subjectType: "admin" | "judge" | "team"; subjectId: string };

export async function handleForgotPassword(request: Request, env: AppEnv): Promise<Result> {
	const parsed = await readJson(request);
	if ("error" in parsed) {
		return parsed.error;
	}

	const email = normalizeEmail(parsed.body.email);
	if (!email) {
		return { status: 400, body: { error: "A valid email is required." } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const subject = await resolveSubject(db, email);

			// Always respond the same way to avoid email enumeration.
			if (!subject) {
				return { status: 200, body: { message: GENERIC_MESSAGE } };
			}

			const { token, tokenHash } = await generateResetToken();
			const now = new Date();
			const expiresAt = new Date(now.getTime() + RESET_TTL_SECONDS * 1000);

			const resets = db.collection<PasswordResetDocument>(COLLECTIONS.passwordResets);
			// Invalidate any outstanding tokens for this email, then store the new one.
			await resets.deleteMany({ email });
			await resets.insertOne({
				tokenHash,
				subjectType: subject.subjectType,
				subjectId: subject.subjectId,
				email,
				expiresAt,
				createdAt: now,
			});

			// In production, send `token` to the user by email here.
			// In development we return it so the flow is testable end to end.
			const body: Record<string, unknown> = { message: GENERIC_MESSAGE };
			if (isDev(env)) {
				body.devResetToken = token;
				body.devResetPath = `/reset-password?token=${token}`;
				body.expiresInSeconds = RESET_TTL_SECONDS;
			}
			return { status: 200, body };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: {
				error: error instanceof Error ? error.message : "Unable to process the request.",
			},
		};
	}
}

async function resolveSubject(db: Db, email: string): Promise<Subject | null> {
	const admin = await db
		.collection<AdminDocument>(COLLECTIONS.admins)
		.findOne({ email, isActive: true }, { projection: { _id: 1 } });
	if (admin) {
		return { subjectType: "admin", subjectId: String(admin._id) };
	}

	const judge = await db
		.collection<JudgeDocument>(COLLECTIONS.judges)
		.findOne({ email, isActive: true }, { projection: { _id: 1 } });
	if (judge) {
		return { subjectType: "judge", subjectId: String(judge._id) };
	}

	const member = await db
		.collection<MemberDocument>(COLLECTIONS.members)
		.findOne({ email }, { projection: { _id: 1 } });
	if (member?._id) {
		const membership = await db
			.collection<TeamMemberDocument>(COLLECTIONS.teamMembers)
			.findOne({ memberId: member._id, status: "active" });
		if (membership) {
			return { subjectType: "team", subjectId: membership.teamId };
		}
	}

	return null;
}

function isDev(env: AppEnv): boolean {
	return (env as { NODE_ENV?: string }).NODE_ENV !== "production";
}

async function readJson(
	request: Request,
): Promise<{ body: { email?: unknown } } | { error: Result }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return { error: { status: 400, body: { error: "Request body must be a JSON object." } } };
		}
		return { body: body as { email?: unknown } };
	} catch {
		return { error: { status: 400, body: { error: "Request body must be valid JSON." } } };
	}
}

function normalizeEmail(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const email = value.trim().toLowerCase();
	return email.length > 0 ? email : null;
}
