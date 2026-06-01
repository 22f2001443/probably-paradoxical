import type { AppEnv } from "../db/mongodb";
import { getDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/schema.js";
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

interface PasswordDigest {
	passwordHash?: string;
	passwordSalt?: string;
	passwordAlgorithm?: string;
	passwordIterations?: number;
}

interface AdminDocument extends PasswordDigest {
	_id: unknown;
	email: string;
	username?: string;
	name?: string;
	role: "admin";
	isActive: boolean;
}

interface TeamMember {
	name: string;
	email: string;
	tag?: string;
}

interface TeamDocument {
	teamId: string;
	teamName: string;
	members: TeamMember[];
}

interface TeamPasswordDocument extends PasswordDigest {
	teamId: string;
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
		const db = await getDatabase(env);
		const admin = await db
			.collection<AdminDocument>(COLLECTIONS.admins)
			.findOne({ email, isActive: true });

		if (admin && (await verifyPassword(password, admin))) {
			const token = await createJwt(
				{
					sub: String(admin._id),
					role: "admin",
					email: admin.email,
				},
				env.JWT_SECRET,
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

		const team = await db
			.collection<TeamDocument>(COLLECTIONS.users)
			.findOne({ "members.email": email });
		const teamPassword = team
			? await db
					.collection<TeamPasswordDocument>(COLLECTIONS.passwords)
					.findOne({ teamId: team.teamId })
			: null;

		if (team && teamPassword && (await verifyPassword(password, teamPassword))) {
			const member = team.members.find(
				(teamMember) => normalizeEmail(teamMember.email) === email,
			);
			const token = await createJwt(
				{
					sub: team.teamId,
					role: "team",
					email,
					teamId: team.teamId,
					teamName: team.teamName,
				},
				env.JWT_SECRET,
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
						name: member?.name,
						teamId: team.teamId,
						teamName: team.teamName,
					},
				},
			};
		}

		return {
			status: 401,
			body: { error: "Invalid email or password." },
		};
	} catch (error) {
		const status =
			error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: {
				error:
					error instanceof Error
						? error.message
						: "Unable to process login request.",
			},
		};
	}
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
