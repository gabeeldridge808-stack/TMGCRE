import { describe, expect, it, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken, type SessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-do-not-use-in-production-aaaaaaaa";
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  const user: SessionUser = { id: "11111111-1111-1111-1111-111111111111", email: "a@b.com", name: "A B", role: "admin" };

  it("round-trips a valid session", async () => {
    const token = await createSessionToken(user);
    const verified = await verifySessionToken(token);
    expect(verified).toEqual(user);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(user);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
