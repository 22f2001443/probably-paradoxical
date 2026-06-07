import type { AppEnv } from "./db/mongodb";
import { handleLogin } from "./auth/login";
import { handleSignup } from "./auth/signup";
import { handleForgotPassword } from "./auth/forgotPassword";
import { handleResetPassword } from "./auth/resetPassword";
import { handleChangePassword } from "./auth/changePassword";
import { handleAdminOverview } from "./admin/overview";
import { handleTeamMembers } from "./team/members";
import { handleThemeSubmission } from "./team/themeSubmission";
import { handleDatasetSubmission } from "./team/datasetSubmission";
import { handleAnalysisSubmission } from "./team/analysisSubmission";
import { handlePresentationSubmission } from "./team/presentationSubmission";
import { handleTeamResults } from "./team/results";
import { handleUpdateRound, handleCancelSchedule } from "./admin/updateRound";
import { runDueSchedules } from "./admin/roundTransitions";
import {
	handleListParadoxes,
	handleListPublishedParadoxes,
	handleCreateParadox,
	handleUpdateParadox,
	handleDeleteParadox,
} from "./admin/paradoxes";
import {
	handleListAssignments,
	handleCreateAssignment,
	handleDeleteAssignment,
	handleAutoAssign,
} from "./admin/assignments";
import { handleListResults, handlePublishResults } from "./admin/results";
import { handleJudgeQueue, handleSubmitEvaluation } from "./judge/evaluations";
import { clientKey, rateLimit } from "./security/rateLimit";
import { openApiSpec, swaggerUiHtml } from "./docs/openapi";

// Auth endpoints: max attempts per IP per 60s window.
const AUTH_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const cors = corsHeaders(request);

		// CORS preflight — the SPA lives on a different origin than this Worker.
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors });
		}

		const response = await route(request, env);
		for (const [key, value] of Object.entries(cors)) {
			response.headers.set(key, value);
		}
		return response;
	},

	// Cron trigger (see wrangler.jsonc): applies any due scheduled stage
	// transitions. Runs every minute in production.
	async scheduled(_event, env, ctx): Promise<void> {
		ctx.waitUntil(runDueSchedules(env));
	},
} satisfies ExportedHandler<AppEnv>;

async function route(request: Request, env: AppEnv): Promise<Response> {
	const url = new URL(request.url);

	{
		if (request.method === "GET" && url.pathname === "/") {
			return jsonResponse({
				ok: true,
				service: "probably-paradoxical-backend",
			});
		}

		if (request.method === "GET" && url.pathname === "/health") {
			return jsonResponse({ ok: true });
		}

		if (request.method === "GET" && url.pathname === "/openapi.json") {
			return jsonResponse(openApiSpec);
		}

		if (request.method === "GET" && url.pathname === "/admin/overview") {
			const result = await handleAdminOverview(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/rounds") {
			const result = await handleUpdateRound(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/rounds/cancel") {
			const result = await handleCancelSchedule(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/admin/paradoxes") {
			const result = await handleListParadoxes(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/paradoxes") {
			const result = await handleCreateParadox(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/paradoxes/update") {
			const result = await handleUpdateParadox(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/paradoxes/delete") {
			const result = await handleDeleteParadox(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/admin/assignments") {
			const result = await handleListAssignments(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/assignments") {
			const result = await handleCreateAssignment(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/assignments/delete") {
			const result = await handleDeleteAssignment(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/assignments/auto") {
			const result = await handleAutoAssign(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/admin/results") {
			const result = await handleListResults(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/admin/results/publish") {
			const result = await handlePublishResults(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/judge/queue") {
			const result = await handleJudgeQueue(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/judge/evaluations") {
			const result = await handleSubmitEvaluation(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/paradoxes") {
			const result = await handleListPublishedParadoxes(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/team/members") {
			const result = await handleTeamMembers(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/team/theme-submission") {
			const result = await handleThemeSubmission(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/team/dataset-submission") {
			const result = await handleDatasetSubmission(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/team/analysis-submission") {
			const result = await handleAnalysisSubmission(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/team/presentation-submission") {
			const result = await handlePresentationSubmission(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/team/results") {
			const result = await handleTeamResults(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "GET" && url.pathname === "/docs") {
			return new Response(swaggerUiHtml, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		if (request.method === "POST" && url.pathname === "/setup/database") {
			return setupDatabase(request, env);
		}

		if (request.method === "POST" && url.pathname === "/auth/signup") {
			const limited = await enforceRateLimit(request, env, url.pathname);
			if (limited) return limited;
			const result = await handleSignup(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/auth/login") {
			const limited = await enforceRateLimit(request, env, url.pathname);
			if (limited) return limited;
			const result = await handleLogin(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/auth/forgot-password") {
			const limited = await enforceRateLimit(request, env, url.pathname);
			if (limited) return limited;
			const result = await handleForgotPassword(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/auth/reset-password") {
			const limited = await enforceRateLimit(request, env, url.pathname);
			if (limited) return limited;
			const result = await handleResetPassword(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/auth/change-password") {
			const limited = await enforceRateLimit(request, env, url.pathname);
			if (limited) return limited;
			const result = await handleChangePassword(request, env);
			return jsonResponse(result.body, result.status);
		}

		return jsonResponse({ error: "Not found" }, 404);
	}
}

/** Returns a 429 response if the caller is over the auth rate limit, else null. */
async function enforceRateLimit(
	request: Request,
	env: AppEnv,
	scope: string,
): Promise<Response | null> {
	const result = await rateLimit(clientKey(request, scope), {
		...AUTH_RATE_LIMIT,
		binding: env.AUTH_RATE_LIMITER,
	});
	if (result.allowed) {
		return null;
	}
	return new Response(
		JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }),
		{
			status: 429,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"Retry-After": String(result.retryAfter),
			},
		},
	);
}

function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("Origin");
	return {
		"Access-Control-Allow-Origin": origin || "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "content-type, authorization, x-setup-secret",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

async function setupDatabase(request: Request, env: AppEnv): Promise<Response> {
	if (!env.SETUP_SECRET) {
		return jsonResponse({ error: "SETUP_SECRET is not configured." }, 503);
	}

	if (request.headers.get("x-setup-secret") !== env.SETUP_SECRET) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	try {
		const { ensureDatabase } = await import("./db/mongodb");
		const result = await ensureDatabase(env);
		return jsonResponse({ ok: true, ...result });
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return jsonResponse(
			{
				error: error instanceof Error ? error.message : "Failed to set up database.",
			},
			status,
		);
	}
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}
