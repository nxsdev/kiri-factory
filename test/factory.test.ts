import { PGlite } from "@electric-sql/pglite";
import { eq, relations, type InferSelectModel, type Table } from "drizzle-orm";
import { mysqlTable, varchar as mysqlVarchar } from "drizzle-orm/mysql-core";
import { pgEnum, pgTable, serial, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFactories, defineFactory, existing } from "../src";

const userRole = pgEnum("user_role", ["member", "admin"]);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  nickname: varchar("nickname", { length: 12 }).notNull(),
  role: userRole("role").notNull(),
});

const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 24 }).notNull(),
});
const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  body: varchar("body", { length: 32 }).notNull(),
});

const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 16 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  sessions: many(sessions),
}));
const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
}));
const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
}));
const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

const mysqlUsers = mysqlTable("mysql_users", {
  id: mysqlVarchar("id", { length: 32 }).primaryKey(),
  displayName: mysqlVarchar("display_name", { length: 32 }).notNull(),
});
const mysqlPosts = mysqlTable("mysql_posts", {
  id: mysqlVarchar("id", { length: 32 }).primaryKey(),
  authorId: mysqlVarchar("author_id", { length: 32 })
    .notNull()
    .references(() => mysqlUsers.id),
  title: mysqlVarchar("title", { length: 32 }).notNull(),
});
const mysqlUsersRelations = relations(mysqlUsers, ({ many }) => ({
  posts: many(mysqlPosts),
}));
const mysqlPostsRelations = relations(mysqlPosts, ({ one }) => ({
  author: one(mysqlUsers, {
    fields: [mysqlPosts.authorId],
    references: [mysqlUsers.id],
  }),
}));

const sqliteUsers = sqliteTable("sqlite_users", {
  id: sqliteText("id").primaryKey(),
  displayName: sqliteText("display_name").notNull(),
});
const sqliteProfiles = sqliteTable("sqlite_profiles", {
  id: sqliteText("id").primaryKey(),
  userId: sqliteText("user_id")
    .notNull()
    .references(() => sqliteUsers.id),
  bio: sqliteText("bio").notNull(),
});
const sqliteUsersRelations = relations(sqliteUsers, ({ one }) => ({
  profile: one(sqliteProfiles, {
    fields: [sqliteUsers.id],
    references: [sqliteProfiles.userId],
  }),
}));
const sqliteProfilesRelations = relations(sqliteProfiles, ({ one }) => ({
  user: one(sqliteUsers, {
    fields: [sqliteProfiles.userId],
    references: [sqliteUsers.id],
  }),
}));

const looseUsers = pgTable("loose_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
const loosePosts = pgTable("loose_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
});
const looseUsersRelations = relations(looseUsers, ({ many }) => ({
  posts: many(loosePosts),
}));
const loosePostsRelations = relations(loosePosts, ({ one }) => ({
  author: one(looseUsers, {
    fields: [loosePosts.authorId],
    references: [looseUsers.id],
  }),
}));

const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id"),
  name: text("name").notNull(),
});
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

const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
});
const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
});
const membersRelations = relations(members, ({ many }) => ({
  memberships: many(memberships),
}));
const groupsRelations = relations(groups, ({ many }) => ({
  memberships: many(memberships),
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

const relationUsers = pgTable("relation_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
const relationComments = pgTable("relation_comments", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => relationUsers.id),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => relationUsers.id),
  body: text("body").notNull(),
});
const relationUsersRelations = relations(relationUsers, ({ many }) => ({
  authoredComments: many(relationComments, {
    relationName: "comment_author",
  }),
  reviewedComments: many(relationComments, {
    relationName: "comment_reviewer",
  }),
}));
const relationCommentsRelations = relations(relationComments, ({ one }) => ({
  author: one(relationUsers, {
    relationName: "comment_author",
    fields: [relationComments.authorId],
    references: [relationUsers.id],
  }),
  reviewer: one(relationUsers, {
    relationName: "comment_reviewer",
    fields: [relationComments.reviewerId],
    references: [relationUsers.id],
  }),
}));

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("kiri-factory", () => {
  it("builds from a pure definition and respects enum values and varchar length", async () => {
    const userFactory = defineFactory(users);

    const row = await userFactory.build({
      email: "ada@example.com",
    });

    expect(row.email).toBe("ada@example.com");
    expect(row.role).toBe("member");
    expect(typeof row.nickname).toBe("string");
    expect(row.nickname.length).toBeLessThanOrEqual(12);
  });

  it("supports defaults, transient inputs, traits, and afterBuild hooks in definitions", async () => {
    const seen: string[] = [];
    const userFactory = defineFactory(users, {
      transient: {
        domain: "example.com",
        prefix: "member",
      },
      defaults: {
        role: "member",
      },
      state: ({ seq, transient }) => ({
        email: `${transient.prefix}-${seq}@${transient.domain}`,
        nickname: `${transient.prefix}-${seq}`,
      }),
      traits: {
        admin: {
          state: {
            role: "admin",
          },
        },
      },
      afterBuild: (values) => {
        seen.push(String(values.email));
      },
    });

    const row = await userFactory.withTraits("admin").build(
      {},
      {
        transient: {
          domain: "kiri.dev",
          prefix: "root",
        },
      },
    );

    expect(row).toEqual({
      email: "root-1@kiri.dev",
      nickname: "root-1",
      role: "admin",
    });
    expect(seen).toEqual(["root-1@kiri.dev"]);
  });

  it("creates rows through the connected runtime without extra setup calls", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      tables: { users },
    });

    const row = await factories.users.create({
      email: "ada@example.com",
      nickname: "ada",
    });

    expect(row).toMatchObject({
      id: 1,
      email: "ada@example.com",
      nickname: "ada",
      role: "member",
    });
  });

  it("accepts explicit definitions and uses them during relation auto-create", async () => {
    const { db } = await createTestDb();
    const userFactory = defineFactory(users, {
      defaults: {
        role: "admin",
      },
      state: ({ seq }) => ({
        email: `staff-${seq}@example.com`,
        nickname: `staff-${seq}`,
      }),
    });

    const factories = createFactories({
      db,
      tables: { users, posts },
      definitions: {
        users: userFactory,
      },
    });

    const post = await factories.posts.create();
    const [user] = await db.select().from(users).where(eq(users.id, post.userId));

    expect(post.title.length).toBeLessThanOrEqual(24);
    expect(user).toMatchObject({
      id: post.userId,
      email: "staff-1@example.com",
      nickname: "staff-1",
      role: "admin",
    });
  });

  it("lets callers look up runtime factories by table object", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      tables: { users, sessions },
    });

    const sessionFactory = factories.get(sessions);
    const row = await sessionFactory.create({
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(row.userId).toBe(1);
    expect(row.token.length).toBeLessThanOrEqual(16);
  });

  it("supports schema as a convenience alias and ignores non-table exports", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, userRole, usersRelations, postsRelations },
    });

    const post = await factories.posts.for("author").create();
    // @ts-expect-error "posts" is not a belongs-to relation on posts.
    void factories.posts.for("posts");

    expect(post.userId).toBe(1);
  });

  it("isolates sequence state across connected runtimes built from one definition", async () => {
    const { db } = await createTestDb();
    const userFactory = defineFactory(users, {
      transient: {
        domain: "example.com",
      },
      state: ({ seq, transient }) => ({
        email: `user-${seq}@${transient.domain}`,
        nickname: `user-${seq}`,
      }),
    });
    const alpha = createFactories({
      db,
      tables: { users },
      definitions: {
        users: userFactory,
      },
    });
    const beta = createFactories({
      db,
      tables: { users },
      definitions: {
        users: userFactory,
      },
    });

    await alpha.users.build({}, { transient: { domain: "alpha.test" } });
    const betaRow = await beta.users.build({}, { transient: { domain: "beta.test" } });
    // @ts-expect-error "prefix" is not part of the declared transient inputs.
    void beta.users.build({}, { transient: { prefix: "invalid" } });

    expect(betaRow.email).toBe("user-1@beta.test");
  });

  it("can lint connected registry entries by attempting a build", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      tables: { posts },
    });

    const issues = await factories.lint();

    expect(issues).toHaveLength(1);
    expect(issues[0]?.key).toBe("posts");
    expect(issues[0]?.table).toBe("posts");
    expect(issues[0]?.error.message).toContain(
      'Could not auto-resolve required columns for "posts": userId.',
    );
  });

  it("supports relation-aware belongs-to chains from schema exports", async () => {
    const { db } = await createTestDb();
    const userFactory = defineFactory(users, {
      state: ({ seq }) => ({
        email: `author-${seq}@example.com`,
        nickname: `author-${seq}`,
      }),
    });
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
      definitions: {
        users: userFactory,
      },
    });

    const post = await factories.posts.for("author", { role: "admin" }).create({
      title: "typed relation post",
    });
    const [user] = await db.select().from(users).where(eq(users.id, post.userId));

    expect(post.title).toBe("typed relation post");
    expect(user).toMatchObject({
      email: "author-1@example.com",
      nickname: "author-1",
      role: "admin",
    });
  });

  it("lets explicit for(...) plans override conflicting foreign-key overrides", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
    });

    const graph = await factories.posts
      .for("author", {
        email: "planned@example.com",
        nickname: "planned",
      })
      .createGraph({
        title: "planned wins",
        userId: 999,
      });

    expect(graph.row.userId).toBe(1);
    expect(graph.relations.author?.row.email).toBe("planned@example.com");
  });

  it("supports relation-aware has-many chains from schema exports", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
    });

    const user = await factories.users
      .hasMany("posts", 2, (index) => ({
        title: `Post ${index + 1}`,
      }))
      .create({
        email: "owner@example.com",
        nickname: "owner",
      });
    const createdPosts = await db.select().from(posts).where(eq(posts.userId, user.id));

    expect(createdPosts).toHaveLength(2);
    expect(createdPosts.map((row) => row.title)).toEqual(["Post 1", "Post 2"]);
  });

  it("supports relation-aware planning when relations exist without DB foreign keys", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { looseUsers, loosePosts, looseUsersRelations, loosePostsRelations },
      adapter: echoAdapter(log),
    });

    const post = await factories.loosePosts.for("author", { name: "Loose Author" }).create({
      title: "Loose Post",
    });

    expect(log.map((entry) => entry.table)).toEqual(["loose_users", "loose_posts"]);
    expect(post.authorId).toBe(log[0]?.values.id);
  });

  it("supports self relations and disambiguation through explicit relation keys", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { employees, employeesRelations },
      adapter: echoAdapter(log),
    });

    const report = await factories.employees.for("manager", { name: "Boss" }).create({
      name: "Report",
    });
    const manager = await factories.employees.hasMany("reports", 2).create({
      name: "Director",
    });

    expect(log.map((entry) => entry.table)).toEqual([
      "employees",
      "employees",
      "employees",
      "employees",
      "employees",
    ]);
    expect(report.managerId).toBe(log[0]?.values.id);
    expect(manager.name).toBe("Director");
    expect(log[3]?.values.managerId).toBe(log[2]?.values.id);
    expect(log[4]?.values.managerId).toBe(log[2]?.values.id);
  });

  it("supports stable Drizzle many-to-many flows through the junction table", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: {
        members,
        groups,
        memberships,
        membersRelations,
        groupsRelations,
        membershipsRelations,
      },
      adapter: echoAdapter(log),
    });

    const membership = await factories.memberships
      .for("member", { name: "Ada" })
      .for("group", { label: "Core" })
      .create();

    expect(log.map((entry) => entry.table)).toEqual(["members", "groups", "memberships"]);
    expect(membership.memberId).toBe(log[0]?.values.id);
    expect(membership.groupId).toBe(log[1]?.values.id);
  });

  it("supports relation planning for MySQL schemas with a custom adapter", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { mysqlUsers, mysqlPosts, mysqlUsersRelations, mysqlPostsRelations },
      adapter: echoAdapter(log),
    });

    const post = await factories.mysqlPosts
      .for("author", {
        displayName: "Ada",
      })
      .create({
        title: "MySQL post",
      });

    expect(post.authorId).toBe(log[0]?.values.id);
    expect(log.map((entry) => entry.table)).toEqual(["mysql_users", "mysql_posts"]);
  });

  it("supports has-one relation planning for SQLite schemas with a custom adapter", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { sqliteUsers, sqliteProfiles, sqliteUsersRelations, sqliteProfilesRelations },
      adapter: echoAdapter(log),
    });

    const user = await factories.sqliteUsers.create({
      displayName: "SQLite User",
    });
    const userWithProfile = await factories.sqliteUsers.hasOne("profile").create({
      displayName: "Has One",
    });

    expect(user.displayName).toBe("SQLite User");
    expect(userWithProfile.displayName).toBe("Has One");
    expect(log.map((entry) => entry.table)).toEqual([
      "sqlite_users",
      "sqlite_users",
      "sqlite_profiles",
    ]);
    expect(log[2]?.values.userId).toBe(log[1]?.values.id);
  });

  it("returns a graph for hasOne(...) relation plans", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { sqliteUsers, sqliteProfiles, sqliteUsersRelations, sqliteProfilesRelations },
      adapter: echoAdapter(log),
    });

    const graph = await factories.sqliteUsers.hasOne("profile").createGraph({
      displayName: "Graph User",
    });

    expect(graph.source).toBe("created");
    expect(graph.relations.profile?.row.userId).toBe(graph.row.id);
    expect(graph.relations.profile?.source).toBe("created");
  });

  it("reuses an existing parent row with existing(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
    });

    const author = await factories.users.create({
      email: "saved@example.com",
      nickname: "saved",
    });
    const post = await factories.posts.for("author", existing(users, author)).create({
      title: "Reused author",
    });
    // @ts-expect-error "author" expects an existing users row, not a posts row.
    void factories.posts.for("author", existing(posts, post));
    const createdUsers = await db.select().from(users);

    expect(post.userId).toBe(author.id);
    expect(createdUsers).toHaveLength(1);
  });

  it("marks reused graph nodes with source: existing", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
    });

    const author = await factories.users.create({
      email: "existing@example.com",
      nickname: "existing",
    });
    const graph = await factories.posts.for("author", existing(users, author)).createGraph({
      title: "Existing graph",
    });

    expect(graph.source).toBe("created");
    expect(graph.relations.author?.source).toBe("existing");
    expect(graph.relations.author?.row.id).toBe(author.id);
  });

  it("supports multiple relations to the same target table through relation keys", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: {
        relationUsers,
        relationComments,
        relationUsersRelations,
        relationCommentsRelations,
      },
      adapter: echoAdapter(log),
    });

    const graph = await factories.relationComments
      .for("author", {
        name: "Ada",
      })
      .for("reviewer", {
        name: "Lin",
      })
      .createGraph({
        body: "Dual relation comment",
      });
    // @ts-expect-error "authoredComments" is not a belongs-to relation on relationComments.
    void factories.relationComments.for("authoredComments");
    const authorRelation = graph.relations.author;
    const reviewerRelation = graph.relations.reviewer;

    expect(graph.row.body).toBe("Dual relation comment");
    expect(authorRelation?.row.name).toBe("Ada");
    expect(reviewerRelation?.row.name).toBe("Lin");
    expect(graph.row.authorId).toBe(log[0]?.values.id);
    expect(graph.row.reviewerId).toBe(log[1]?.values.id);
  });

  it("supports nested relation planning by passing a prepared related factory", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, sessions, usersRelations, postsRelations, sessionsRelations },
    });

    const post = await factories.posts
      .for(
        "author",
        factories.users.hasMany("sessions", 2, {
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      )
      .create({
        title: "Nested author",
      });
    const createdSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, post.userId));

    expect(post.title).toBe("Nested author");
    expect(createdSessions).toHaveLength(2);
  });

  it("keeps implicit FK auto-create out of graph results", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      tables: { users, posts },
    });

    const graph = await factories.posts.createGraph({
      title: "Implicit parent",
    });
    const createdUsers = await db.select().from(users);

    expect(graph.row.userId).toBe(1);
    expect(graph.relations).toEqual({});
    expect(createdUsers).toHaveLength(1);
  });

  it("returns empty arrays for hasMany(..., 0) graph branches", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { users, posts, usersRelations, postsRelations },
    });

    const graph = await factories.users.hasMany("posts", 0).createGraph({
      email: "empty@example.com",
      nickname: "empty",
    });
    const createdPosts = await db.select().from(posts).where(eq(posts.userId, graph.row.id));

    expect(graph.relations.posts).toEqual([]);
    expect(createdPosts).toHaveLength(0);
  });

  it("returns a nested graph for tree-shaped relations", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: {
        users,
        posts,
        comments,
        usersRelations,
        postsRelations,
        commentsRelations,
      },
    });

    const graph = await factories.users
      .hasMany(
        "posts",
        2,
        factories.posts.hasMany("comments", 2, (index) => ({
          body: `Comment ${index + 1}`,
        })),
      )
      .createGraph({
        email: "graph@example.com",
        nickname: "graph",
      });

    expect(graph.row.email).toBe("graph@example.com");
    expect(graph.relations.posts).toHaveLength(2);
    expect(graph.relations.posts?.[0]?.relations.comments).toHaveLength(2);
    expect(graph.relations.posts?.[1]?.relations.comments).toHaveLength(2);
    const createdPosts = await db.select().from(posts).where(eq(posts.userId, graph.row.id));
    expect(createdPosts).toHaveLength(2);
  });

  it("returns nested graphs across multiple branches", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: {
        users,
        posts,
        comments,
        sessions,
        usersRelations,
        postsRelations,
        commentsRelations,
        sessionsRelations,
      },
    });

    const graph = await factories.users
      .hasMany(
        "posts",
        1,
        factories.posts.hasMany("comments", 2, (index) => ({
          body: `Branch comment ${index + 1}`,
        })),
      )
      .hasMany("sessions", 2, (index) => ({
        expiresAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
      }))
      .createGraph({
        email: "branches@example.com",
        nickname: "branches",
      });

    expect(graph.relations.posts).toHaveLength(1);
    expect(graph.relations.posts?.[0]?.relations.comments).toHaveLength(2);
    expect(graph.relations.sessions).toHaveLength(2);
  });

  it("documents non-atomic graph creation through partial writes on failure", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    let calls = 0;
    const factories = createFactories({
      db: {},
      schema: { mysqlUsers, mysqlPosts, mysqlUsersRelations, mysqlPostsRelations },
      adapter: {
        async create({ table, values }) {
          calls += 1;
          if (calls === 3) {
            throw new Error("child create failed");
          }

          const row = { ...values } as InferSelectModel<typeof table> & Record<string, unknown>;
          log.push({
            table: tableName(table),
            values: row,
          });

          return row as InferSelectModel<typeof table>;
        },
      },
    });

    await expect(
      factories.mysqlUsers
        .hasMany("posts", 2, (index) => ({
          title: `Post ${index + 1}`,
        }))
        .createGraph({
          displayName: "partial",
        }),
    ).rejects.toThrow("child create failed");

    expect(log.map((entry) => entry.table)).toEqual(["mysql_users", "mysql_posts"]);
  });

  it("returns nested self-relation graphs", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    const factories = createFactories({
      db: {},
      schema: { employees, employeesRelations },
      adapter: echoAdapter(log),
    });

    const graph = await factories.employees
      .hasMany(
        "reports",
        2,
        factories.employees.hasMany("reports", 1, {
          name: "Grandchild",
        }),
      )
      .createGraph({
        name: "Root",
      });

    expect(graph.row.name).toBe("Root");
    expect(graph.relations.reports).toHaveLength(2);
    expect(graph.relations.reports?.[0]?.relations.reports).toHaveLength(1);
    expect(log).toHaveLength(5);
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
      nickname varchar(12) not null,
      role user_role not null
    );

    create table posts (
      id serial primary key,
      user_id integer not null references users(id),
      title varchar(24) not null
    );

    create table comments (
      id serial primary key,
      post_id integer not null references posts(id),
      body varchar(32) not null
    );

    create table sessions (
      id serial primary key,
      user_id integer not null references users(id),
      token varchar(16) not null,
      expires_at timestamptz not null
    );
  `);

  const db = drizzle(client);

  return { client, db };
}

function echoAdapter(log: Array<{ table: string; values: Record<string, unknown> }>) {
  return {
    async create<TTable extends Table>({
      table,
      values,
    }: {
      table: TTable;
      values: Record<string, unknown>;
    }) {
      const row = { ...values } as InferSelectModel<TTable> & Record<string, unknown>;

      log.push({
        table: tableName(table),
        values: row,
      });

      return row as InferSelectModel<TTable>;
    },
  };
}

function tableName(table: Table) {
  const symbol = Object.getOwnPropertySymbols(table).find((value) =>
    String(value).includes("Name"),
  );

  return symbol ? String((table as unknown as Record<symbol, unknown>)[symbol]) : "unknown";
}
