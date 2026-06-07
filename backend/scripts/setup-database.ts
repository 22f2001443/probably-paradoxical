// Provisions the database schema and seeds baseline data. Runs under Node's
// native TypeScript support: `node scripts/setup-database.ts`.
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";
import YAML from "yaml";
import {
	COLLECTIONS,
	CONFIG_SINGLETON_ID,
	ROUND_KEYS,
	ROUND_STATE,
	SUBMISSION_TYPE,
} from "../src/db/collections.ts";
import { ensureMongoCollections } from "../src/db/schema.ts";
import { hashPassword } from "../src/security/password.js";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || inferDatabaseName(mongoUri) || "probably_paradoxical";
const teamInfoPath = resolve(backendRoot, "../frontend/src/data/teamInfo.yml");

const client = new MongoClient(mongoUri);

try {
	await client.connect();
	const db = client.db(databaseName);

	const schemaResult = await ensureMongoCollections(db);
	const configResult = await seedConfig(db);
	const roundsResult = await seedRounds(db);
	const rubricResult = await seedRubric(db);

	const teamInfo = YAML.parse(await readFile(teamInfoPath, "utf8"));
	const rosterResult = await seedRoster(db, teamInfo);
	const adminResult = await seedAdmin(db);

	console.log(
		JSON.stringify(
			{
				ok: true,
				database: db.databaseName,
				schema: schemaResult,
				config: configResult,
				rounds: roundsResult,
				rubric: rubricResult,
				roster: rosterResult,
				admin: adminResult,
			},
			null,
			2,
		),
	);
} finally {
	await client.close();
}

// --- Seeders ----------------------------------------------------------------

async function seedConfig(db: import("mongodb").Db) {
	const now = new Date();
	await db.collection(COLLECTIONS.config).updateOne(
		{ _id: CONFIG_SINGLETON_ID as never },
		{
			$set: {
				competitionName: "Probably Paradoxical",
				currentRoundKey: ROUND_KEYS.stage0Release,
				teamSize: { min: 2, max: 5 },
				targetPopulations: [
					"students",
					"professors",
					"shopkeepers",
					"teaching_assistants",
					"research_scholars",
				],
				scoringDefaults: { method: "weighted", judgeWeighting: true, passThreshold: null },
				updatedAt: now,
			},
		},
		{ upsert: true },
	);
	return { ok: true };
}

async function seedRounds(db: import("mongodb").Db) {
	const now = new Date();
	const rounds = [
		{ roundKey: ROUND_KEYS.stage0Release, order: 0, title: "Stage 0 — Problem Statement Release", submissionType: SUBMISSION_TYPE.none, requiresJudging: false },
		{ roundKey: ROUND_KEYS.stage1Submission, order: 1, title: "Stage 1 — Theme & Questionnaire Design", submissionType: SUBMISSION_TYPE.theme, requiresJudging: true, rubricKey: "questionnaire_v1" },
		{ roundKey: ROUND_KEYS.stage2DataCollection, order: 2, title: "Stage 2 — Data Collection / Survey Phase", submissionType: SUBMISSION_TYPE.dataset, requiresJudging: true },
		{ roundKey: ROUND_KEYS.stage3Analysis, order: 3, title: "Stage 3 — Data Cleaning & Data Analysis Phase", submissionType: SUBMISSION_TYPE.analysisZip, requiresJudging: true },
		{ roundKey: ROUND_KEYS.stage4Presentation, order: 4, title: "Stage 4 — Final Presentation", submissionType: SUBMISSION_TYPE.presentation, requiresJudging: true },
	];

	let upserted = 0;
	for (const round of rounds) {
		const result = await db.collection(COLLECTIONS.rounds).updateOne(
			{ roundKey: round.roundKey },
			{
				$set: { ...round, state: ROUND_STATE.upcoming, updatedAt: now },
				$setOnInsert: { createdAt: now },
			},
			{ upsert: true },
		);
		if (result.upsertedCount) upserted += 1;
	}
	return { total: rounds.length, upserted };
}

async function seedRubric(db: import("mongodb").Db) {
	const now = new Date();
	const result = await db.collection(COLLECTIONS.rubrics).updateOne(
		{ rubricKey: "questionnaire_v1", version: 1 },
		{
			$set: {
				appliesTo: "questionnaire",
				isActive: true,
				// Criteria sum to 50 points: 15 + 15 + 10 + 10.
				criteria: [
					{ key: "relevance", label: "Relevance to paradox & theme", maxScore: 15, weight: 1 },
					{ key: "clarity", label: "Clarity of items", maxScore: 15, weight: 1 },
					{ key: "methodology", label: "Methodological soundness", maxScore: 10, weight: 1 },
					{ key: "originality", label: "Originality", maxScore: 10, weight: 1 },
				],
				updatedAt: now,
			},
			$setOnInsert: { createdAt: now },
		},
		{ upsert: true },
	);
	return { upserted: result.upsertedCount, modified: result.modifiedCount };
}

async function seedRoster(db: import("mongodb").Db, teamInfo: unknown) {
	const teams = normalizeTeams(teamInfo);
	const defaultPassword = process.env.DEFAULT_TEAM_PASSWORD;
	const teamPasswords = process.env.TEAM_PASSWORDS_JSON ? JSON.parse(process.env.TEAM_PASSWORDS_JSON) : {};

	const now = new Date();
	let teamsUpserted = 0;
	let membersUpserted = 0;
	let memberships = 0;
	let credentials = 0;
	const skipped: string[] = [];

	for (const team of teams) {
		const validMembers = team.members.filter((m) => m.email.length > 0);
		if (validMembers.length === 0) {
			skipped.push(team.teamId);
			continue;
		}

		// Upsert members and capture their ids.
		const memberIds: ObjectId[] = [];
		for (const member of validMembers) {
			const doc = await db.collection(COLLECTIONS.members).findOneAndUpdate(
				{ email: member.email },
				{
					$set: { email: member.email, name: member.name, updatedAt: now },
					$setOnInsert: { createdAt: now },
				},
				{ upsert: true, returnDocument: "after" },
			);
			if (doc?._id) {
				memberIds.push(doc._id as ObjectId);
				membersUpserted += 1;
			}
		}

		const leadMemberId = memberIds[0];

		const teamResult = await db.collection(COLLECTIONS.teams).updateOne(
			{ teamId: team.teamId },
			{
				$set: { teamName: team.teamName, status: "active", leadMemberId, updatedAt: now },
				$setOnInsert: { teamId: team.teamId, createdAt: now },
			},
			{ upsert: true },
		);
		if (teamResult.upsertedCount) teamsUpserted += 1;

		// Map each member to the team; first valid member is the leader.
		for (let index = 0; index < memberIds.length; index += 1) {
			const tag = validMembers[index].tag;
			await db.collection(COLLECTIONS.teamMembers).updateOne(
				{ teamId: team.teamId, memberId: memberIds[index] },
				{
					$set: {
						roleInTeam: index === 0 ? "leader" : "member",
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

		// Team credential (shared password).
		const password = teamPasswords[team.teamId] ?? defaultPassword;
		if (typeof password === "string" && password.length > 0) {
			const digest = await hashPassword(password);
			await db.collection(COLLECTIONS.teamCredentials).updateOne(
				{ teamId: team.teamId },
				{ $set: { teamId: team.teamId, ...digest, updatedAt: now }, $setOnInsert: { createdAt: now } },
				{ upsert: true },
			);
			credentials += 1;
		}
	}

	return { teamsUpserted, membersUpserted, memberships, credentials, skippedTeams: skipped };
}

async function seedAdmin(db: import("mongodb").Db) {
	const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD;

	if (!email && !password) {
		return { skipped: true, reason: "ADMIN_EMAIL and ADMIN_PASSWORD not provided" };
	}
	if (!email || !password) {
		throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD, or leave both empty.");
	}

	const now = new Date();
	const digest = await hashPassword(password);
	const result = await db.collection(COLLECTIONS.admins).updateOne(
		{ email },
		{
			$set: {
				email,
				username: process.env.ADMIN_USERNAME?.trim() || email,
				name: process.env.ADMIN_NAME?.trim() || "Administrator",
				role: "admin",
				isActive: true,
				...digest,
				updatedAt: now,
			},
			$setOnInsert: { createdAt: now },
		},
		{ upsert: true },
	);

	return { matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount };
}

// --- Helpers ----------------------------------------------------------------

interface NormalizedMember {
	name: string;
	email: string;
	tag?: string;
}
interface NormalizedTeam {
	teamId: string;
	teamName: string;
	members: NormalizedMember[];
}

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
		if (member.tag) {
			normalized.tag = requireString(member.tag, `member.tag for ${teamId}`);
		}
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
	if (!value) {
		throw new Error(`${name} is required. Add it to backend/.env.`);
	}
	return value;
}

function inferDatabaseName(uri: string): string | undefined {
	try {
		const parsed = new URL(uri);
		return decodeURIComponent(parsed.pathname.replace(/^\//, "")) || undefined;
	} catch {
		return undefined;
	}
}

function loadEnvFile(path: string): void {
	if (!existsSync(path)) {
		return;
	}

	const contents = readFileSync(path, "utf8");
	for (const line of contents.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = stripQuotes(trimmedLine.slice(separatorIndex + 1).trim());
		process.env[key] ??= value;
	}
}

function stripQuotes(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}
