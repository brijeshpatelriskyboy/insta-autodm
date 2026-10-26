import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api, ApiError } from "./api";

async function scenario(code: string | undefined, storedToken: string, requestToken: string) {
  const originalFetch = globalThis.fetch;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map([["insta_autodm_token", storedToken], ["insta_autodm_user", "{}"]]);
  const redirects: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { replace: (url: string) => redirects.push(url) } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  } });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Authentication failed", code }), { status: 401 });
  try {
    await assert.rejects(api.me(requestToken), (error) => error instanceof ApiError && error.status === 401);
    return { redirects, token: values.get("insta_autodm_token"), user: values.get("insta_autodm_user") };
  } finally {
    globalThis.fetch = originalFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}
describe("deleted account session recovery", () => {
  it("clears the invalid account session and redirects to sign in", async () => {
    const result = await scenario("SESSION_INVALID", "removed-user-token", "removed-user-token");
    assert.deepEqual(result.redirects, ["/login"]);
    assert.equal(result.token, undefined);
    assert.equal(result.user, undefined);
  });
  it("does not clear a newer login when an older request fails", async () => {
    const result = await scenario("SESSION_INVALID", "new-user-token", "old-user-token");
    assert.deepEqual(result.redirects, []);
    assert.equal(result.token, "new-user-token");
  });
  it("does not log users out for a password-validation 401", async () => {
    const result = await scenario(undefined, "current-token", "current-token");
    assert.deepEqual(result.redirects, []);
    assert.equal(result.token, "current-token");
  });
});
