import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, ne, ilike } from 'drizzle-orm';
import { authGuard } from '../auth/jwt';
import { connectionManager } from '../websocket/connections';

export const userRoutes = new Elysia({ prefix: '/users' })
  .use(authGuard)
  .get('/', async ({ user }) => {
    const allUsers = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        isOnline: schema.users.isOnline,
        lastSeen: schema.users.lastSeen,
      })
      .from(schema.users)
      .where(ne(schema.users.id, user.userId));

    return allUsers.map((u) => ({
      ...u,
      isOnline: connectionManager.isOnline(u.id),
    }));
  })
  .get(
    '/search',
    async ({ query, user }) => {
      const { q } = query;
      if (!q || q.length < 2) return [];

      const results = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
        })
        .from(schema.users)
        .where(ilike(schema.users.username, `%${q}%`))
        .limit(20);

      return results.filter((u) => u.id !== user.userId);
    },
    { query: t.Object({ q: t.Optional(t.String()) }) }
  )
  .put(
    '/push-token',
    async ({ body, user }) => {
      await db
        .update(schema.users)
        .set({ pushToken: body.token })
        .where(eq(schema.users.id, user.userId));

      return { success: true };
    },
    { body: t.Object({ token: t.String() }) }
  )
  .get('/me', async ({ user }) => {
    const me = await db.query.users.findFirst({
      where: eq(schema.users.id, user.userId),
    });

    if (!me) return { error: 'User not found' };

    return {
      id: me.id,
      username: me.username,
      displayName: me.displayName,
      avatarUrl: me.avatarUrl,
    };
  });
