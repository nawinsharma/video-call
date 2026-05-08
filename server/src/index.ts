import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { callRoutes } from './routes/calls';
import { websocketHandler } from './websocket/handler';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const app = new Elysia()
  .use(cors({ origin: true }))
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'Video Call Server API',
          version: '1.0.0',
          description: 'REST and signaling support API for the mobile video call app',
        },
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Users', description: 'User endpoints' },
          { name: 'Calls', description: 'Call and ICE endpoints' },
        ],
      },
    }),
  )
  .get('/', () => ({ status: 'api is running bruhhh', timestamp: new Date().toISOString() }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(userRoutes)
  .use(callRoutes)
  .use(websocketHandler)
  .listen({ port, hostname: host });

console.log(`Server running at http://${host}:${port}`);

export type App = typeof app;
