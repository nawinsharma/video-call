import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';

export const jwtPlugin = new Elysia({ name: 'jwt' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      exp: '7d',
    })
  )
  .use(bearer());

export const authGuard = new Elysia({ name: 'authGuard' })
  .use(jwtPlugin)
  .derive(async ({ jwt, bearer, set }) => {
    if (!bearer) {
      set.status = 401;
      throw new Error('Unauthorized: No token provided');
    }

    const payload = await jwt.verify(bearer);
    if (!payload) {
      set.status = 401;
      throw new Error('Unauthorized: Invalid token');
    }

    return {
      user: payload as { userId: string; username: string },
    };
  });
