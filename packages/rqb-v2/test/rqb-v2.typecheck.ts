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
const userFactory = defineFactory(users);
const factories = createFactories({
  db,
  definitions: {
    users: userFactory,
  },
  relations,
});

const author = {} as typeof users.$inferSelect;
const reviewer = {} as typeof users.$inferSelect;

factories.posts.for("author", author);
factories.comments.for("author", author).for("reviewer", reviewer);

// @ts-expect-error for should not accept a many relation key
factories.users.for("posts");

// @ts-expect-error for(...) must use the relation target table row
factories.posts.for("author", { id: 1, authorId: 1 });

// @ts-expect-error hasMany should no longer exist on the public runtime
factories.users.hasMany("posts", 1);
