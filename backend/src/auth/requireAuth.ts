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
