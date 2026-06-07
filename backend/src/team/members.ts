import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { MemberDocument, TeamDocument, TeamMemberDocument } from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

// Synthetic per-team login accounts use this email domain; they are not real
// participants, so they're hidden from the roster.
const SYNTHETIC_EMAIL_DOMAIN = "probably.paradoxical";

/** Team-only: the signed-in team's active members. */
export async function handleTeamMembers(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}
	if (auth.role !== "team") {
		return { status: 403, body: { error: "Team access required." } };
	}

	const teamId = auth.teamId ?? auth.sub;

	try {
		return await withDatabase(env, async (db) => {
			const team = await db.collection<TeamDocument>(COLLECTIONS.teams).findOne({ teamId });
			if (!team) {
				return { status: 404, body: { error: "Team not found." } };
			}

			const memberships = await db
				.collection<TeamMemberDocument>(COLLECTIONS.teamMembers)
				.find({ teamId, status: "active" })
				.toArray();

			const memberIds = memberships.map((m) => m.memberId);
			const memberDocs = memberIds.length
				? await db
						.collection<MemberDocument>(COLLECTIONS.members)
						.find({ _id: { $in: memberIds } })
						.toArray()
				: [];
			const byId = new Map(memberDocs.map((doc) => [String(doc._id), doc]));
			const leadId = String(team.leadMemberId ?? "");

			const members = memberships
				.map((membership) => {
					const doc = byId.get(String(membership.memberId));
					if (!doc) return null;
					return {
						name: doc.name,
						email: doc.email,
						roleInTeam: membership.roleInTeam,
						tag: membership.tag ?? null,
						isLead: leadId === String(membership.memberId),
					};
				})
				.filter((m): m is NonNullable<typeof m> => m !== null)
				.filter((m) => !m.email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`));

			// Leaders first, then alphabetical by name.
			members.sort((a, b) =>
				a.isLead === b.isLead ? a.name.localeCompare(b.name) : a.isLead ? -1 : 1,
			);

			return {
				status: 200,
				body: { teamId: team.teamId, teamName: team.teamName, members },
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to load team members." },
		};
	}
}
