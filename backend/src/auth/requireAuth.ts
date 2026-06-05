import type { AppEnv } from "../db/mongodb";
import { verifyJwt } from "../security/jwt.js";

export interface AuthPayload {
	sub: string;
	role: "admin" | "judge" | "team";
	email?: string;
	teamId?: string;
	teamName?: string;
	memberId?: string;
	[key: string]: unknown;
}

/** Verify the Bearer token and return its JWT payload, or null if missing/invalid. */
export async function getAuthPayload(request: Request, env: AppEnv): Promise<AuthPayload | null> {
	const header = request.headers.get("Authorization") || "";
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match || !env.JWT_SECRET) {
		return null;
	}

	const payload = await verifyJwt(match[1], env.JWT_SECRET);
	if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
		return null;
	}
	return payload as AuthPayload;
}

export interface AdminGuardResult {
	status: number;
	body: Record<string, unknown>;
}

/** Resolve the bearer token and require the `admin` role. */
export async function requireAdmin(
	request: Request,
	env: AppEnv,
): Promise<{ payload: AuthPayload } | { error: AdminGuardResult }> {
	const payload = await getAuthPayload(request, env);
	if (!payload) {
		return { error: { status: 401, body: { error: "Authentication required." } } };
	}
	if (payload.role !== "admin") {
		return { error: { status: 403, body: { error: "Admin access required." } } };
	}
	return { payload };
}
