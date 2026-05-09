import { Elysia } from 'elysia';
import { db, schema } from '../db';
import { eq, or, desc } from 'drizzle-orm';
import { authGuard } from '../auth/jwt';
import { getICEServers } from '../services/turn';

const callsDetail = {
  tags: ['Calls'],
  security: [{ bearerAuth: [] }],
};

export const callRoutes = new Elysia({ prefix: '/calls' })
  .use(authGuard)
  .get(
    '/history',
    async ({ authUser }) => {
    const history = await db
      .select()
      .from(schema.calls)
      .where(or(eq(schema.calls.callerId, authUser.userId), eq(schema.calls.calleeId, authUser.userId)))
      .orderBy(desc(schema.calls.createdAt))
      .limit(50);

    return history;
    },
    {
      detail: {
        ...callsDetail,
        summary: 'Call history',
        description: 'Up to 50 recent calls where the user is caller or callee.',
      },
    },
  )
  .get(
    '/ice-servers',
    async ({ authUser }) => {
      const iceServers = await getICEServers(authUser.userId);
      return { iceServers };
    },
    {
      detail: {
        ...callsDetail,
        summary: 'ICE servers (STUN/TURN)',
        description: 'Credentials/configuration for WebRTC; may include Twilio NTS when configured.',
      },
    },
  );
