import { Elysia } from 'elysia';
import { db, schema } from '../db';
import { eq, or, desc } from 'drizzle-orm';
import { authGuard } from '../auth/jwt';
import { getICEServers } from '../services/turn';

export const callRoutes = new Elysia({ prefix: '/calls' })
  .use(authGuard)
  .get('/history', async ({ authUser }) => {
    const history = await db
      .select()
      .from(schema.calls)
      .where(or(eq(schema.calls.callerId, authUser.userId), eq(schema.calls.calleeId, authUser.userId)))
      .orderBy(desc(schema.calls.createdAt))
      .limit(50);

    return history;
  })
  .get('/ice-servers', async ({ authUser }) => {
    const iceServers = await getICEServers(authUser.userId);
    return { iceServers };
  });
