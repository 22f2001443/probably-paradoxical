// Central registry of collection names, the schema version, and every enum
// (modelled as `const` objects + union types so the modules stay erasable and
// runnable under Node's native TypeScript stripping).

export const DATABASE_SCHEMA_VERSION = 2;

export const COLLECTIONS = Object.freeze({
	admins: "admins",
	judges: "judges",
	teams: "teams",
	members: "members",
	teamMembers: "team_members",
	teamCredentials: "team_credentials",
	config: "config",
	rounds: "rounds",
	paradoxes: "paradoxes",
	rubrics: "rubrics",
	submissions: "submissions",
	questionnaires: "questionnaires",
	files: "files",
	assignments: "assignments",
	evaluations: "evaluations",
	results: "results",
	auditEvents: "audit_events",
} as const);

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const CONFIG_SINGLETON_ID = "singleton";

// --- Enumerations -----------------------------------------------------------

export const ROLES = Object.freeze({ admin: "admin", team: "team", judge: "judge" } as const);
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const TEAM_STATUS = Object.freeze({
	active: "active",
	eliminated: "eliminated",
	winner: "winner",
	withdrawn: "withdrawn",
} as const);
export type TeamStatus = (typeof TEAM_STATUS)[keyof typeof TEAM_STATUS];

export const TEAM_MEMBER_ROLE = Object.freeze({ leader: "leader", member: "member" } as const);
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLE)[keyof typeof TEAM_MEMBER_ROLE];

export const MEMBERSHIP_STATUS = Object.freeze({ active: "active", removed: "removed" } as const);
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const ROUND_KEYS = Object.freeze({
	inauguration: "inauguration",
	stage1Submission: "stage1_submission",
	stage1Selection: "stage1_selection",
	dataCollection: "data_collection",
	analysis: "analysis",
} as const);
export type RoundKey = (typeof ROUND_KEYS)[keyof typeof ROUND_KEYS];

export const ROUND_STATE = Object.freeze({
	upcoming: "upcoming",
	open: "open",
	closed: "closed",
	resultsPublished: "results_published",
} as const);
export type RoundState = (typeof ROUND_STATE)[keyof typeof ROUND_STATE];

export const SUBMISSION_TYPE = Object.freeze({
	none: "none",
	theme: "theme",
	dataset: "dataset",
	analysisZip: "analysis_zip",
} as const);
export type SubmissionType = (typeof SUBMISSION_TYPE)[keyof typeof SUBMISSION_TYPE];

export const SUBMISSION_STATUS = Object.freeze({
	draft: "draft",
	submitted: "submitted",
	underReview: "under_review",
	accepted: "accepted",
	rejected: "rejected",
} as const);
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];

export const QUESTIONNAIRE_STATUS = Object.freeze({
	draft: "draft",
	submitted: "submitted",
	underReview: "under_review",
	finalized: "finalized",
} as const);
export type QuestionnaireStatus = (typeof QUESTIONNAIRE_STATUS)[keyof typeof QUESTIONNAIRE_STATUS];

export const QUESTION_ITEM_TYPE = Object.freeze({
	likert: "likert",
	mcq: "mcq",
	open: "open",
	scale: "scale",
} as const);
export type QuestionItemType = (typeof QUESTION_ITEM_TYPE)[keyof typeof QUESTION_ITEM_TYPE];

export const FILE_KIND = Object.freeze({
	teamIcon: "team_icon",
	dataset: "dataset",
	analysisZip: "analysis_zip",
} as const);
export type FileKind = (typeof FILE_KIND)[keyof typeof FILE_KIND];

export const PARADOX_STATE = Object.freeze({ draft: "draft", published: "published" } as const);
export type ParadoxState = (typeof PARADOX_STATE)[keyof typeof PARADOX_STATE];

export const ASSIGNMENT_STATUS = Object.freeze({
	assigned: "assigned",
	inProgress: "in_progress",
	completed: "completed",
} as const);
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

export const EVALUATION_STATUS = Object.freeze({ draft: "draft", submitted: "submitted" } as const);
export type EvaluationStatus = (typeof EVALUATION_STATUS)[keyof typeof EVALUATION_STATUS];

export const RECOMMENDATION = Object.freeze({
	advance: "advance",
	borderline: "borderline",
	reject: "reject",
} as const);
export type Recommendation = (typeof RECOMMENDATION)[keyof typeof RECOMMENDATION];

export const RESULT_OUTCOME = Object.freeze({
	advanced: "advanced",
	eliminated: "eliminated",
} as const);
export type ResultOutcome = (typeof RESULT_OUTCOME)[keyof typeof RESULT_OUTCOME];

export const SCORING_METHOD = Object.freeze({ average: "average", weighted: "weighted" } as const);
export type ScoringMethod = (typeof SCORING_METHOD)[keyof typeof SCORING_METHOD];

export const AUDIT_ACTOR_ROLE = Object.freeze({
	admin: "admin",
	team: "team",
	judge: "judge",
	system: "system",
} as const);
export type AuditActorRole = (typeof AUDIT_ACTOR_ROLE)[keyof typeof AUDIT_ACTOR_ROLE];

export const RUBRIC_APPLIES_TO = Object.freeze({ questionnaire: "questionnaire" } as const);
export type RubricAppliesTo = (typeof RUBRIC_APPLIES_TO)[keyof typeof RUBRIC_APPLIES_TO];
