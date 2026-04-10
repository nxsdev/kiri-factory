import { PGlite } from "@electric-sql/pglite";
import {
  defineRelations,
  eq,
  getTableColumns,
  sql,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";
import { integer, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFactories, defineFactory, existing } from "../src";

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  nickname: varchar("nickname", { length: 24 }).notNull(),
});

const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 48 }).notNull(),
});

const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id),
  body: varchar("body", { length: 48 }).notNull(),
});

const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 32 }).notNull(),
});

const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id"),
  name: varchar("name", { length: 32 }).notNull(),
});

const usersToGroups = pgTable("users_to_groups", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
});

const relations = defineRelations(
  { users, posts, comments, groups, employees, usersToGroups },
  (r) => ({
    users: {
      posts: r.many.posts(),
      groups: r.many.groups({
        from: r.users.id.through(r.usersToGroups.userId),
        to: r.groups.id.through(r.usersToGroups.groupId),
      }),
    },
    posts: {
      author: r.one.users({
        from: r.posts.authorId,
        to: r.users.id,
      }),
    },
    comments: {
      author: r.one.users({
        from: r.comments.authorId,
        to: r.users.id,
      }),
      reviewer: r.one.users({
        from: r.comments.reviewerId,
        to: r.users.id,
      }),
    },
    groups: {
      participants: r.many.users(),
    },
    employees: {
      manager: r.one.employees({
        from: r.employees.managerId,
        to: r.employees.id,
        alias: "management",
      }),
      reports: r.many.employees({
        alias: "management",
      }),
    },
  }),
);

const clients: PGlite[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("rqb-v2 createFactories", () => {
  it("creates relation-aware graphs from defineRelations()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      relations,
      definitions: {
        users: defineFactory(users, {
          state: ({ seq }) => ({
            email: `user-${seq}@example.com`,
            nickname: `user-${seq}`,
          }),
        }),
      },
    });

    const graph = await factories.users.hasMany("posts", 2).createGraph();

    expect(graph.row.email).toMatch(/^user-\d+@example\.com$/);
    expect(graph.relations.posts).toHaveLength(2);

    const persistedPosts = await db.select().from(posts).where(eq(posts.authorId, graph.row.id));
    expect(persistedPosts).toHaveLength(2);
  });

  it("creates through rows for direct many-to-many relations", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const graph = await factories.users.hasMany("groups", 2).createGraph();
    const memberships = await db
      .select()
      .from(usersToGroups)
      .where(eq(usersToGroups.userId, graph.row.id));

    expect(graph.relations.groups).toHaveLength(2);
    expect(memberships).toHaveLength(2);
  });

  it("supports direct many-to-many create() without returning a graph", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const user = await factories.users.hasMany("groups", 2).create({
      email: "member@example.com",
      nickname: "member",
    });
    const memberships = await db
      .select()
      .from(usersToGroups)
      .where(eq(usersToGroups.userId, user.id));
    const createdGroups = await db.select().from(groups);

    expect(user.email).toBe("member@example.com");
    expect(memberships).toHaveLength(2);
    expect(createdGroups).toHaveLength(2);
  });

  it("supports reversed many-to-many edges", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const graph = await factories.groups.hasMany("participants", 2).createGraph();
    const memberships = await db
      .select()
      .from(usersToGroups)
      .where(eq(usersToGroups.groupId, graph.row.id));

    expect(graph.relations.participants).toHaveLength(2);
    expect(memberships).toHaveLength(2);
  });

  it("supports same-target relation keys", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const graph = await factories.comments
      .for("author", { email: "author@example.com" })
      .for("reviewer", { email: "reviewer@example.com" })
      .createGraph({
        body: "Looks good",
      });

    expect(graph.relations.author?.row.email).toBe("author@example.com");
    expect(graph.relations.reviewer?.row.email).toBe("reviewer@example.com");

    const [persisted] = await db.select().from(comments).where(eq(comments.id, graph.row.id));
    expect(persisted?.authorId).not.toBe(persisted?.reviewerId);
  });

  it("marks basic reused relation nodes with source: existing", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });
    const author = await factories.users.create({
      email: "existing@example.com",
      nickname: "existing",
    });

    const graph = await factories.posts.for("author", existing(users, author)).createGraph({
      title: "Existing author",
    });
    const createdUsers = await db.select().from(users);

    expect(graph.source).toBe("created");
    expect(graph.relations.author?.source).toBe("existing");
    expect(graph.relations.author?.row.id).toBe(author.id);
    expect(graph.row.authorId).toBe(author.id);
    expect(createdUsers).toHaveLength(1);
  });

  it("supports mixing existing and created rows across same-target relation keys", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });
    const author = await factories.users.create({
      email: "existing-author@example.com",
      nickname: "existing-author",
    });

    const graph = await factories.comments
      .for("author", existing(users, author))
      .for("reviewer", {
        email: "created-reviewer@example.com",
      })
      .createGraph({
        body: "Mixed same-target relation",
      });

    expect(graph.relations.author?.source).toBe("existing");
    expect(graph.relations.author?.row.id).toBe(author.id);
    expect(graph.relations.reviewer?.source).toBe("created");
    expect(graph.row.authorId).toBe(author.id);
    expect(graph.row.reviewerId).not.toBe(author.id);
  });

  it("supports many-to-many graph lists without duplicating through rows", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    const graphs = await factories.users.hasMany("groups", 2).createGraphList(2, (index) => ({
      email: `graph-list-${index + 1}@example.com`,
      nickname: `graph-list-${index + 1}`,
    }));
    const memberships = await db.select().from(usersToGroups);

    expect(graphs).toHaveLength(2);
    expect(graphs[0]?.relations.groups).toHaveLength(2);
    expect(graphs[1]?.relations.groups).toHaveLength(2);
    expect(memberships).toHaveLength(4);
  });

  it("documents non-atomic direct many-to-many graph creation through partial writes on failure", async () => {
    const log: Array<{ table: string; values: Record<string, unknown> }> = [];
    let calls = 0;
    const nextIdByTable = new Map<string, number>();
    const factories = createFactories({
      db: {},
      relations,
      adapter: {
        async create<TTable extends Table>({
          table,
          values,
        }: {
          table: TTable;
          values: Record<string, unknown>;
        }) {
          calls += 1;
          if (calls === 3) {
            throw new Error("through row create failed");
          }

          const row = withGeneratedIds(table, values, nextIdByTable);
          log.push({
            table: tableName(table),
            values: row,
          });

          return row as InferSelectModel<TTable>;
        },
      },
    });

    await expect(
      factories.users.hasMany("groups", 2).createGraph({
        email: "partial@example.com",
        nickname: "partial",
      }),
    ).rejects.toThrow("through row create failed");

    expect(log.map((entry) => entry.table)).toEqual(["users", "groups"]);
  });

  it("supports nested self-relation graphs", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

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
  });

  it("rejects reciprocal parent plans inside prepared child factories", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, relations });

    await expect(
      factories.users
        .hasMany(
          "posts",
          1,
          factories.posts.for("author", {
            email: "shadow@example.com",
          }),
        )
        .create({
          email: "owner@example.com",
          nickname: "owner",
        }),
    ).rejects.toThrow('Remove the reciprocal for("author")');
  });
});

async function createTestDb() {
  const client = new PGlite();
  clients.push(client);

  await client.exec(`
    create table users (
      id serial primary key,
      email text not null,
      nickname varchar(24) not null
    );

    create table posts (
      id serial primary key,
      author_id integer not null references users(id),
      title varchar(48) not null
    );

    create table comments (
      id serial primary key,
      author_id integer not null references users(id),
      reviewer_id integer not null references users(id),
      body varchar(48) not null
    );

    create table groups (
      id serial primary key,
      name varchar(32) not null
    );

    create table employees (
      id serial primary key,
      manager_id integer references employees(id),
      name varchar(32) not null
    );

    create table users_to_groups (
      user_id integer not null references users(id),
      group_id integer not null references groups(id),
      primary key (user_id, group_id)
    );
  `);

  const db = drizzle({ client });
  await db.execute(sql`select 1`);

  return { client, db };
}

function withGeneratedIds(
  table: Table,
  values: Record<string, unknown>,
  nextIdByTable: Map<string, number>,
) {
  const row = { ...values };
  const tableColumns = getTableColumns(table) as Record<string, unknown>;

  if ("id" in tableColumns && row.id === undefined) {
    const tableKey = tableName(table);
    const nextId = (nextIdByTable.get(tableKey) ?? 0) + 1;
    nextIdByTable.set(tableKey, nextId);
    row.id = nextId;
  }

  return row;
}

function tableName(table: Table) {
  const symbol = Object.getOwnPropertySymbols(table).find((value) =>
    String(value).includes("Name"),
  );

  return symbol ? String((table as unknown as Record<symbol, unknown>)[symbol]) : "unknown";
}
