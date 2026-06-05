import type { AppEnv } from "./db/mongodb";
import { handleLogin } from "./auth/login";
import { handleSignup } from "./auth/signup";
import { openApiSpec, swaggerUiHtml } from "./docs/openapi";

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const url = new URL(request.url);

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

		if (request.method === "GET" && url.pathname === "/docs") {
			return new Response(swaggerUiHtml, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		if (request.method === "POST" && url.pathname === "/setup/database") {
			return setupDatabase(request, env);
		}

		if (request.method === "POST" && url.pathname === "/auth/signup") {
			const result = await handleSignup(request, env);
			return jsonResponse(result.body, result.status);
		}

		if (request.method === "POST" && url.pathname === "/auth/login") {
			const result = await handleLogin(request, env);
			return jsonResponse(result.body, result.status);
		}

		return jsonResponse({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<AppEnv>;

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
