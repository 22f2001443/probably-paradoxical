import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { createJwt, verifyJwt } from "../src/security/jwt.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("backend worker", () => {
	it("responds to health checks", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("guards database setup when no setup secret is configured", async () => {
		const request = new IncomingRequest("http://example.com/setup/database", {
			method: "POST",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "SETUP_SECRET is not configured.",
		});
	});

	it("rejects login requests without valid JSON", async () => {
		const request = new IncomingRequest("http://example.com/auth/login", {
			method: "POST",
			body: "not-json",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must be valid JSON.",
		});
	});

	it("rejects login requests without email and password", async () => {
		const request = new IncomingRequest("http://example.com/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: "admin@example.com" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Email and password are required.",
		});
	});

	it("guards login when no JWT secret is configured", async () => {
		const request = new IncomingRequest("http://example.com/auth/login", {
			method: "POST",
			body: JSON.stringify({
				email: "admin@example.com",
				password: "password",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "JWT_SECRET is not configured.",
		});
	});

	it("responds to health checks in integration style", async () => {
		const response = await SELF.fetch("https://example.com/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
});

describe("jwt", () => {
	it("signs and verifies JWT payloads", async () => {
		const secret = "test-secret-that-is-long-enough-for-hs256";
		const token = await createJwt(
			{
				sub: "T01",
				role: "team",
				email: "member@example.com",
			},
			secret,
			{ expiresInSeconds: 60 },
		);

		const payload = await verifyJwt(token, secret);

		expect(payload).toMatchObject({
			sub: "T01",
			role: "team",
			email: "member@example.com",
		});
	});

	it("rejects JWTs signed with another secret", async () => {
		const token = await createJwt(
			{ sub: "admin", role: "admin" },
			"test-secret-that-is-long-enough-for-hs256",
			{ expiresInSeconds: 60 },
		);

		const payload = await verifyJwt(
			token,
			"different-secret-that-is-long-enough-for-hs256",
		);

		expect(payload).toBeNull();
	});
});
