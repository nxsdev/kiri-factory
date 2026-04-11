import { type Client, createClient } from "@libsql/client";
import { relations, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  check,
  customType,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFactories, defineFactory } from "../src";

const jsonColumn = customType<{ data: Record<string, unknown>; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return JSON.parse(value) as Record<string, unknown>;
  },
});

const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  nickname: text("nickname").notNull(),
});

const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull(),
});

const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    check("reviews_rating_check", sql`${table.rating} between 1 and 5`),
    check("reviews_status_check", sql`${table.status} in ('draft', 'published')`),
  ],
);

const reviewComments = sqliteTable("review_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
});

const orderVersions = sqliteTable(
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

const orderVersionLines = sqliteTable(
  "order_version_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    version: integer("version").notNull(),
    sku: text("sku").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orderId, table.version],
      foreignColumns: [orderVersions.orderId, orderVersions.version],
    }),
  ],
);

const jsonNotes = sqliteTable("json_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  payload: jsonColumn("payload").notNull(),
});

const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  reviews: many(reviews),
}));

const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
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

const orderVersionLinesRelations = relations(orderVersionLines, ({ one }) => ({
  orderVersion: one(orderVersions, {
    fields: [orderVersionLines.orderId, orderVersionLines.version],
    references: [orderVersions.orderId, orderVersions.version],
  }),
}));

const schema = {
  jsonNotes,
  orderVersionLines,
  orderVersionLinesRelations,
  orderVersions,
  reviewComments,
  reviewCommentsRelations,
  reviews,
  reviewsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
};

const clients: Client[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.close();
  }
});

describe("kiri-factory sqlite runtime", () => {
  it("builds and creates many rows against libsql", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema,
      definitions: {
        users: defineFactory(users, {
          columns: (f) => ({
            nickname: f.string({ isUnique: true }),
          }),
        }),
      },
    });

    const built = await factories.users.buildMany(2, (index) => ({
      email: `built-${index + 1}@example.com`,
    }));
    const created = await factories.users.createMany(2, (index) => ({
      email: `created-${index + 1}@example.com`,
    }));

    expect(built).toHaveLength(2);
    expect(built[0]?.email).toBe("built-1@example.com");
    expect(created).toHaveLength(2);
    expect(created[0]?.id).toBeTypeOf("number");
    expect(created[1]?.email).toBe("created-2@example.com");
  });

  it("auto-creates a missing single-column parent during create()", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { sessions, users },
    });

    const session = await factories.sessions.create({
      token: "auto-parent",
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

    const createdSessions = await factories.sessions.createMany(3, (index) => ({
      token: `token-${index + 1}`,
    }));
    const persistedUsers = await db.select().from(users);

    expect(createdSessions).toHaveLength(3);
    expect(persistedUsers).toHaveLength(1);
    expect(new Set(createdSessions.map((session) => session.userId))).toEqual(
      new Set([persistedUsers[0]?.id]),
    );
  });

  it("wires belongs-to parents through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
    });

    const session = await factories.sessions.for("user", author).create({
      token: "for-parent",
    });

    expect(session.userId).toBe(author.id);
  });

  it("supports same-target relation keys through multiple for(...) calls", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const author = await factories.users.create({
      email: "author@example.com",
      nickname: "author",
    });
    const reviewer = await factories.users.create({
      email: "reviewer@example.com",
      nickname: "reviewer",
    });

    const comment = await factories.reviewComments
      .for("author", author)
      .for("reviewer", reviewer)
      .create({
        body: "LGTM",
      });

    expect(comment.authorId).toBe(author.id);
    expect(comment.reviewerId).toBe(reviewer.id);
    expect(comment.authorId).not.toBe(comment.reviewerId);
  });

  it("parses simple single-column CHECK constraints as guardrails", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { reviews, users },
    });

    await expect(factories.reviews.create()).rejects.toThrow(
      /does not satisfy a simple CHECK constraint/i,
    );

    const review = await factories.reviews.create({
      rating: 4,
      status: "draft",
    });

    expect(review.rating).toBe(4);
    expect(review.status).toBe("draft");
  });

  it("copies composite foreign keys through for(...)", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({ db, schema });
    const version = await factories.orderVersions.create({
      orderId: 1,
      version: 1,
      note: "first version",
    });

    const line = await factories.orderVersionLines.for("orderVersion", version).create({
      sku: "SKU-1",
    });

    expect(line.orderId).toBe(version.orderId);
    expect(line.version).toBe(version.version);
    expect(line.sku).toBe("SKU-1");
  });

  it("resolves customType columns through inference resolvers", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { jsonNotes },
      inference: {
        customTypes: {
          text: ({ sequence }) => ({ value: sequence }),
        },
      },
    });

    const note = await factories.jsonNotes.create({
      title: "Inference-backed",
    });

    expect(note.title).toBe("Inference-backed");
    expect(note.payload).toEqual({ value: 1 });
  });

  it("runs verifyCreates() against a real SQLite database", async () => {
    const { db } = await createTestDb();
    const factories = createFactories({
      db,
      schema: { sessions, users },
    });

    const issues = await factories.verifyCreates();

    expect(issues).toHaveLength(0);
  });
});

async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);

  const statements = [
    `create table users (
      id integer primary key autoincrement,
      email text not null,
      nickname text not null
    )`,
    `create table sessions (
      id integer primary key autoincrement,
      user_id integer not null references users(id),
      token text not null
    )`,
    `create table reviews (
      id integer primary key autoincrement,
      user_id integer not null references users(id),
      rating integer not null,
      status text not null,
      constraint reviews_rating_check check (rating between 1 and 5),
      constraint reviews_status_check check (status in ('draft', 'published'))
    )`,
    `create table review_comments (
      id integer primary key autoincrement,
      author_id integer not null references users(id),
      reviewer_id integer not null references users(id),
      body text not null
    )`,
    `create table order_versions (
      order_id integer not null,
      version integer not null,
      note text not null,
      primary key (order_id, version)
    )`,
    `create table order_version_lines (
      id integer primary key autoincrement,
      order_id integer not null,
      version integer not null,
      sku text not null,
      foreign key (order_id, version) references order_versions (order_id, version)
    )`,
    `create table json_notes (
      id integer primary key autoincrement,
      title text not null,
      payload text not null
    )`,
  ];

  for (const statement of statements) {
    await client.execute(statement);
  }

  return { client, db: drizzle(client) };
}
