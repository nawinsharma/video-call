import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, or } from 'drizzle-orm';
import { verifyPassword } from '../auth/password';
import { jwtPlugin } from '../auth/jwt';
import { auth as betterAuth } from '../auth/betterAuth';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function toAuthUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? undefined,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? undefined,
    isOnline: user.isOnline ?? false,
    lastSeen: user.lastSeen?.toISOString(),
  };
}

async function signAppToken(
  jwt: { sign: (payload: { userId: string; username: string }) => Promise<string> },
  user: typeof schema.users.$inferSelect
) {
  return jwt.sign({ userId: user.id, username: user.username });
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtPlugin)
  .post(
    '/register/send-otp',
    async ({ body, set }) => {
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const displayName = body.displayName.trim() || username;

      const existing = await db.query.users.findFirst({
        where: or(eq(schema.users.username, username), eq(schema.users.email, email)),
      });

      if (existing) {
        set.status = 409;
        return { error: existing.email === email ? 'Email already registered' : 'Username already taken' };
      }

      try {
        await betterAuth.api.signUpEmail({
          body: {
            email,
            password: body.password,
            name: displayName,
            username,
            displayUsername: username,
            rememberMe: true,
          },
          headers: new Headers(),
        });
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Could not prepare registration',
        };
      }

      await betterAuth.api.sendVerificationOTP({
        body: { email, type: 'email-verification' },
      });

      return { success: true };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3 }),
        email: t.String({ minLength: 3 }),
        password: t.String({ minLength: 6 }),
        displayName: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Send registration OTP',
        description:
          'Validates uniqueness, creates credentials via Better Auth, and sends an email OTP for `/auth/register`.',
      },
    }
  )
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);

      const pendingUser = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });

      if (!pendingUser || pendingUser.username !== username) {
        set.status = 400;
        return { error: 'Start registration again before verifying this code' };
      }

      try {
        await betterAuth.api.verifyEmailOTP({
          body: { email, otp: body.otp.trim() },
          headers: new Headers(),
        });
      } catch {
        set.status = 400;
        return { error: 'Invalid or expired verification code' };
      }

      const [user] = await db
        .update(schema.users)
        .set({ emailVerified: true, displayUsername: username, updatedAt: new Date() })
        .where(eq(schema.users.id, pendingUser.id))
        .returning();

      if (!user) {
        set.status = 500;
        return { error: 'Registration completed, but user profile could not be loaded' };
      }

      const token = await signAppToken(jwt, user);
      return { user: toAuthUser(user), token };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3 }),
        email: t.String({ minLength: 3 }),
        otp: t.String({ minLength: 4 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Complete registration',
        description: 'Verifies email OTP with Better Auth and returns JWT plus user profile.',
      },
    }
  )
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const identifier = body.identifier.trim();
      const isEmail = identifier.includes('@');
      let user: typeof schema.users.$inferSelect | undefined;

      try {
        const authResult = isEmail
          ? await betterAuth.api.signInEmail({
              body: {
                email: normalizeEmail(identifier),
                password: body.password,
                rememberMe: true,
              },
              headers: new Headers(),
            })
          : await betterAuth.api.signInUsername({
              body: {
                username: identifier,
                password: body.password,
                rememberMe: true,
              },
              headers: new Headers(),
            });

        user = await db.query.users.findFirst({
          where: eq(schema.users.id, authResult.user.id),
        });
      } catch {
        const normalizedIdentifier = isEmail ? normalizeEmail(identifier) : normalizeUsername(identifier);
        user = await db.query.users.findFirst({
          where: isEmail
            ? eq(schema.users.email, normalizedIdentifier)
            : eq(schema.users.username, normalizedIdentifier),
        });

        if (!user?.passwordHash) {
          user = undefined;
        } else {
          const valid = await verifyPassword(body.password, user.passwordHash);
          if (!valid) user = undefined;
        }
      }

      if (!user) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      const token = await signAppToken(jwt, user);

      await db
        .update(schema.users)
        .set({ isOnline: true, lastSeen: new Date() })
        .where(eq(schema.users.id, user.id));

      return {
        user: toAuthUser(user),
        token,
      };
    },
    {
      body: t.Object({
        identifier: t.String(),
        password: t.String(),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Sign in',
        description: 'Logs in by email address or username. Returns JWT and marks user online.',
      },
    }
  );
