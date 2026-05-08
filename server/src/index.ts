import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { callRoutes } from './routes/calls';
import { websocketHandler } from './websocket/handler';

const app = new Elysia()
  .use(cors({ origin: true }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(userRoutes)
  .use(callRoutes)
  .use(websocketHandler)
  .listen(process.env.PORT || 3000);

console.log(`Server running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
