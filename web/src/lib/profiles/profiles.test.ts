import { sql } from "kysely";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getDb } from "@/db/client";
import { fakeAccount, newCid } from "@/test/atproto";
import { setUpTestDatabase } from "@/test/database";
import {
  fetchAvatar,
  fetchProfiles,
  fetchUserProfile,
  profileSchema,
  saveProfile,
} from ".";

// `getDb` waits on Next.js to opt out of prerendering, which needs a request.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

setUpTestDatabase();

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const CAROL = "did:plc:carol";

/** Inserts a profile as if ingested from `did`'s repository. */
async function insertUser(
  did: string,
  {
    name,
    picture,
    tombstoned = false,
  }: {
    name: string;
    picture?: { cid: string; mimeType: string };
    tombstoned?: boolean;
  },
) {
  const db = await getDb();
  await db
    .insertInto("users")
    .values({
      uri: `at://${did}/app.attrails.actor.profile/self`,
      cid: await newCid(),
      did,
      name,
      bio: null,
      profile_picture_uri: picture
        ? JSON.stringify({
            $type: "blob",
            ref: { $link: picture.cid },
            mimeType: picture.mimeType,
            size: 1000,
          })
        : null,
      sort_at: sql<Temporal.Instant>`now()`,
      created_at: sql<Temporal.Instant>`now()`,
      ingested_at: sql<Temporal.Instant>`now()`,
      tombstoned,
    })
    .execute();
}

/** Answers the Bluesky AppView's profile lookups with `handles`. */
function stubBskyHandles(handles: Record<string, string> | Error) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    if (handles instanceof Error) {
      throw handles;
    }
    return Response.json({
      profiles: Object.entries(handles).map(([did, handle]) => ({
        did,
        handle,
      })),
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetching profiles", () => {
  test("falls back to the handle or DID for accounts without a profile", async () => {
    const picture = await newCid();
    await insertUser(ALICE, {
      name: "Alice",
      picture: { cid: picture, mimeType: "image/png" },
    });
    await insertUser(BOB, { name: "Bob", tombstoned: true });
    stubBskyHandles({ [ALICE]: "alice.test", [CAROL]: "carol.test" });

    const profiles = await fetchProfiles([CAROL, ALICE, BOB]);

    expect(profiles).toEqual([
      {
        did: CAROL,
        handle: "carol.test",
        displayName: null,
        bio: null,
        avatarUrl: null,
      },
      {
        did: ALICE,
        handle: "alice.test",
        displayName: "Alice",
        bio: null,
        avatarUrl: `/users/${encodeURIComponent(ALICE)}/avatar/${picture}`,
      },
      {
        did: BOB,
        handle: null,
        displayName: null,
        bio: null,
        avatarUrl: null,
      },
    ]);
    expect(await fetchUserProfile(ALICE)).toEqual(profiles[1]);
    expect(await fetchUserProfile(CAROL)).toBeNull();
  });

  test("still works when Bluesky is unavailable", async () => {
    await insertUser(ALICE, { name: "Alice" });
    stubBskyHandles(new Error("Bluesky is down"));

    const [profile] = await fetchProfiles([ALICE]);

    expect(profile).toMatchObject({ displayName: "Alice", handle: null });
  });

  test("only serves an account's current picture, in raster formats", async () => {
    const svg = await newCid();
    await insertUser(ALICE, {
      name: "Alice",
      picture: { cid: svg, mimeType: "image/svg+xml" },
    });

    expect(await fetchAvatar(ALICE, svg)).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(await fetchAvatar(ALICE, await newCid())).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("validating profiles", () => {
  test("accepts a name with an optional bio", () => {
    expect(profileSchema.parse({ name: " Alice ", bio: "" })).toEqual({
      name: "Alice",
      bio: "",
    });
  });

  test.each([
    { name: "  ", bio: "" },
    { name: "a".repeat(101), bio: "" },
    { name: "Alice", bio: "a".repeat(3001) },
  ])("rejects %o", (input) => {
    expect(profileSchema.safeParse(input).success).toBe(false);
  });
});

describe("saving profiles", () => {
  const current = {
    $type: "app.attrails.actor.profile",
    name: "Alice",
    profilePicture: {
      $type: "blob",
      ref: {
        $link: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      },
      mimeType: "image/png",
      size: 1000,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  test("keeps fields people don't edit, and only saves over the expected version", async () => {
    const { agent, writes } = fakeAccount(ALICE, {
      records: { "app.attrails.actor.profile": current },
    });

    const result = await saveProfile(
      agent,
      { name: "Alice B", bio: "" },
      { swapCid: "expected" },
    );

    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        method: "com.atproto.repo.putRecord",
        input: expect.objectContaining({
          swapRecord: "expected",
          record: { ...current, name: "Alice B" },
        }),
      },
    ]);
  });

  test("reports a conflict when the profile changed since it was read", async () => {
    const { agent } = fakeAccount(ALICE, {
      records: { "app.attrails.actor.profile": current },
      errors: { "com.atproto.repo.putRecord": "InvalidSwap" },
    });

    expect(
      await saveProfile(
        agent,
        { name: "Alice B", bio: "" },
        { swapCid: "old" },
      ),
    ).toEqual({ ok: false, reason: "conflict" });
  });
});
