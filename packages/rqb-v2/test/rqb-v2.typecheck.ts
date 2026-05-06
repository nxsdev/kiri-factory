import { defineRelations } from "drizzle-orm";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { createFactories, defineFactory } from "../src";

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
});

const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
});

const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id),
});

const relations = defineRelations({ comments, posts, users }, (r) => ({
  users: {
    posts: r.many.posts(),
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
}));

const db = {} as { query: unknown };
const userFactory = defineFactory(users, {
  traits: {
    admin: {
      email: "admin@example.com",
    },
  },
});
const factories = createFactories({
  db,
  definitions: {
    users: userFactory,
  },
  relations,
  seed: 123,
});

void factories.users.traits.admin.create();
factories.getSeed();

// @ts-expect-error unknown traits should not be available
factories.users.traits.missing.create();

// @ts-expect-error for should no longer exist on the public runtime
factories.posts.for("author", { id: 1 });

// @ts-expect-error hasMany should no longer exist on the public runtime
factories.users.hasMany("posts", 1);
