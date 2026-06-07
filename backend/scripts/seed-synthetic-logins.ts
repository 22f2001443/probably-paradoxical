// Seeds the full team roster from teamInfo.yml, then gives EVERY team in the DB
// a synthetic login: a member with email `<teamId>@probably.paradoxical` whose
// (shared team) password is the same string. Email + password are stored in
// lowercase because login normalizes the email to lowercase before lookup.
// Idempotent. `node scripts/seed-synthetic-logins.ts`.
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";
import YAML from "yaml";
import { COLLECTIONS } from "../src/db/collections.ts";
import { hashPassword } from "../src/security/password.js";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || inferDatabaseName(mongoUri) || "probably_paradoxical";
const teamInfoPath = resolve(backendRoot, "../frontend/src/data/teamInfo.yml");
const EMAIL_DOMAIN = "probably.paradoxical";

const client = new MongoClient(mongoUri);

try {
	await client.connect();
	const db = client.db(databaseName);
	const now = new Date();

	const teamInfo = YAML.parse(await readFile(teamInfoPath, "utf8"));
	const rosterResult = await seedRoster(db, teamInfo, now);
	const loginResult = await seedSyntheticLogins(db, now);

	console.log(
		JSON.stringify({ ok: true, database: db.databaseName, roster: rosterResult, synthetic: loginResult }, null, 2),
	);
} finally {
	await client.close();
}

// --- Roster (real members) --------------------------------------------------

async function seedRoster(db: import("mongodb").Db, teamInfo: unknown, now: Date) {
	const teams = normalizeTeams(teamInfo);
	let teamsUpserted = 0;
	let membersUpserted = 0;
	let memberships = 0;
	const skipped: string[] = [];

	for (const team of teams) {
		const validMembers = team.members.filter((m) => m.email.length > 0);
		if (validMembers.length === 0) {
			skipped.push(team.teamId);
			continue;
		}

		const memberIds: ObjectId[] = [];
		for (const member of validMembers) {
			const doc = await db.collection(COLLECTIONS.members).findOneAndUpdate(
				{ email: member.email },
				{ $set: { email: member.email, name: member.name, updatedAt: now }, $setOnInsert: { createdAt: now } },
				{ upsert: true, returnDocument: "after" },
			);
			if (doc?._id) {
				memberIds.push(doc._id as ObjectId);
				membersUpserted += 1;
			}
		}

		// Prefer the member flagged teamLead; fall back to the first member.
		const leadIndex = Math.max(0, validMembers.findIndex((m) => m.teamLead));
		const leadMemberId = memberIds[leadIndex] ?? memberIds[0];

		const teamResult = await db.collection(COLLECTIONS.teams).updateOne(
			{ teamId: team.teamId },
			{
				$set: { teamName: team.teamName, status: "active", leadMemberId, updatedAt: now },
				$setOnInsert: { teamId: team.teamId, createdAt: now },
			},
			{ upsert: true },
		);
		if (teamResult.upsertedCount) teamsUpserted += 1;

		for (let index = 0; index < memberIds.length; index += 1) {
			const tag = validMembers[index].tag;
			await db.collection(COLLECTIONS.teamMembers).updateOne(
				{ teamId: team.teamId, memberId: memberIds[index] },
				{
					$set: {
						roleInTeam: index === leadIndex ? "leader" : "member",
						status: "active",
						...(tag ? { tag } : {}),
						updatedAt: now,
					},
					$setOnInsert: { teamId: team.teamId, memberId: memberIds[index], joinedAt: now, createdAt: now },
				},
				{ upsert: true },
			);
			memberships += 1;
		}
	}

	return { totalTeams: teams.length, teamsUpserted, membersUpserted, memberships, skippedTeams: skipped };
}

// --- Synthetic per-team logins ----------------------------------------------

async function seedSyntheticLogins(db: import("mongodb").Db, now: Date) {
	const teams = await db
		.collection(COLLECTIONS.teams)
		.find({}, { projection: { teamId: 1, teamName: 1 } })
		.toArray();

	let processed = 0;
	const samples: { teamId: string; email: string }[] = [];

	for (const team of teams) {
		const teamId = team.teamId as string;
		const email = `${teamId.toLowerCase()}@${EMAIL_DOMAIN}`;
		const password = email; // password == the login email

		const member = await db.collection(COLLECTIONS.members).findOneAndUpdate(
			{ email },
			{ $set: { email, name: `${team.teamName} (synthetic login)`, updatedAt: now }, $setOnInsert: { createdAt: now } },
			{ upsert: true, returnDocument: "after" },
		);
		const memberId = member?._id as ObjectId;

		await db.collection(COLLECTIONS.teamMembers).updateOne(
			{ teamId, memberId },
			{
				$set: { roleInTeam: "member", status: "active", updatedAt: now },
				$setOnInsert: { teamId, memberId, joinedAt: now, createdAt: now },
			},
			{ upsert: true },
		);

		const digest = await hashPassword(password);
		await db.collection(COLLECTIONS.teamCredentials).updateOne(
			{ teamId },
			{ $set: { teamId, ...digest, updatedAt: now }, $setOnInsert: { createdAt: now } },
			{ upsert: true },
		);

		processed += 1;
		if (samples.length < 5) samples.push({ teamId, email });
	}

	return { teamsProcessed: processed, sampleCredentials: samples };
}

// --- Helpers ----------------------------------------------------------------

interface NormalizedMember { name: string; email: string; tag?: string; teamLead?: boolean }
interface NormalizedTeam { teamId: string; teamName: string; members: NormalizedMember[] }

function normalizeTeams(teamInfoDocument: unknown): NormalizedTeam[] {
	const teams = (teamInfoDocument as { teams?: unknown })?.teams;
	if (!Array.isArray(teams)) {
		throw new Error("teamInfo.yml must contain a teams array.");
	}
	return teams.map((team) => ({
		teamId: requireString(team.teamId, "teamId"),
		teamName: requireString(team.teamName, "teamName"),
		members: normalizeMembers(team.members, team.teamId),
	}));
}

function normalizeMembers(members: unknown, teamId: string): NormalizedMember[] {
	if (!Array.isArray(members) || members.length === 0) {
		throw new Error(`Team ${teamId} must contain at least one member.`);
	}
	return members.map((member) => {
		const normalized: NormalizedMember = {
			name: requireString(member.name, `member.name for ${teamId}`),
			email: typeof member.email === "string" ? member.email.trim().toLowerCase() : "",
		};
		if (member.tag) normalized.tag = requireString(member.tag, `member.tag for ${teamId}`);
		if (member.teamLead === true) normalized.teamLead = true;
		return normalized;
	});
}

function requireString(value: unknown, fieldName: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${fieldName} must be a non-empty string.`);
	}
	return value.trim();
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required. Add it to backend/.env.`);
	return value;
}

function inferDatabaseName(uri: string): string | undefined {
	try {
		return decodeURIComponent(new URL(uri).pathname.replace(/^\//, "")) || undefined;
	} catch {
		return undefined;
	}
}

function loadEnvFile(path: string): void {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith("#")) continue;
		const separatorIndex = trimmedLine.indexOf("=");
		if (separatorIndex === -1) continue;
		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = stripQuotes(trimmedLine.slice(separatorIndex + 1).trim());
		process.env[key] ??= value;
	}
}

function stripQuotes(value: string): string {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}
