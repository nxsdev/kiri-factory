import { PGlite } from "@electric-sql/pglite";
import { defineRelations, eq } from "drizzle-orm";
import { integer, pgEnum, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFactories, defineFactory } from "../src";

const userRole = pgEnum("user_role", ["member", "admin"]);

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

const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
});

const usersToGroups = pgTable("users_to_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  role: text("role").notNull(),
});

const relations = defineRelations(
  { employees, groups, posts, reviewComments, users, usersToGroups },
  (r) => ({
    users: {
      posts: r.many.posts(),
      memberships: r.many.usersToGroups(),
    },
    posts: {
      author: r.one.users({
        from: r.posts.authorId,
        to: r.users.id,
      }),
    },
    reviewComments: {
      author: r.one.users({
        from: r.reviewComments.authorId,
        to: r.users.id,
      }),
      reviewer: r.one.users({
        from: r.reviewComments.reviewerId,
        to: r.users.id,
      }),
    },
    employees: {
      manager: r.one.employees({
        from: r.employees.managerId,
        to: r.employees.id,
        alias: "management",
      }),
    },
    groups: {
      memberships: r.many.usersToGroups(),
    },
    usersToGroups: {
      user: r.one.users({
        from: r.usersToGroups.userId,
        to: r.users.id,
      }),
      group: r.one.groups({
        from: r.usersToGroups.groupId,
        to: r.groups.id,
      }),
    },
  }),
);

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("kiri-factory rqb-v2 runtime", () => {
  it("builds and creates many rows", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      relations,
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

    expect(built[0]?.role).toBe("admin");
    expect(created).toHaveLength(2);
  });

  it("exposes the configured public seed on the runtime", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      relations,
      seed: 123,
    });

    expect(factories.getSeed()).toBe(123);
  });

  it("auto-creates one missing single-column parent during create()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const post = await factories.posts.create({
      title: "Implicit author",
    });
    const persistedUsers = await db.select().from(users);

    expect(persistedUsers).toHaveLength(1);
    expect(post.authorId).toBe(persistedUsers[0]?.id);
  });

  it("shares one auto-created parent across createMany()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const postsCreated = await factories.posts.createMany(3, (index) => ({
      title: `Implicit author ${index + 1}`,
    }));
    const persistedUsers = await db.select().from(users);

    expect(postsCreated).toHaveLength(3);
    expect(persistedUsers).toHaveLength(1);
    expect(new Set(postsCreated.map((post) => post.authorId))).toEqual(
      new Set([persistedUsers[0]?.id]),
    );
  });

  it("auto-creates same-target required parents through separate local keys", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const comment = await factories.reviewComments.create({
      body: "Implicit same-target parents",
    });
    const persistedUsers = await db.select().from(users);

    expect(persistedUsers).toHaveLength(2);
    expect(comment.authorId).not.toBe(comment.reviewerId);
  });

  it("creates belongs-to parents through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
      role: "member",
    });

    const post = await factories.posts.for("author", author).create({
      title: "RQB v2 post",
    });

    const [persistedAuthor] = await db.select().from(users).where(eq(users.id, post.authorId));
    expect(persistedAuthor?.email).toBe("author@example.com");
  });

  it("reuses existing parents through for(..., row)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });
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
    const factories = createFactories({ db, relations });
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

  it("supports self relations through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });
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
    const factories = createFactories({ db, relations });
    const user = await factories.users.create({
      email: "member@example.com",
      nickname: "member",
      role: "member",
    });
    const group = await factories.groups.create({
      label: "Core",
    });

    const membership = await factories.usersToGroups.for("user", user).for("group", group).create({
      role: "owner",
    });

    const [persistedUser] = await db.select().from(users).where(eq(users.id, membership.userId));
    const [persistedGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, membership.groupId));

    expect(persistedUser?.email).toBe("member@example.com");
    expect(persistedGroup?.label).toBe("Core");
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

    create table groups (
      id serial primary key,
      label text not null
    );

    create table users_to_groups (
      id serial primary key,
      user_id integer not null references users(id),
      group_id integer not null references groups(id),
      role text not null
    );
  `);

  return { client, db: drizzle({ client }) };
}
