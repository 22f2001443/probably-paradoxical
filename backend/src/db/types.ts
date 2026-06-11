// TypeScript shapes for every collection document. Used with the MongoDB
// driver's generic collections, e.g. `db.collection<TeamDocument>(...)`.
import type { ObjectId } from "mongodb";
import type {
	AssignmentStatus,
	AttendanceDayKey,
	AuditActorRole,
	EvaluationStatus,
	FileKind,
	MembershipStatus,
	ParadoxState,
	QuestionItemType,
	QuestionnaireStatus,
	Recommendation,
	ResultOutcome,
	RoundKey,
	RoundState,
	RubricAppliesTo,
	ScoringMethod,
	SubmissionStatus,
	SubmissionType,
	TeamMemberRole,
	TeamStatus,
} from "./collections.ts";

/** PBKDF2 digest fields, embedded inline on credential-bearing documents. */
export interface PasswordDigest {
	passwordHash: string;
	passwordSalt: string;
	passwordAlgorithm: string;
	passwordIterations: number;
}

interface Timestamps {
	createdAt: Date;
	updatedAt: Date;
}

export interface AdminDocument extends PasswordDigest, Timestamps {
	_id?: ObjectId;
	email: string;
	username?: string;
	name?: string;
	role: "admin";
	isActive: boolean;
	lastLoginAt?: Date;
}

export interface JudgeDocument extends PasswordDigest, Timestamps {
	_id?: ObjectId;
	email: string;
	name: string;
	affiliation?: string;
	expertise?: string[];
	defaultWeight?: number;
	isActive: boolean;
	lastLoginAt?: Date;
}

export interface TeamProgressEntry {
	roundKey: RoundKey;
	outcome: ResultOutcome;
	at: Date;
}

export interface TeamDocument extends Timestamps {
	_id?: ObjectId;
	teamId: string;
	teamName: string;
	/** Computed: true only when the team has no `unregistered` member. */
	pure?: boolean;
	iconFileId?: ObjectId;
	leadMemberId?: ObjectId;
	status: TeamStatus;
	currentRoundKey?: RoundKey;
	progress?: TeamProgressEntry[];
}

export interface MemberDocument extends Timestamps {
	_id?: ObjectId;
	email: string;
	name: string;
	gender?: string;
	level?: string;
	phone?: string;
	affiliation?: string;
}

export interface AttendanceDocument extends Timestamps {
	_id?: ObjectId;
	teamId: string;
	day: AttendanceDayKey;
	present: boolean;
	markedBy: ObjectId;
	markedAt: Date;
}

export interface TeamMemberDocument extends Timestamps {
	_id?: ObjectId;
	teamId: string;
	memberId: ObjectId;
	roleInTeam: TeamMemberRole;
	tag?: string;
	status: MembershipStatus;
	joinedAt: Date;
}

export interface TeamCredentialDocument extends PasswordDigest, Timestamps {
	_id?: ObjectId;
	teamId: string;
	lastUsedAt?: Date;
}

export interface ScoringConfig {
	method: ScoringMethod;
	judgeWeighting: boolean;
	passThreshold?: number | null;
}

export interface ConfigDocument {
	_id: string;
	competitionName?: string;
	branding?: Record<string, unknown>;
	currentRoundKey: RoundKey;
	teamSize: { min: number; max: number };
	targetPopulations: string[];
	scoringDefaults: ScoringConfig;
	featureFlags?: Record<string, unknown>;
	updatedAt: Date;
}

export interface RoundDocument extends Timestamps {
	_id?: ObjectId;
	roundKey: RoundKey;
	order: number;
	title: string;
	description?: string;
	opensAt?: Date;
	closesAt?: Date;
	state: RoundState;
	submissionType: SubmissionType;
	requiresJudging: boolean;
	rubricKey?: string;
	scoring?: ScoringConfig;
}

export interface ParadoxDocument extends Timestamps {
	_id?: ObjectId;
	paradoxCode: string;
	name: string;
	description: string;
	example?: string;
	category?: string;
	tags?: string[];
	state: ParadoxState;
	publishedAt?: Date;
}

export interface RubricCriterion {
	key: string;
	label: string;
	description?: string;
	maxScore: number;
	weight: number;
}

export interface RubricDocument extends Timestamps {
	_id?: ObjectId;
	rubricKey: string;
	version: number;
	appliesTo: RubricAppliesTo;
	criteria: RubricCriterion[];
	isActive: boolean;
}

export interface ThemePayload {
	paradoxCode: string;
	theme: string;
	targetPopulation: string;
	rationale?: string;
}

export interface SubmissionDocument extends Timestamps {
	_id?: ObjectId;
	teamId: string;
	roundKey: RoundKey;
	type: SubmissionType;
	status: SubmissionStatus;
	theme?: ThemePayload;
	questionnaireId?: ObjectId;
	fileIds?: ObjectId[];
	submittedByMemberId?: ObjectId;
	submittedAt?: Date;
	reviewedBy?: ObjectId;
	reviewedAt?: Date;
	decisionNote?: string;
}

export interface QuestionItem {
	itemId: string;
	order: number;
	type: QuestionItemType;
	prompt: string;
	options?: string[];
	meta?: Record<string, unknown>;
}

export interface QuestionnaireDocument extends Timestamps {
	_id?: ObjectId;
	teamId: string;
	paradoxCode: string;
	theme: string;
	targetPopulation: string;
	status: QuestionnaireStatus;
	items: QuestionItem[];
	lockedAt?: Date;
}

export interface FileDocument {
	_id?: ObjectId;
	r2Key: string;
	kind: FileKind;
	originalName: string;
	contentType: string;
	extension: string;
	sizeBytes: number;
	checksum?: string;
	teamId: string;
	roundKey?: RoundKey;
	submissionId?: ObjectId;
	uploadedAt: Date;
	uploadedByMemberId?: ObjectId;
	uploadedByEmail: string;
}

export interface AssignmentDocument extends Timestamps {
	_id?: ObjectId;
	questionnaireId: ObjectId;
	judgeId: ObjectId;
	teamId: string;
	weight?: number;
	status: AssignmentStatus;
	assignedBy: ObjectId;
	assignedAt: Date;
	dueAt?: Date;
}

export interface ItemScore {
	itemId: string;
	criterionKey: string;
	score: number;
	comment?: string;
}

export interface CriterionScore {
	criterionKey: string;
	score: number;
}

export interface EvaluationDocument extends Timestamps {
	_id?: ObjectId;
	questionnaireId: ObjectId;
	judgeId: ObjectId;
	teamId: string;
	rubricKey: string;
	rubricVersion: number;
	itemScores?: ItemScore[];
	criterionScores: CriterionScore[];
	rawTotal: number;
	recommendation?: Recommendation;
	status: EvaluationStatus;
	submittedAt?: Date;
}

export interface ResultDocument {
	_id?: ObjectId;
	roundKey: RoundKey;
	teamId: string;
	/** "pending" = a saved score with no published decision yet (hidden from teams). */
	outcome: ResultOutcome | "pending";
	aggregateScore?: number;
	rank?: number;
	breakdown?: Record<string, unknown>;
	summary?: string;
	publishedBy: ObjectId;
	publishedAt: Date;
}

export interface RoundScheduleDocument {
	_id?: ObjectId;
	roundKey: RoundKey;
	/** When the transition should run (UTC). */
	runAt: Date;
	status: "pending" | "applied" | "cancelled";
	/** Setting a stage current cascades states (prev → stale, next → upcoming). */
	makeCurrent: boolean;
	createdBy: string;
	createdAt: Date;
	appliedAt?: Date;
}

export interface PasswordResetDocument {
	_id?: ObjectId;
	tokenHash: string;
	/** Which credential store the reset targets. */
	subjectType: "admin" | "judge" | "team";
	/** admins/judges: stringified ObjectId; teams: teamId. */
	subjectId: string;
	email: string;
	expiresAt: Date;
	usedAt?: Date;
	createdAt: Date;
}

export interface AuditEventDocument {
	_id?: ObjectId;
	actorRole: AuditActorRole;
	actorId: string;
	action: string;
	targetType: string;
	targetId: string;
	before?: Record<string, unknown>;
	after?: Record<string, unknown>;
	ip?: string;
	userAgent?: string;
	at: Date;
}
