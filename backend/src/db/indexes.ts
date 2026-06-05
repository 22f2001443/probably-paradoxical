// Index definitions per collection. Partial indexes encode hard rules (one
// active team lead per team; one active membership per pair). The optional
// "one active team per member" rule from DB_DESIGN §11 is intentionally NOT
// created by default so seeding stays robust — enable it once confirmed.
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { COLLECTIONS } from "./collections.ts";

export interface IndexDefinition {
	keys: IndexSpecification;
	options: CreateIndexesOptions;
}

export const COLLECTION_INDEXES: Record<string, IndexDefinition[]> = {
	[COLLECTIONS.admins]: [
		{ keys: { email: 1 }, options: { name: "admins_email_unique", unique: true } },
		{ keys: { username: 1 }, options: { name: "admins_username_unique", unique: true, sparse: true } },
	],

	[COLLECTIONS.judges]: [
		{ keys: { email: 1 }, options: { name: "judges_email_unique", unique: true } },
		{ keys: { isActive: 1 }, options: { name: "judges_isActive" } },
	],

	[COLLECTIONS.teams]: [
		{ keys: { teamId: 1 }, options: { name: "teams_teamId_unique", unique: true } },
		{ keys: { status: 1 }, options: { name: "teams_status" } },
	],

	[COLLECTIONS.members]: [
		{ keys: { email: 1 }, options: { name: "members_email_unique", unique: true } },
	],

	[COLLECTIONS.teamMembers]: [
		{ keys: { teamId: 1, memberId: 1 }, options: { name: "team_members_pair_unique", unique: true } },
		{ keys: { memberId: 1 }, options: { name: "team_members_memberId" } },
		{ keys: { teamId: 1, status: 1 }, options: { name: "team_members_team_status" } },
		{
			keys: { teamId: 1 },
			options: {
				name: "team_members_one_active_leader",
				unique: true,
				partialFilterExpression: { roleInTeam: "leader", status: "active" },
			},
		},
	],

	[COLLECTIONS.teamCredentials]: [
		{ keys: { teamId: 1 }, options: { name: "team_credentials_teamId_unique", unique: true } },
	],

	[COLLECTIONS.rounds]: [
		{ keys: { roundKey: 1 }, options: { name: "rounds_roundKey_unique", unique: true } },
		{ keys: { order: 1 }, options: { name: "rounds_order" } },
		{ keys: { state: 1 }, options: { name: "rounds_state" } },
	],

	[COLLECTIONS.paradoxes]: [
		{ keys: { paradoxCode: 1 }, options: { name: "paradoxes_code_unique", unique: true } },
		{ keys: { state: 1 }, options: { name: "paradoxes_state" } },
	],

	[COLLECTIONS.rubrics]: [
		{ keys: { rubricKey: 1, version: 1 }, options: { name: "rubrics_key_version_unique", unique: true } },
		{ keys: { appliesTo: 1, isActive: 1 }, options: { name: "rubrics_appliesTo_active" } },
	],

	[COLLECTIONS.submissions]: [
		{ keys: { teamId: 1, roundKey: 1 }, options: { name: "submissions_team_round_unique", unique: true } },
		{ keys: { roundKey: 1, status: 1 }, options: { name: "submissions_round_status" } },
		{ keys: { "theme.paradoxCode": 1 }, options: { name: "submissions_paradox", sparse: true } },
	],

	[COLLECTIONS.questionnaires]: [
		{ keys: { teamId: 1 }, options: { name: "questionnaires_teamId_unique", unique: true } },
		{ keys: { status: 1 }, options: { name: "questionnaires_status" } },
	],

	[COLLECTIONS.files]: [
		{ keys: { r2Key: 1 }, options: { name: "files_r2Key_unique", unique: true } },
		{ keys: { submissionId: 1 }, options: { name: "files_submissionId", sparse: true } },
		{ keys: { teamId: 1, kind: 1 }, options: { name: "files_team_kind" } },
	],

	[COLLECTIONS.assignments]: [
		{ keys: { questionnaireId: 1, judgeId: 1 }, options: { name: "assignments_q_judge_unique", unique: true } },
		{ keys: { judgeId: 1, status: 1 }, options: { name: "assignments_judge_status" } },
		{ keys: { teamId: 1 }, options: { name: "assignments_teamId" } },
	],

	[COLLECTIONS.evaluations]: [
		{ keys: { questionnaireId: 1, judgeId: 1 }, options: { name: "evaluations_q_judge_unique", unique: true } },
		{ keys: { judgeId: 1, status: 1 }, options: { name: "evaluations_judge_status" } },
	],

	[COLLECTIONS.results]: [
		{ keys: { roundKey: 1, teamId: 1 }, options: { name: "results_round_team_unique", unique: true } },
		{ keys: { roundKey: 1, outcome: 1 }, options: { name: "results_round_outcome" } },
		{ keys: { roundKey: 1, rank: 1 }, options: { name: "results_round_rank", sparse: true } },
	],

	[COLLECTIONS.passwordResets]: [
		{ keys: { tokenHash: 1 }, options: { name: "password_resets_token_unique", unique: true } },
		{ keys: { email: 1 }, options: { name: "password_resets_email" } },
		// TTL: Mongo removes the document once expiresAt passes.
		{ keys: { expiresAt: 1 }, options: { name: "password_resets_ttl", expireAfterSeconds: 0 } },
	],

	[COLLECTIONS.auditEvents]: [
		{ keys: { at: -1 }, options: { name: "audit_at" } },
		{ keys: { targetType: 1, targetId: 1 }, options: { name: "audit_target" } },
		{ keys: { actorRole: 1, actorId: 1 }, options: { name: "audit_actor" } },
	],
};
