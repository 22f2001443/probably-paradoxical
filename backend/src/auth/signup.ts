import type { Collection, Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type {
	ConfigDocument,
	MemberDocument,
	TeamCredentialDocument,
	TeamDocument,
	TeamMemberDocument,
} from "../db/types.ts";
import { createJwt, parseJwtExpiresInSeconds } from "../security/jwt.js";
import { hashPassword } from "../security/passwords.ts";

interface SignupResult {
	status: number;
	body: Record<string, unknown>;
}

interface MemberInput {
	name: string;
	email: string;
	tag?: string;
}

interface ValidatedSignup {
	teamName: string;
	password: string;
	members: MemberInput[];
	leaderEmail: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_TEAM_SIZE = { min: 2, max: 5 };

export async function handleSignup(request: Request, env: AppEnv): Promise<SignupResult> {
	const parsed = await parseBody(request);
	if ("error" in parsed) {
		return parsed.error;
	}

	try {
		return await withDatabase(env, async (db) => {
			const config = await db
				.collection<ConfigDocument>(COLLECTIONS.config)
				.findOne({ _id: "singleton" });
			const teamSize = config?.teamSize ?? DEFAULT_TEAM_SIZE;

			const validation = validate(parsed.body, teamSize);
			if ("error" in validation) {
				return validation.error;
			}
			const input = validation.value;

			const members = db.collection<MemberDocument>(COLLECTIONS.members);
			const teamMembers = db.collection<TeamMemberDocument>(COLLECTIONS.teamMembers);
			const teams = db.collection<TeamDocument>(COLLECTIONS.teams);

			// Reject emails that are already on an active team.
			const emails = input.members.map((m) => m.email);
			const existingMembers = await members.find({ email: { $in: emails } }).toArray();
			if (existingMembers.length > 0) {
				const existingIds = existingMembers.map((m) => m._id!);
				const activeMembership = await teamMembers.findOne({
					memberId: { $in: existingIds },
					status: "active",
				});
				if (activeMembership) {
					const taken = existingMembers.find((m) =>
						m._id!.equals(activeMembership.memberId),
					);
					return conflict(`Email already registered to a team: ${taken?.email}`);
				}
			}

			const now = new Date();

			// Upsert members (identity records), preserving input order for ids.
			const memberIds = [] as import("mongodb").ObjectId[];
			for (const member of input.members) {
				const doc = await members.findOneAndUpdate(
					{ email: member.email },
					{
						$set: { name: member.name, updatedAt: now },
						$setOnInsert: { email: member.email, createdAt: now },
					},
					{ upsert: true, returnDocument: "after" },
				);
				memberIds.push(doc!._id!);
			}

			const leaderIndex = input.members.findIndex((m) => m.email === input.leaderEmail);
			const leadMemberId = memberIds[leaderIndex];

			const teamId = await insertTeamWithUniqueId(teams, {
				teamName: input.teamName,
				leadMemberId,
				currentRoundKey: config?.currentRoundKey,
				now,
			});

			// Roster: exactly one leader.
			for (let i = 0; i < input.members.length; i += 1) {
				const member = input.members[i];
				await teamMembers.updateOne(
					{ teamId, memberId: memberIds[i] },
					{
						$set: {
							roleInTeam: member.email === input.leaderEmail ? "leader" : "member",
							status: "active",
							...(member.tag ? { tag: member.tag } : {}),
							updatedAt: now,
						},
						$setOnInsert: {
							teamId,
							memberId: memberIds[i],
							joinedAt: now,
							createdAt: now,
						},
					},
					{ upsert: true },
				);
			}

			// Shared team password (argon2id).
			const digest = await hashPassword(input.password);
			await db.collection<TeamCredentialDocument>(COLLECTIONS.teamCredentials).updateOne(
				{ teamId },
				{ $set: { teamId, ...digest, updatedAt: now }, $setOnInsert: { createdAt: now } },
				{ upsert: true },
			);

			const token = await maybeIssueToken(env, {
				teamId,
				teamName: input.teamName,
				email: input.leaderEmail,
				memberId: String(leadMemberId),
			});

			return {
				status: 201,
				body: {
					team: {
						teamId,
						teamName: input.teamName,
						leadEmail: input.leaderEmail,
						memberCount: input.members.length,
					},
					...token,
					user: {
						role: "team",
						email: input.leaderEmail,
						teamId,
						teamName: input.teamName,
						roleInTeam: "leader",
					},
				},
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: {
				error: error instanceof Error ? error.message : "Unable to process signup request.",
			},
		};
	}
}

async function insertTeamWithUniqueId(
	teams: Collection<TeamDocument>,
	args: {
		teamName: string;
		leadMemberId: import("mongodb").ObjectId;
		currentRoundKey?: string;
		now: Date;
	},
): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const teamId = await nextTeamId(teams, attempt);
		try {
			await teams.insertOne({
				teamId,
				teamName: args.teamName,
				status: "active",
				leadMemberId: args.leadMemberId,
				...(args.currentRoundKey ? { currentRoundKey: args.currentRoundKey as never } : {}),
				createdAt: args.now,
				updatedAt: args.now,
			} as TeamDocument);
			return teamId;
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				continue; // teamId raced; try the next one
			}
			throw error;
		}
	}
	throw new Error("Could not allocate a unique teamId.");
}

async function nextTeamId(teams: Collection<TeamDocument>, attempt: number): Promise<string> {
	const count = await teams.estimatedDocumentCount();
	const candidate = `T${String(count + 1 + attempt).padStart(2, "0")}`;
	const exists = await teams.findOne({ teamId: candidate }, { projection: { _id: 1 } });
	if (!exists) {
		return candidate;
	}
	return `T${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function maybeIssueToken(
	env: AppEnv,
	claims: { teamId: string; teamName: string; email: string; memberId: string },
): Promise<Record<string, unknown>> {
	if (!env.JWT_SECRET) {
		return { token: null };
	}

	let expiresInSeconds: number;
	try {
		expiresInSeconds = parseJwtExpiresInSeconds(env.JWT_EXPIRES_IN_SECONDS);
	} catch {
		return { token: null };
	}

	const token = await createJwt(
		{
			sub: claims.teamId,
			role: "team",
			email: claims.email,
			teamId: claims.teamId,
			teamName: claims.teamName,
			memberId: claims.memberId,
		},
		env.JWT_SECRET,
		{ expiresInSeconds },
	);
	return { token, tokenType: "Bearer", expiresIn: expiresInSeconds };
}

// --- Validation -------------------------------------------------------------

function validate(
	body: Record<string, unknown>,
	teamSize: { min: number; max: number },
): { value: ValidatedSignup } | { error: SignupResult } {
	const teamName = typeof body.teamName === "string" ? body.teamName.trim() : "";
	if (!teamName) {
		return badRequest("teamName is required.");
	}

	const password = typeof body.password === "string" ? body.password : "";
	if (password.length < MIN_PASSWORD_LENGTH) {
		return badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	}

	if (!Array.isArray(body.members)) {
		return badRequest("members must be an array.");
	}
	if (body.members.length < teamSize.min || body.members.length > teamSize.max) {
		return badRequest(`A team must have between ${teamSize.min} and ${teamSize.max} members.`);
	}

	const members: MemberInput[] = [];
	const seen = new Set<string>();
	for (const raw of body.members) {
		const item = raw as Record<string, unknown>;
		const name = typeof item.name === "string" ? item.name.trim() : "";
		const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
		if (!name) {
			return badRequest("Each member needs a name.");
		}
		if (!EMAIL_RE.test(email)) {
			return badRequest(`Invalid member email: ${email || "(empty)"}`);
		}
		if (seen.has(email)) {
			return badRequest(`Duplicate member email: ${email}`);
		}
		seen.add(email);
		const member: MemberInput = { name, email };
		if (typeof item.tag === "string" && item.tag.trim()) {
			member.tag = item.tag.trim();
		}
		members.push(member);
	}

	let leaderEmail = members[0].email;
	if (body.leaderEmail !== undefined) {
		const requested = typeof body.leaderEmail === "string" ? body.leaderEmail.trim().toLowerCase() : "";
		if (!seen.has(requested)) {
			return badRequest("leaderEmail must match one of the member emails.");
		}
		leaderEmail = requested;
	}

	return { value: { teamName, password, members, leaderEmail } };
}

async function parseBody(
	request: Request,
): Promise<{ body: Record<string, unknown> } | { error: SignupResult }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return { error: badRequest("Request body must be a JSON object.").error };
		}
		return { body: body as Record<string, unknown> };
	} catch {
		return { error: badRequest("Request body must be valid JSON.").error };
	}
}

function badRequest(message: string): { error: SignupResult } {
	return { error: { status: 400, body: { error: message } } };
}

function conflict(message: string): SignupResult {
	return { status: 409, body: { error: message } };
}

function isDuplicateKeyError(error: unknown): boolean {
	return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}
