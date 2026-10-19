import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

const stripe = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("stripe")>();
  class FakeStripe {
    static errors = actual.default.errors;
    promotionCodes = { update: stripe.update };
  }
  return { default: FakeStripe };
});

const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "admin",
  email: "admin@example.com",
  emailVerified: true,
};

async function setup(stripeCodes = ["A", "B"]) {
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("admins", { email: identity.email }));
  const admin = t.withIdentity(identity);
  const event = await admin.mutation(api.events.create, { name: "Meetup" });
  const batchId = await t.run(async (ctx) => {
    const batchId: Id<"stripeBatches"> = await ctx.db.insert("stripeBatches", {
      name: "Meetup codes",
      prefix: "MEET",
      amountCents: 20000,
      quantity: stripeCodes.length,
      live: false,
      createdBy: identity.email,
      requestId: "request-1",
      requestFingerprint: "fp",
      status: "complete",
      version: 1,
      codes: stripeCodes.map((code) => ({ id: `promo_${code}`, code })),
      eventId: event.id,
      targetEventId: event.id,
      codeType: "Day one",
    });
    for (const code of stripeCodes) {
      await ctx.db.insert("codes", {
        eventId: event.id,
        code,
        codeType: "Day one",
        stripeBatchId: batchId,
      });
    }
    await ctx.db.insert("codes", {
      eventId: event.id,
      code: "PASTED",
      codeType: "Day one",
    });
    await ctx.db.patch(event.id, { codeTypes: ["Day one"] });
    return batchId;
  });
  return { t, admin, event, batchId };
}

async function drain(t: ReturnType<typeof convexTest>) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function sync(t: ReturnType<typeof convexTest>, eventId: Id<"events">) {
  const event = await t.run((ctx) => ctx.db.get(eventId));
  return event?.stripeArchiveSync?.["Day one"];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("STRIPE_API_KEY", "sk_test_mock_not_a_real_key");
  stripe.update
    .mockReset()
    .mockImplementation(async (id: string, params: { active: boolean }) => ({
      id,
      active: params.active,
    }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("archiving deactivates the block's Stripe promotion codes and unarchiving reactivates them", async () => {
  const { t, admin, event } = await setup();
  const res = await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  expect(res).toMatchObject({ unclaimed: 3, claimed: 0, stripeCodes: 2 });
  expect(await sync(t, event.id)).toMatchObject({
    status: "pending",
    active: false,
    total: 2,
  });
  await drain(t);
  expect(stripe.update.mock.calls).toEqual([
    ["promo_A", { active: false }],
    ["promo_B", { active: false }],
  ]);
  expect(await sync(t, event.id)).toMatchObject({
    status: "done",
    updated: 2,
    failed: 0,
  });

  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: false,
  });
  await drain(t);
  expect(stripe.update.mock.calls.slice(2)).toEqual([
    ["promo_A", { active: true }],
    ["promo_B", { active: true }],
  ]);
  expect(await sync(t, event.id)).toMatchObject({
    status: "done",
    active: true,
    updated: 2,
  });
  const actions = (
    await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_event", (q) => q.eq("eventId", event.id))
        .collect(),
    )
  ).map((entry) => entry.action);
  expect(actions).toEqual(
    expect.arrayContaining([
      "stripe_codes_deactivated",
      "stripe_codes_reactivated",
    ]),
  );
});

test("a failed Stripe update is recorded and can be retried", async () => {
  const { t, admin, event } = await setup();
  stripe.update.mockImplementation(async (id: string) => {
    if (id === "promo_B") throw new Error("No such promotion code");
    return { id };
  });
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await drain(t);
  expect(await sync(t, event.id)).toMatchObject({
    status: "failed",
    updated: 1,
    failed: 1,
    error: "No such promotion code",
  });

  stripe.update.mockImplementation(async (id: string) => ({ id }));
  expect(
    await admin.mutation(api.codes.retryStripeSync, {
      eventId: event.id,
      codeType: "Day one",
    }),
  ).toEqual({ stripeCodes: 2 });
  await drain(t);
  expect(await sync(t, event.id)).toMatchObject({
    status: "done",
    active: false,
    updated: 2,
    failed: 0,
  });
  expect(await sync(t, event.id)).not.toHaveProperty("error");
});

test("a newer unarchive supersedes an archive still in flight", async () => {
  const { t, admin, event } = await setup();
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: false,
  });
  await drain(t);
  expect(stripe.update.mock.calls).toEqual([
    ["promo_A", { active: true }],
    ["promo_B", { active: true }],
  ]);
  expect(await sync(t, event.id)).toMatchObject({ status: "done", active: true });
});

test("without a Stripe key the sync is marked failed instead of scheduled", async () => {
  vi.stubEnv("STRIPE_API_KEY", "");
  const { t, admin, event } = await setup();
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await drain(t);
  expect(stripe.update).not.toHaveBeenCalled();
  expect(await sync(t, event.id)).toMatchObject({
    status: "failed",
    error: "Stripe is not configured on this deployment.",
  });
});

test("blocks with only pasted codes touch nothing in Stripe", async () => {
  const { t, admin, event } = await setup([]);
  const res = await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  expect(res).toMatchObject({ stripeCodes: 0 });
  await drain(t);
  expect(stripe.update).not.toHaveBeenCalled();
  expect(await sync(t, event.id)).toBeUndefined();
});

test("a code deleted between pages does not make the worker skip the next one", async () => {
  const codes = Array.from({ length: 30 }, (_, i) => `C${String(i).padStart(2, "0")}`);
  const { t, admin, event } = await setup(codes);
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
  expect(stripe.update).toHaveBeenCalledTimes(25);
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("codes")
      .withIndex("by_event", (q) => q.eq("eventId", event.id))
      .collect();
    await ctx.db.delete(rows.find((row) => row.code === "C00")!._id);
  });
  await drain(t);
  expect(stripe.update.mock.calls.map(([id]) => id)).toEqual(
    codes.map((code) => `promo_${code}`),
  );
  expect(await sync(t, event.id)).toMatchObject({ status: "done", updated: 30 });
});

test("an unarchive during a running archive worker wins, and its reactivations are not undone", async () => {
  const codes = Array.from({ length: 30 }, (_, i) => `C${String(i).padStart(2, "0")}`);
  const { t, admin, event } = await setup(codes);
  let flipped = false;
  stripe.update.mockImplementation(async (id: string, params: { active: boolean }) => {
    if (id === "promo_C01" && !flipped) {
      flipped = true;
      await admin.mutation(api.codes.setTypeArchived, {
        eventId: event.id,
        codeType: "Day one",
        archived: false,
      });
    }
    return { id, active: params.active };
  });
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await drain(t);
  const last = new Map<string, boolean>();
  for (const [id, params] of stripe.update.mock.calls as [string, { active: boolean }][])
    last.set(id, params.active);
  expect(last.size).toBe(30);
  expect([...last.values()].every((active) => active)).toBe(true);
  expect(await sync(t, event.id)).toMatchObject({
    status: "done",
    active: true,
    updated: 30,
    failed: 0,
  });
});

test("codes from a batch made in the other Stripe mode are left alone and reported", async () => {
  const { t, admin, event, batchId } = await setup();
  await t.run((ctx) => ctx.db.patch(batchId, { live: true }));
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await drain(t);
  expect(stripe.update).not.toHaveBeenCalled();
  expect(await sync(t, event.id)).toMatchObject({
    status: "failed",
    failed: 2,
    error: expect.stringContaining("created in Stripe live mode"),
  });
});

test("event admins see the sync status but not the Stripe error text", async () => {
  const { t, admin, event } = await setup();
  stripe.update.mockRejectedValue(new Error("Secret Stripe detail"));
  await admin.mutation(api.codes.setTypeArchived, {
    eventId: event.id,
    codeType: "Day one",
    archived: true,
  });
  await drain(t);
  await t.run((ctx) =>
    ctx.db.insert("eventAdmins", { eventId: event.id, email: "organizer@example.com" }),
  );
  const organizer = t.withIdentity({
    subject: "organizer",
    email: "organizer@example.com",
    emailVerified: true,
  });
  const forOrganizer = (await organizer.query(api.events.get, { id: event.id }))!;
  expect(forOrganizer.stripeArchiveSync?.["Day one"]).toMatchObject({
    status: "failed",
    failed: 2,
  });
  expect(forOrganizer.stripeArchiveSync?.["Day one"]).not.toHaveProperty("error");
  const forAdmin = (await admin.query(api.events.get, { id: event.id }))!;
  expect(forAdmin.stripeArchiveSync?.["Day one"]).toMatchObject({
    error: "Secret Stripe detail",
  });
});

test("event admins cannot retry a Stripe sync", async () => {
  const { t, event } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("eventAdmins", { eventId: event.id, email: "organizer@example.com" }),
  );
  const organizer = t.withIdentity({
    subject: "organizer",
    email: "organizer@example.com",
    emailVerified: true,
  });
  await expect(
    organizer.mutation(api.codes.retryStripeSync, {
      eventId: event.id,
      codeType: "Day one",
    }),
  ).rejects.toThrow();
});
