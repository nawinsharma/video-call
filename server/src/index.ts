import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { callRoutes } from './routes/calls';
import { websocketHandler } from './websocket/handler';
import { auth } from './auth/betterAuth';
import { openApiDocumentation } from './openapi-documentation';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const app = new Elysia()
  .use(cors({ origin: true }))
  .use(
    swagger({
      path: '/swagger',
      scalarConfig: {
        spec: {
          // Absolute URL so `/swagger/` (trailing slash) still loads `/swagger/json`; relative `swagger/json` breaks.
          url: '/swagger/json',
        },
      },
      documentation: openApiDocumentation,
      exclude: [/^\/ws\//],
    }),
  )
  .get(
    '/',
    () => ({ status: 'api is running bruhhh', timestamp: new Date().toISOString() }),
    { detail: { tags: ['System'], summary: 'Root', description: 'Simple liveness hint.' } },
  )
  .get(
    '/health',
    () => ({ status: 'ok', timestamp: new Date().toISOString() }),
    {
      detail: {
        tags: ['System'],
        summary: 'Health check',
      },
    },
  )
  .mount(auth.handler)
  .use(authRoutes)
  .use(userRoutes)
  .use(callRoutes)
  .use(websocketHandler)
  .listen({ port, hostname: host });

console.log(`Server running at http://${host}:${port}`);

export type App = typeof app;
