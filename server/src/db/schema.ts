import { pgTable, text, timestamp, uuid, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

export const callStatusEnum = pgEnum('call_status', ['ringing', 'active', 'ended', 'missed', 'rejected']);
export const callTypeEnum = pgEnum('call_type', ['audio', 'video']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(),
  pushToken: text('push_token'),
  isOnline: boolean('is_online').default(false),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  callerId: uuid('caller_id').references(() => users.id).notNull(),
  calleeId: uuid('callee_id').references(() => users.id).notNull(),
  type: callTypeEnum('type').notNull(),
  status: callStatusEnum('status').default('ringing').notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  pushToken: text('push_token').notNull(),
  platform: text('platform').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Device = typeof devices.$inferSelect;
