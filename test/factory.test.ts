import { PGlite } from "@electric-sql/pglite";
import { mysqlTable, serial as mysqlSerial, varchar as mysqlVarchar } from "drizzle-orm/mysql-core";
import {
  check,
  customType,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  point,
  primaryKey,
  serial,
  text,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { seed } from "drizzle-seed";
import { eq, relations, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFactories, defineFactory } from "../src";

const userRole = pgEnum("user_role", ["member", "admin"]);
const vector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "vector";
  },
});
const pointValue = customType<{ data: { x: number; y: number }; driverData: string }>({
  dataType() {
    return "point";
  },
  toDriver(value) {
    return `(${value.x},${value.y})`;
  },
});

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  nickname: varchar("nickname", { length: 24 }).notNull(),
  role: userRole("role").notNull(),
});

const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 48 }).notNull(),
});

const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 24 }).notNull(),
});

const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    bio: text("bio").notNull(),
  },
  (table) => [unique("profiles_user_id_unique").on(table.userId)],
);

const reviewComments = pgTable("review_comments", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
});

const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id"),
  name: text("name").notNull(),
});

const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
});

const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
});

const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  role: text("role").notNull(),
});

const orderVersions = pgTable(
  "order_versions",
  {
    orderId: integer("order_id").notNull(),
    version: integer("version").notNull(),
    note: text("note").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.orderId, table.version],
    }),
  ],
);

const orderVersionLines = pgTable(
  "order_version_lines",
  {
    orderId: integer("order_id").notNull(),
    version: integer("version").notNull(),
    sku: varchar("sku", { length: 24 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orderId, table.version],
      foreignColumns: [orderVersions.orderId, orderVersions.version],
    }),
  ],
);

const constrainedArticles = pgTable(
  "constrained_articles",
  {
    id: serial("id").primaryKey(),
    rating: integer("rating").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    check("constrained_articles_rating_check", sql`${table.rating} between 3 and 5`),
    check("constrained_articles_status_check", sql`${table.status} in ('draft', 'published')`),
  ],
);

const scoredSessions = pgTable(
  "scored_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    check("scored_sessions_rating_check", sql`${table.rating} between 3 and 5`),
    check("scored_sessions_status_check", sql`${table.status} in ('draft', 'published')`),
  ],
);

const managedUsers = pgTable("managed_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  email: text("email").notNull(),
});

const managedSessions = pgTable("managed_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => managedUsers.id),
  token: varchar("token", { length: 24 }).notNull(),
});

const tenantArticleLinks = pgTable("tenant_article_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  articleId: integer("article_id")
    .notNull()
    .references(() => constrainedArticles.id),
  note: text("note").notNull(),
});

const pairedScores = pgTable(
  "paired_scores",
  {
    id: serial("id").primaryKey(),
    minScore: integer("min_score").notNull(),
    maxScore: integer("max_score").notNull(),
  },
  (table) => [check("paired_scores_ordered_check", sql`${table.minScore} < ${table.maxScore}`)],
);

const vectorNotes = pgTable("vector_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  embedding: vector("embedding").notNull(),
});

const spatialNotes = pgTable("spatial_notes", {
  id: serial("id").primaryKey(),
  externalId: uuid("external_id").notNull(),
  tuplePoint: point("tuple_point").notNull(),
  objectPoint: point("object_point", { mode: "xy" }).notNull(),
});

const customPointNotes = pgTable("custom_point_notes", {
  id: serial("id").primaryKey(),
  location: pointValue("location").notNull(),
});

const seededCustomers = pgTable("seeded_customers", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull().unique(),
});

const mysqlSeededCustomers = mysqlTable("mysql_seeded_customers", {
  id: mysqlSerial("id").primaryKey(),
  contactEmail: mysqlVarchar("contact_email", { length: 255 }).notNull().unique(),
  contactName: mysqlVarchar("contact_name", { length: 255 }).notNull(),
});

const scopedArticles = pgTable(
  "scoped_articles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    slug: varchar("slug", { length: 48 }).notNull(),
  },
  (table) => [unique("scoped_articles_tenant_slug_unique").on(table.tenantId, table.slug)],
);

const partialEmailSubscribers = pgTable(
  "partial_email_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
  },
  (table) => [
    uniqueIndex("partial_email_subscribers_email_present_unique")
      .on(table.email)
      .where(sql`${table.email} <> ''`),
  ],
);

const caseInsensitiveSlugs = pgTable(
  "case_insensitive_slugs",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
  },
  (table) => [
    uniqueIndex("case_insensitive_slugs_lower_slug_unique").on(sql`lower(${table.slug})`),
  ],
);

const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  sessions: many(sessions),
}));

const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

const reviewCommentsRelations = relations(reviewComments, ({ one }) => ({
  author: one(users, {
    fields: [reviewComments.authorId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [reviewComments.reviewerId],
    references: [users.id],
  }),
}));

const employeesRelations = relations(employees, ({ one, many }) => ({
  manager: one(employees, {
    relationName: "management",
    fields: [employees.managerId],
    references: [employees.id],
  }),
  reports: many(employees, {
    relationName: "management",
  }),
}));

const membershipsRelations = relations(memberships, ({ one }) => ({
  member: one(members, {
    fields: [memberships.memberId],
    references: [members.id],
  }),
  group: one(groups, {
    fields: [memberships.groupId],
    references: [groups.id],
  }),
}));

const orderVersionLinesRelations = relations(orderVersionLines, ({ one }) => ({
  orderVersion: one(orderVersions, {
    fields: [orderVersionLines.orderId, orderVersionLines.version],
    references: [orderVersions.orderId, orderVersions.version],
  }),
}));

const schema = {
  constrainedArticles,
  employees,
  employeesRelations,
  groups,
  memberships,
  membershipsRelations,
  members,
  managedSessions,
  managedUsers,
  orderVersionLines,
  orderVersionLinesRelations,
  orderVersions,
  pairedScores,
  posts,
  postsRelations,
  profiles,
  reviewComments,
  reviewCommentsRelations,
  roles,
  scoredSessions,
  seededCustomers,
  sessions,
  sessionsRelations,
  tenantArticleLinks,
  tenants,
  userRole,
  users,
  usersRelations,
};

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("kiri-factory stable runtime", () => {
  it("builds and creates many rows with columns and overrides", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema,
      definitions: {
        users: defineFactory(users, {
          columns: {
            role: "member",
          },
        }),
      },
    });

    const built = await factories.users.buildMany(2, (index) => ({
      email: `built-${index + 1}@example.com`,
      role: "admin",
    }));
    const created = await factories.users.createMany(2, (index) => ({
      email: `created-${index + 1}@example.com`,
      nickname: `created-${index + 1}`,
    }));

    expect(built).toHaveLength(2);
    expect(built[0]?.role).toBe("admin");
    expect(created).toHaveLength(2);
    expect(created[0]?.id).toBeTypeOf("number");
    expect(created[1]?.email).toBe("created-2@example.com");
  });

  it("auto-creates one missing single-column parent during create()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { sessions, users },
    });

    const session = await factories.sessions.create({
      token: "single-parent",
    });
    const persistedUsers = await db.select().from(users);

    expect(persistedUsers).toHaveLength(1);
    expect(session.userId).toBe(persistedUsers[0]?.id);
  });

  it("shares one auto-created parent across createMany()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { sessions, users },
    });

    const sessionsCreated = await factories.sessions.createMany(3, (index) => ({
      token: `token-${index + 1}`,
    }));
    const persistedUsers = await db.select().from(users);

    expect(sessionsCreated).toHaveLength(3);
    expect(persistedUsers).toHaveLength(1);
    expect(new Set(sessionsCreated.map((session) => session.userId))).toEqual(
      new Set([persistedUsers[0]?.id]),
    );
  });

  it("creates fresh auto-generated parents across separate create() calls", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { sessions, users },
    });

    const first = await factories.sessions.create({
      token: "first-parent",
    });
    const second = await factories.sessions.create({
      token: "second-parent",
    });
    const persistedUsers = await db.select().from(users);

    expect(persistedUsers).toHaveLength(2);
    expect(first.userId).not.toBe(second.userId);
  });

  it("does not persist an auto-created parent when child validation fails first", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { scoredSessions, users },
    });

    await expect(factories.scoredSessions.create()).rejects.toThrow(
      /does not satisfy a simple CHECK constraint/i,
    );
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("auto-creates same-target required parents through separate local keys", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { reviewComments, users },
    });

    const comment = await factories.reviewComments.create({
      body: "Two implicit parents",
    });
    const persistedUsers = await db.select().from(users);

    expect(persistedUsers).toHaveLength(2);
    expect(comment.authorId).not.toBe(comment.reviewerId);
  });

  it("verifyCreates() catches createMany-only failures under shared auto-parents", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { profiles, users },
    });

    const issues = await factories.verifyCreates();

    expect(issues).toHaveLength(1);
    expect(issues[0]?.key).toBe("profiles");
  });

  it("creates belongs-to parents through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
      role: "admin",
    });

    const post = await factories.posts.for("author", author).create({
      title: "Planned post",
    });

    const [persistedAuthor] = await db.select().from(users).where(eq(users.id, post.authorId));
    expect(persistedAuthor?.email).toBe("author@example.com");
    expect(post.title).toBe("Planned post");
  });

  it("reuses existing parents through for(..., row)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "existing@example.com",
      nickname: "existing",
      role: "member",
    });

    const post = await factories.posts.for("author", author).create({
      title: "Existing author",
    });
    const persistedUsers = await db.select().from(users);

    expect(post.authorId).toBe(author.id);
    expect(persistedUsers).toHaveLength(1);
  });

  it("supports same-target relation keys", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
      role: "member",
    });
    const reviewer = await factories.users.create({
      email: "reviewer@example.com",
      nickname: "reviewer",
      role: "admin",
    });

    const comment = await factories.reviewComments
      .for("author", author)
      .for("reviewer", reviewer)
      .create({
        body: "Looks good",
      });

    expect(comment.authorId).not.toBe(comment.reviewerId);
  });

  it("auto-creates the final missing single-column parent after for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
      role: "member",
    });

    const comment = await factories.reviewComments.for("author", author).create({
      body: "Needs one more parent",
    });
    const persistedUsers = await db.select().from(users);

    expect(comment.authorId).toBe(author.id);
    expect(comment.reviewerId).not.toBe(author.id);
    expect(persistedUsers).toHaveLength(2);
  });

  it("shares auto-created same-target parents across createMany()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { reviewComments, users },
    });

    const comments = await factories.reviewComments.createMany(2, (index) => ({
      body: `Shared implicit parents ${index + 1}`,
    }));
    const persistedUsers = await db.select().from(users);

    expect(comments).toHaveLength(2);
    expect(persistedUsers).toHaveLength(2);
    expect(new Set(comments.map((comment) => comment.authorId))).toHaveLength(1);
    expect(new Set(comments.map((comment) => comment.reviewerId))).toHaveLength(1);
    expect(comments[0]?.authorId).not.toBe(comments[0]?.reviewerId);
  });

  it("auto-creates multi-hop parent chains across several tables", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { managedSessions, managedUsers, roles, tenants },
    });

    const sessions = await factories.managedSessions.createMany(2, (index) => ({
      token: `managed-${index + 1}`,
    }));
    const persistedManagedUsers = await db.select().from(managedUsers);
    const persistedTenants = await db.select().from(tenants);
    const persistedRoles = await db.select().from(roles);

    expect(sessions).toHaveLength(2);
    expect(persistedManagedUsers).toHaveLength(1);
    expect(persistedTenants).toHaveLength(1);
    expect(persistedRoles).toHaveLength(1);
    expect(new Set(sessions.map((session) => session.userId))).toEqual(
      new Set([persistedManagedUsers[0]?.id]),
    );
  });

  it("does not persist earlier sibling parents when a later parent fails validation", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { constrainedArticles, tenantArticleLinks, tenants },
    });

    await expect(
      factories.tenantArticleLinks.create({
        note: "should fail before inserts",
      }),
    ).rejects.toThrow(/does not satisfy a simple CHECK constraint/i);
    expect(await db.select().from(tenants)).toHaveLength(0);
    expect(await db.select().from(constrainedArticles)).toHaveLength(0);
  });

  it("supports self relations through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const manager = await factories.employees.create({
      name: "Boss",
    });

    const employee = await factories.employees.for("manager", manager).create({
      name: "Worker",
    });

    const [persistedManager] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employee.managerId!));
    expect(persistedManager?.name).toBe("Boss");
  });

  it("models many-to-many explicitly through the junction table", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const member = await factories.members.create({ name: "Ada" });
    const group = await factories.groups.create({ label: "Core" });

    const membership = await factories.memberships
      .for("member", member)
      .for("group", group)
      .create({
        role: "owner",
      });

    const [persistedMember] = await db
      .select()
      .from(members)
      .where(eq(members.id, membership.memberId));
    const [persistedGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, membership.groupId));

    expect(persistedMember?.name).toBe("Ada");
    expect(persistedGroup?.label).toBe("Core");
    expect(membership.role).toBe("owner");
  });

  it("copies composite foreign keys through for(...)", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {} as object,
      schema,
      adapter: echoAdapterWithGeneratedIds(log),
    });
    const version = await factories.orderVersions.create({
      note: "v1",
    });

    const line = await factories.orderVersionLines.for("orderVersion", version).create({
      sku: "sku-1",
    });

    expect(line.orderId).toBeTypeOf("number");
    expect(line.version).toBeTypeOf("number");
    expect(log.some((entry) => entry.table === "order_versions")).toBe(true);
  });

  it("supports customType inference resolvers", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { vectorNotes },
      adapter: echoAdapterWithGeneratedIds([]),
      inference: {
        customTypes: {
          vector: () => "[0,0,0]",
        },
      },
    });

    const note = await factories.vectorNotes.build({
      title: "Embedding note",
    });

    expect(note.embedding).toBe("[0,0,0]");
  });

  it("uses official drizzle-seed-aligned generators for uuid and point columns", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { spatialNotes },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    const note = await factories.spatialNotes.build();

    expect(note.externalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(note.tuplePoint).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    );
    expect(note.objectPoint).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("supports point-like custom types through customTypes resolvers", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { customPointNotes },
      adapter: echoAdapterWithGeneratedIds([]),
      inference: {
        customTypes: {
          point: ({ sequence }) => ({ x: sequence, y: sequence + 1 }),
        },
      },
    });

    const note = await factories.customPointNotes.build();

    expect(note.location).toEqual({ x: 1, y: 2 });
  });

  it("fails fast when official generators violate simple single-column CHECK constraints", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { constrainedArticles },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    await expect(factories.constrainedArticles.build()).rejects.toThrow(
      /does not satisfy a simple CHECK constraint/i,
    );

    const article = await factories.constrainedArticles.build({
      rating: 4,
      status: "draft",
    });

    expect(article.rating).toBe(4);
    expect(article.status).toBe("draft");
  });

  it("lets complex CHECK constraints fail at insert time", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { pairedScores },
    });

    await expect(factories.pairedScores.create()).rejects.toThrow();
  });

  it("evaluates shared drizzle-seed columns(f) during runtime createMany()", async () => {
    const { db } = await createTestDb();
    const customerFactory = defineFactory(seededCustomers, {
      columns: (f) => ({
        companyName: f.companyName(),
        contactName: f.fullName(),
        contactEmail: f.email(),
      }),
    });
    const factories = createFactories({
      db,
      schema: { seededCustomers },
      definitions: {
        seededCustomers: customerFactory,
      },
    });

    const customers = await factories.seededCustomers.createMany(3);

    expect(customers).toHaveLength(3);
    expect(customers[0]?.companyName).toBeTypeOf("string");
    expect(customers[0]?.contactName).toBeTypeOf("string");
    expect(customers[0]?.contactEmail).toContain("@");
    expect(new Set(customers.map((customer) => customer.contactEmail)).size).toBe(3);
  });

  it("keeps auto-selected single-column unique generators unique", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { seededCustomers },
    });

    const customers = await factories.seededCustomers.createMany(3);

    expect(customers).toHaveLength(3);
    expect(new Set(customers.map((customer) => customer.contactEmail)).size).toBe(3);
  });

  it("uses the official mysql selector for no-definition auto columns", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { mysqlSeededCustomers },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    const customers = await factories.mysqlSeededCustomers.buildMany(3);

    expect(customers).toHaveLength(3);
    expect(customers[0]?.contactName).toBeTypeOf("string");
    expect(customers[0]?.contactEmail).toContain("@");
    expect(new Set(customers.map((customer) => customer.contactEmail)).size).toBe(3);
  });

  it("reuses columns(f) directly in drizzle-seed refine(...)", async () => {
    const { db } = await createTestDb();
    const customerFactory = defineFactory(seededCustomers, {
      columns: (f) => ({
        companyName: f.companyName(),
        contactName: f.fullName(),
        contactEmail: f.email(),
      }),
    });

    await seed(db, { seededCustomers }).refine((f) => ({
      seededCustomers: {
        count: 3,
        columns: customerFactory.columns(f),
      },
    }));

    const customers = await db.select().from(seededCustomers);

    expect(customers).toHaveLength(3);
    expect(new Set(customers.map((customer) => customer.contactEmail)).size).toBe(3);
  });

  it("converts literal columns into seed-compatible generators", async () => {
    const { db } = await createTestDb();
    const customerFactory = defineFactory(seededCustomers, {
      columns: (f) => ({
        companyName: "Acme",
        contactName: f.fullName(),
        contactEmail: f.email(),
      }),
    });

    await seed(db, { seededCustomers }).refine((f) => ({
      seededCustomers: {
        count: 3,
        columns: customerFactory.columns(f),
      },
    }));

    const customers = await db.select().from(seededCustomers);

    expect(customers).toHaveLength(3);
    expect(customers.every((customer) => customer.companyName === "Acme")).toBe(true);
  });

  it("fails fast when columns(f) uses a non-unique generator for a unique column", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { seededCustomers },
      adapter: echoAdapterWithGeneratedIds([]),
      definitions: {
        seededCustomers: defineFactory(seededCustomers, {
          columns: (f) => ({
            companyName: f.companyName(),
            contactName: f.fullName(),
            contactEmail: f.default({
              defaultValue: "same@example.com",
            }),
          }),
        }),
      },
    });

    await expect(factories.seededCustomers.build()).rejects.toThrow(/unique/i);
  });

  it("requires explicit values for compound unique constraints", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { scopedArticles },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    await expect(
      factories.scopedArticles.build({
        tenantId: 1,
      }),
    ).rejects.toThrow(/compound unique constraint/i);

    const article = await factories.scopedArticles.build({
      slug: "tenant-1-home",
      tenantId: 1,
    });

    expect(article.slug).toBe("tenant-1-home");
  });

  it("requires explicit values for partial unique indexes", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { partialEmailSubscribers },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    await expect(factories.partialEmailSubscribers.build()).rejects.toThrow(
      /partial unique index/i,
    );

    const subscriber = await factories.partialEmailSubscribers.build({
      email: "explicit@example.com",
    });

    expect(subscriber.email).toBe("explicit@example.com");
  });

  it("requires explicit values for expression-based unique indexes", async () => {
    const factories = createFactories({
      db: {} as object,
      schema: { caseInsensitiveSlugs },
      adapter: echoAdapterWithGeneratedIds([]),
    });

    await expect(factories.caseInsensitiveSlugs.build()).rejects.toThrow(
      /expression-based unique index/i,
    );

    const row = await factories.caseInsensitiveSlugs.build({
      slug: "Home",
    });

    expect(row.slug).toBe("Home");
  });

  it("verifyCreates() catches duplicate explicit unique values", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { seededCustomers },
      definitions: {
        seededCustomers: defineFactory(seededCustomers, {
          columns: {
            companyName: "Acme",
            contactEmail: "duplicate@example.com",
            contactName: "Ada",
          },
        }),
      },
    });

    const issues = await factories.verifyCreates();

    expect(issues).toHaveLength(1);
    expect(issues[0]?.key).toBe("seededCustomers");
  });
});

async function createTestDb() {
  const client = new PGlite();
  clients.push(client);

  await client.exec(`
    create type user_role as enum ('member', 'admin');

    create table users (
      id serial primary key,
      email text not null,
      nickname varchar(24) not null,
      role user_role not null
    );

    create table posts (
      id serial primary key,
      author_id integer not null references users(id),
      title varchar(48) not null
    );

    create table sessions (
      id serial primary key,
      user_id integer not null references users(id),
      token varchar(24) not null
    );

    create table profiles (
      id serial primary key,
      user_id integer not null references users(id),
      bio text not null,
      constraint profiles_user_id_unique unique (user_id)
    );

    create table review_comments (
      id serial primary key,
      author_id integer not null references users(id),
      reviewer_id integer not null references users(id),
      body text not null
    );

    create table employees (
      id serial primary key,
      manager_id integer references employees(id),
      name text not null
    );

    create table members (
      id serial primary key,
      name text not null
    );

    create table groups (
      id serial primary key,
      label text not null
    );

    create table tenants (
      id serial primary key,
      name text not null
    );

    create table roles (
      id serial primary key,
      code text not null
    );

    create table memberships (
      id serial primary key,
      member_id integer not null references members(id),
      group_id integer not null references groups(id),
      role text not null
    );

    create table order_versions (
      order_id integer not null,
      version integer not null,
      note text not null,
      primary key (order_id, version)
    );

    create table order_version_lines (
      order_id integer not null,
      version integer not null,
      sku varchar(24) not null,
      constraint order_version_lines_version_fk
        foreign key (order_id, version) references order_versions(order_id, version)
    );

    create table constrained_articles (
      id serial primary key,
      rating integer not null,
      status text not null,
      constraint constrained_articles_rating_check check (rating >= 3 and rating <= 5),
      constraint constrained_articles_status_check check (status in ('draft', 'published'))
    );

    create table scored_sessions (
      id serial primary key,
      user_id integer not null references users(id),
      rating integer not null,
      status text not null,
      constraint scored_sessions_rating_check check (rating >= 3 and rating <= 5),
      constraint scored_sessions_status_check check (status in ('draft', 'published'))
    );

    create table managed_users (
      id serial primary key,
      tenant_id integer not null references tenants(id),
      role_id integer not null references roles(id),
      email text not null
    );

    create table managed_sessions (
      id serial primary key,
      user_id integer not null references managed_users(id),
      token varchar(24) not null
    );

    create table tenant_article_links (
      id serial primary key,
      tenant_id integer not null references tenants(id),
      article_id integer not null references constrained_articles(id),
      note text not null
    );

    create table paired_scores (
      id serial primary key,
      min_score integer not null,
      max_score integer not null,
      constraint paired_scores_order_check check (min_score < max_score)
    );

    create table seeded_customers (
      id serial primary key,
      company_name text not null,
      contact_name text not null,
      contact_email text not null unique
    );

    create table scoped_articles (
      id serial primary key,
      tenant_id integer not null,
      slug varchar(48) not null,
      constraint scoped_articles_tenant_slug_unique unique (tenant_id, slug)
    );

    create table partial_email_subscribers (
      id serial primary key,
      email text not null
    );

    create unique index partial_email_subscribers_email_present_unique
      on partial_email_subscribers (email)
      where email <> '';

    create table case_insensitive_slugs (
      id serial primary key,
      slug text not null
    );

    create unique index case_insensitive_slugs_lower_slug_unique
      on case_insensitive_slugs ((lower(slug)));
  `);

  return { client, db: drizzle(client) };
}

function echoAdapterWithGeneratedIds(
  log: Array<{ table: string; values: Record<string, unknown> }>,
) {
  const nextIdByTable = new Map<string, number>();

  return {
    async create<TTable extends import("drizzle-orm").Table>({
      table,
      values,
    }: {
      table: TTable;
      values: Record<string, unknown>;
    }) {
      const row = { ...values } as Record<string, unknown>;
      const tableColumns = (await import("drizzle-orm")).getTableColumns(table) as Record<
        string,
        unknown
      >;

      if ("id" in tableColumns && row.id === undefined) {
        const tableKey = tableName(table);
        const nextId = (nextIdByTable.get(tableKey) ?? 0) + 1;
        nextIdByTable.set(tableKey, nextId);
        row.id = nextId;
      }

      log.push({
        table: tableName(table),
        values: row,
      });

      return row as import("drizzle-orm").InferSelectModel<TTable>;
    },
  };
}

function tableName(table: import("drizzle-orm").Table) {
  const symbol = Object.getOwnPropertySymbols(table).find((value) =>
    String(value).includes("Name"),
  );

  return symbol ? String((table as unknown as Record<symbol, unknown>)[symbol]) : "unknown";
}
