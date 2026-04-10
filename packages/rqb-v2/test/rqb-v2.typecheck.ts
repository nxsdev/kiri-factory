import { defineRelations } from "drizzle-orm";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { createFactories, defineFactory, existing } from "../src";

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

const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const usersToGroups = pgTable("users_to_groups", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
});

const relations = defineRelations({ users, posts, groups, usersToGroups }, (r) => ({
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
  groups: {
    participants: r.many.users(),
  },
}));

const db = {} as { query: unknown };
const userFactory = defineFactory(users);
const groupFactory = defineFactory(groups);
const postFactory = defineFactory(posts);
const factories = createFactories({
  db,
  definitions: {
    users: userFactory,
  },
  relations,
});

factories.posts.for("author", userFactory);
factories.users.hasMany("posts", 2, postFactory);
factories.users.hasMany("groups", 2, groupFactory);
factories.groups.hasMany("participants", 1, userFactory);

// @ts-expect-error hasMany should not accept a one relation key
factories.posts.hasMany("author", 1);

// @ts-expect-error for should not accept a many relation key
factories.users.for("posts");

// @ts-expect-error existing(...) must use the relation target table
factories.posts.for("author", existing(groups, { id: 1, name: "core" }));
