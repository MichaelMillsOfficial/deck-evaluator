import { test, expect } from "@playwright/test";
import { resolveEdhrecMeta, __clearEdhrecCache } from "../../src/lib/edhrec-fetch";

/**
 * Guards the SSRF-hardening of the EDHREC fetch boundary (PR #131 CodeQL alert):
 * the user-derived commander name is sanitized with `.replace(/[^a-z0-9-]/g, "")`
 * before it reaches the request URL, so it can only ever select a page under the
 * fixed https://json.edhrec.com/pages/commanders/<slug>.json path — no host,
 * scheme, or path-traversal injection. Behavior for real commanders is unchanged.
 *
 * We stub global.fetch to capture the exact URL that would go on the wire.
 */

const FIXED_PREFIX = "https://json.edhrec.com/pages/commanders/";
const captured: string[] = [];
let originalFetch: typeof fetch;

function stubFetch(status = 404) {
  originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    captured.push(typeof input === "string" ? input : input.toString());
    return new Response(status === 200 ? JSON.stringify({ cardlists: [] }) : "", {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

test.beforeEach(() => {
  captured.length = 0;
  __clearEdhrecCache();
});

test.afterEach(() => {
  if (originalFetch) global.fetch = originalFetch;
});

test.describe("EDHREC fetch URL is always under the fixed commander path", () => {
  test("a real commander produces the unchanged, expected URL", async () => {
    stubFetch(404);
    await resolveEdhrecMeta(["Atraxa, Praetors' Voice"]);
    expect(captured).toEqual([`${FIXED_PREFIX}atraxa-praetors-voice.json`]);
  });

  test("adversarial names cannot escape the host or path", async () => {
    stubFetch(404);
    const attacks = [
      "evil.com/../../secret",
      "http://169.254.169.254/latest/meta-data",
      "..%2F..%2Fadmin",
      "foo?x=https://evil.com",
      "a/../../b#frag",
    ];
    for (const name of attacks) {
      captured.length = 0;
      __clearEdhrecCache();
      await resolveEdhrecMeta([name]);
      for (const url of captured) {
        // Every URL stays under the hardcoded EDHREC commander path...
        expect(url.startsWith(FIXED_PREFIX)).toBe(true);
        // ...and the slug segment is allowlisted chars only, then ".json".
        const slug = url.slice(FIXED_PREFIX.length, -".json".length);
        expect(slug).toMatch(/^[a-z0-9-]*$/);
        // No traversal, host, scheme, or query survives into the request.
        expect(url).not.toMatch(/\/\.\.|:\/\/(?!json\.edhrec)|[?#]/);
      }
    }
  });

  test("a name that sanitizes to empty yields no-data with NO network call", async () => {
    stubFetch(404);
    const env = await resolveEdhrecMeta(["///.@!"]);
    expect(captured).toEqual([]); // no fetch at all
    expect(env.inclusionMap).toEqual({});
    expect(env.potentialDecks).toBe(0);
    expect(env.error).toBeUndefined();
  });
});
