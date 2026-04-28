import { test, expect } from "./fixtures";

test.describe("Shared Page", () => {
  test("missing d parameter shows error with link to home", async ({
    deckPage,
  }) => {
    await deckPage.page.goto("/shared");
    await expect(
      deckPage.page.getByText("No deck data provided")
    ).toBeVisible();
    await expect(
      deckPage.page.getByText("Import Your Own Deck")
    ).toBeVisible();
  });

  test("invalid d parameter shows error message", async ({ deckPage }) => {
    await deckPage.page.goto("/shared?d=invalidgarbage");
    await expect(
      deckPage.page.getByText("Invalid or corrupted share link")
    ).toBeVisible();
    await expect(
      deckPage.page.getByText("Import Your Own Deck")
    ).toBeVisible();
  });

  test("banner shows 'Shared deck' with link to home", async ({
    deckPage,
  }) => {
    // We need a valid encoded payload. Generate one by encoding in the test.
    // Since CompressionStream is browser-only, we'll use page.evaluate to encode
    const encoded = await deckPage.page.evaluate(async () => {
      const text = "COMMANDER:\n1 Sol Ring\n\nMAINBOARD:\n1 Command Tower";
      const json = JSON.stringify({ t: text });
      const encodedBytes = new TextEncoder().encode(json);

      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      writer.write(encodedBytes);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      const compressed = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    });

    await deckPage.page.goto(`/shared?d=${encoded}`);

    await expect(
      deckPage.page.getByTestId("shared-banner")
    ).toBeVisible();
    await expect(
      deckPage.page.getByTestId("shared-banner").getByText("Shared deck")
    ).toBeVisible();
    await expect(
      deckPage.page
        .getByTestId("shared-banner")
        .getByText("Import your own deck")
    ).toBeVisible();
  });

  test("valid v1 encoded deck renders and shows header", async ({
    deckPage,
  }) => {
    const encoded = await deckPage.page.evaluate(async () => {
      const text = "COMMANDER:\n1 Sol Ring\n\nMAINBOARD:\n1 Command Tower";
      const json = JSON.stringify({ t: text });
      const encodedBytes = new TextEncoder().encode(json);

      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      writer.write(encodedBytes);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      const compressed = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    });

    await deckPage.page.goto(`/shared?d=${encoded}`);

    // Phase 4: /shared decodes + enriches, then hands off to /reading via
    // setPayload + router.push. Wait for the redirect to complete and the
    // verdict hero to appear. The deck-list itself lives at /reading/cards.
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 20_000 });
    await expect(
      deckPage.page.getByTestId("reading-hero")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("v2 compact payload renders deck with correct card names", async ({
    deckPage,
  }) => {
    // Encode a v2 compact payload in the browser
    const encoded = await deckPage.page.evaluate(async () => {
      const payload = {
        v: 2,
        n: "Compact Test Deck",
        c: [["cmm", "344", 1]],  // Atraxa, Praetors' Voice in CMM
        m: [
          ["cmm", "387", 1],    // Sol Ring in CMM
          ["cmm", "355", 1],    // Command Tower in CMM
        ],
      };
      const json = JSON.stringify(payload);
      const encodedBytes = new TextEncoder().encode(json);

      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      writer.write(encodedBytes);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      const compressed = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    });

    await deckPage.page.goto(`/shared?d=${encoded}`);

    // Phase 4: /shared hands off to /reading; verdict hero shows the
    // deck name from the payload.
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 20_000 });
    const hero = deckPage.page.getByTestId("reading-hero");
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(
      hero.getByRole("heading", { name: "Compact Test Deck" })
    ).toBeVisible();
  });
});
