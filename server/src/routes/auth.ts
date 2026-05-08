import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../auth/password';
import { jwtPlugin } from '../auth/jwt';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtPlugin)
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const { username, password, displayName } = body;

      const existing = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (existing) {
        set.status = 409;
        return { error: 'Username already taken' };
      }

      const passwordHash = await hashPassword(password);

      const [user] = await db
        .insert(schema.users)
        .values({ username, passwordHash, displayName })
        .returning();

      const token = await jwt.sign({ userId: user?.id, username: user?.username });

      return {
        user: { id: user?.id, username: user?.username, displayName: user?.displayName },
        token,
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3 }),
        password: t.String({ minLength: 6 }),
        displayName: t.String({ minLength: 1 }),
      }),
    }
  )
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const { username, password } = body;

      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!user) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      const token = await jwt.sign({ userId: user.id, username: user.username });

      await db
        .update(schema.users)
        .set({ isOnline: true, lastSeen: new Date() })
        .where(eq(schema.users.id, user.id));

      return {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        token,
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    }
  );
