import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "admin",
  email: "admin@example.com",
  emailVerified: true,
};

async function setup() {
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("admins", { email: identity.email }));
  return { t, admin: t.withIdentity(identity) };
}

test("the contact email is optional, normalized and shown on the public event", async () => {
  const { t, admin } = await setup();
  const plain = await admin.mutation(api.events.create, { name: "Plain", slug: "plain" });
  expect((await t.query(api.events.getBySlug, { slug: "plain" }))?.contactEmail).toBeUndefined();
  expect((await admin.query(api.events.get, { id: plain.id }))).not.toHaveProperty("contactEmail", expect.anything());

  await admin.mutation(api.events.create, {
    name: "Meetup",
    slug: "meetup",
    contactEmail: "  Organizers@Example.com ",
  });
  expect((await t.query(api.events.getBySlug, { slug: "meetup" }))?.contactEmail).toBe(
    "organizers@example.com",
  );
});

test("the contact email can be changed, cleared, or left alone by older forms", async () => {
  const { t, admin } = await setup();
  const event = await admin.mutation(api.events.create, {
    name: "Meetup",
    slug: "meetup",
    contactEmail: "first@example.com",
  });
  const base = { id: event.id, name: "Meetup", slug: "meetup" };

  await admin.mutation(api.events.update, { ...base, description: "No contact field sent" });
  expect((await t.query(api.events.getBySlug, { slug: "meetup" }))?.contactEmail).toBe("first@example.com");

  await admin.mutation(api.events.update, { ...base, contactEmail: "Second@Example.com" });
  expect((await admin.query(api.events.get, { id: event.id }))?.contactEmail).toBe("second@example.com");

  await admin.mutation(api.events.update, { ...base, contactEmail: "  " });
  expect((await admin.query(api.events.get, { id: event.id }))?.contactEmail).toBeUndefined();
});

test("addresses that don't look like an email are rejected", async () => {
  const { admin } = await setup();
  await expect(
    admin.mutation(api.events.create, { name: "Bad", slug: "bad", contactEmail: "organizers" }),
  ).rejects.toThrow(/valid contact email/);
  const event = await admin.mutation(api.events.create, { name: "Ok", slug: "ok" });
  await expect(
    admin.mutation(api.events.update, {
      id: event.id,
      name: "Ok",
      slug: "ok",
      contactEmail: "two words@example.com",
    }),
  ).rejects.toThrow(/valid contact email/);
});
