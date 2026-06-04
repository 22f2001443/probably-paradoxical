import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type {
	AdminDocument,
	JudgeDocument,
	MemberDocument,
	TeamCredentialDocument,
	TeamDocument,
	TeamMemberDocument,
} from "../db/types.ts";
import { createJwt, parseJwtExpiresInSeconds } from "../security/jwt.js";
import { verifyPassword } from "../security/password.js";

interface LoginBody {
	email?: unknown;
	password?: unknown;
}

interface LoginResult {
	status: number;
	body: Record<string, unknown>;
}

export async function handleLogin(request: Request, env: AppEnv): Promise<LoginResult> {
	const body = await readLoginBody(request);
	if ("error" in body) {
		return body.error;
	}

	const email = normalizeEmail(body.email);
	const password = normalizePassword(body.password);
	if (!email || !password) {
		return {
			status: 400,
			body: { error: "Email and password are required." },
		};
	}

	if (!env.JWT_SECRET) {
		return {
			status: 503,
			body: { error: "JWT_SECRET is not configured." },
		};
	}

	let expiresInSeconds: number;
	try {
		expiresInSeconds = parseJwtExpiresInSeconds(env.JWT_EXPIRES_IN_SECONDS);
	} catch (error) {
		return {
			status: 503,
			body: {
				error: error instanceof Error ? error.message : "Invalid JWT configuration.",
			},
		};
	}

	try {
		return await withDatabase(env, async (db) => {
			const adminLogin = await tryAdminLogin(db, email, password, env.JWT_SECRET!, expiresInSeconds);
			if (adminLogin) {
				return adminLogin;
			}

			const judgeLogin = await tryJudgeLogin(db, email, password, env.JWT_SECRET!, expiresInSeconds);
			if (judgeLogin) {
				return judgeLogin;
			}

			const teamLogin = await tryTeamLogin(db, email, password, env.JWT_SECRET!, expiresInSeconds);
			if (teamLogin) {
				return teamLogin;
			}

			return {
				status: 401,
				body: { error: "Invalid email or password." },
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: {
				error: error instanceof Error ? error.message : "Unable to process login request.",
			},
		};
	}
}

async function tryAdminLogin(
	db: import("mongodb").Db,
	email: string,
	password: string,
	secret: string,
	expiresInSeconds: number,
): Promise<LoginResult | null> {
	const admin = await db
		.collection<AdminDocument>(COLLECTIONS.admins)
		.findOne({ email, isActive: true });
	if (!admin || !(await verifyPassword(password, admin))) {
		return null;
	}

	const token = await createJwt(
		{ sub: String(admin._id), role: "admin", email: admin.email },
		secret,
		{ expiresInSeconds },
	);

	return {
		status: 200,
		body: {
			token,
			tokenType: "Bearer",
			expiresIn: expiresInSeconds,
			user: {
				role: "admin",
				email: admin.email,
				username: admin.username,
				name: admin.name,
			},
		},
	};
}

async function tryJudgeLogin(
	db: import("mongodb").Db,
	email: string,
	password: string,
	secret: string,
	expiresInSeconds: number,
): Promise<LoginResult | null> {
	const judge = await db
		.collection<JudgeDocument>(COLLECTIONS.judges)
		.findOne({ email, isActive: true });
	if (!judge || !(await verifyPassword(password, judge))) {
		return null;
	}

	const token = await createJwt(
		{ sub: String(judge._id), role: "judge", email: judge.email },
		secret,
		{ expiresInSeconds },
	);

	return {
		status: 200,
		body: {
			token,
			tokenType: "Bearer",
			expiresIn: expiresInSeconds,
			user: { role: "judge", email: judge.email, name: judge.name },
		},
	};
}

async function tryTeamLogin(
	db: import("mongodb").Db,
	email: string,
	password: string,
	secret: string,
	expiresInSeconds: number,
): Promise<LoginResult | null> {
	const member = await db.collection<MemberDocument>(COLLECTIONS.members).findOne({ email });
	if (!member?._id) {
		return null;
	}

	const membership = await db
		.collection<TeamMemberDocument>(COLLECTIONS.teamMembers)
		.findOne({ memberId: member._id, status: "active" });
	if (!membership) {
		return null;
	}

	const [team, credential] = await Promise.all([
		db.collection<TeamDocument>(COLLECTIONS.teams).findOne({ teamId: membership.teamId }),
		db
			.collection<TeamCredentialDocument>(COLLECTIONS.teamCredentials)
			.findOne({ teamId: membership.teamId }),
	]);

	if (!team || !credential || !(await verifyPassword(password, credential))) {
		return null;
	}

	const token = await createJwt(
		{
			sub: team.teamId,
			role: "team",
			email,
			teamId: team.teamId,
			teamName: team.teamName,
			memberId: String(member._id),
		},
		secret,
		{ expiresInSeconds },
	);

	return {
		status: 200,
		body: {
			token,
			tokenType: "Bearer",
			expiresIn: expiresInSeconds,
			user: {
				role: "team",
				email,
				name: member.name,
				teamId: team.teamId,
				teamName: team.teamName,
				roleInTeam: membership.roleInTeam,
			},
		},
	};
}

async function readLoginBody(
	request: Request,
): Promise<LoginBody | { error: LoginResult }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return {
				error: {
					status: 400,
					body: { error: "Request body must be a JSON object." },
				},
			};
		}

		return body as LoginBody;
	} catch {
		return {
			error: {
				status: 400,
				body: { error: "Request body must be valid JSON." },
			},
		};
	}
}

function normalizeEmail(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const email = value.trim().toLowerCase();
	return email.length > 0 ? email : null;
}

function normalizePassword(value: unknown): string | null {
	if (typeof value !== "string" || value.length === 0) {
		return null;
	}

	return value;
}
