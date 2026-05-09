import { pgTable, text, timestamp, uuid, boolean, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

export const callStatusEnum = pgEnum('call_status', ['ringing', 'active', 'ended', 'missed', 'rejected']);
export const callTypeEnum = pgEnum('call_type', ['audio', 'video']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayUsername: text('display_username'),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  pushToken: text('push_token'),
  isOnline: boolean('is_online').default(false),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
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

export const userContacts = pgTable(
  'user_contacts',
  {
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    contactId: uuid('contact_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.contactId] })]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type UserContact = typeof userContacts.$inferSelect;
