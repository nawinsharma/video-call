import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { and, eq, ilike, ne, or } from 'drizzle-orm';
import { authGuard } from '../auth/jwt';
import { connectionManager } from '../websocket/connections';

const userDetail = {
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
};

export const userRoutes = new Elysia({ prefix: '/users' })
  .use(authGuard)
  .get(
    '/',
    async ({ authUser }) => {
      const contacts = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          isOnline: schema.users.isOnline,
          lastSeen: schema.users.lastSeen,
        })
        .from(schema.userContacts)
        .innerJoin(schema.users, eq(schema.userContacts.contactId, schema.users.id))
        .where(eq(schema.userContacts.ownerId, authUser.userId));

      return contacts.map((u) => ({
        ...u,
        isOnline: connectionManager.isOnline(u.id),
      }));
    },
    { detail: { ...userDetail, summary: 'List contacts', description: 'People you have saved as contacts.' } },
  )
  .get(
    '/search',
    async ({ query, authUser }) => {
      const q = query.q?.trim();
      if (!q || q.length < 2) return [];

      const existingContacts = await db
        .select({ contactId: schema.userContacts.contactId })
        .from(schema.userContacts)
        .where(eq(schema.userContacts.ownerId, authUser.userId));
      const contactIds = new Set(existingContacts.map((contact) => contact.contactId));

      const results = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          isOnline: schema.users.isOnline,
          lastSeen: schema.users.lastSeen,
        })
        .from(schema.users)
        .where(
          and(
            ne(schema.users.id, authUser.userId),
            or(
              ilike(schema.users.username, `%${q}%`),
              ilike(schema.users.email, `%${q}%`)
            )
          )
        )
        .limit(20);

      return results
        .map((u) => ({
          ...u,
          isOnline: connectionManager.isOnline(u.id),
          isContact: contactIds.has(u.id),
        }));
    },
    {
      query: t.Object({ q: t.Optional(t.String()) }),
      detail: {
        ...userDetail,
        summary: 'Search users',
        description: '`q` must be at least 2 characters. Excludes yourself; includes basic profile and presence.',
      },
    },
  )
  .post(
    '/contacts',
    async ({ body, authUser, set }) => {
      if (body.userId === authUser.userId) {
        set.status = 400;
        return { error: 'You cannot add yourself as a contact' };
      }

      const contact = await db.query.users.findFirst({
        where: eq(schema.users.id, body.userId),
      });

      if (!contact) {
        set.status = 404;
        return { error: 'User not found' };
      }

      await db
        .insert(schema.userContacts)
        .values({ ownerId: authUser.userId, contactId: body.userId })
        .onConflictDoNothing();

      return {
        id: contact.id,
        username: contact.username,
        email: contact.email,
        displayName: contact.displayName,
        avatarUrl: contact.avatarUrl,
        isOnline: connectionManager.isOnline(contact.id),
        lastSeen: contact.lastSeen,
        isContact: true,
      };
    },
    {
      body: t.Object({ userId: t.String() }),
      detail: { ...userDetail, summary: 'Add contact', description: 'Idempotent per owner/contact pair.' },
    },
  )
  .put(
    '/push-token',
    async ({ body, authUser }) => {
      await db
        .update(schema.users)
        .set({ pushToken: body.token })
        .where(eq(schema.users.id, authUser.userId));

      return { success: true };
    },
    {
      body: t.Object({ token: t.String() }),
      detail: { ...userDetail, summary: 'Register Expo push token', description: 'Used for offline call pushes.' },
    },
  )
  .get(
    '/me',
    async ({ authUser }) => {
      const me = await db.query.users.findFirst({
        where: eq(schema.users.id, authUser.userId),
      });

      if (!me) return { error: 'User not found' };

      return {
        id: me.id,
        username: me.username,
        email: me.email,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
      };
    },
    { detail: { ...userDetail, summary: 'Current user profile', description: 'Bearer-authenticated viewer.' } },
  );
