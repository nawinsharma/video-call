/**
 * OpenAPI 3 fragments merged into {@link https://github.com/elysiajs/elysia-swagger @elysiajs/swagger}
 * together with routes inferred from Elysia handlers.
 */
export const openApiDocumentation = {
  info: {
    title: 'Video Call Server API',
    version: '1.0.0',
    description:
      'REST API for contacts, JWT auth, ICE (TURN/STUN), and call history.\n\n' +
      '**WebSocket signaling**: `GET /ws/signaling` (query: `userId`, `username`) — carries WebRTC offer/answer, ICE candidates, `call:*` events.',
  },
  tags: [
    { name: 'System', description: 'Health checks' },
    {
      name: 'Auth',
      description: 'Register with email OTP and sign in — responses include JWT for `Authorization: Bearer`.',
    },
    {
      name: 'Users',
      description: 'Contacts, search, and profile — JWT required.',
    },
    {
      name: 'Calls',
      description: 'Call history and ICE server configuration — JWT required.',
    },
  ],
  servers: [
    {
      url:
        process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
        process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
        `http://localhost:${process.env.PORT || 3000}`,
      description: 'API origin (set `PUBLIC_API_URL` in production, e.g. https://video-call-server.nawin.xyz)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer' as const,
        bearerFormat: 'JWT' as const,
        description: 'JWT from `POST /auth/login` or `POST /auth/register` (`token`).',
      },
    },
    schemas: {
      AuthUserProfile: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
          isOnline: { type: 'boolean' },
          lastSeen: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      AuthTokenResponse: {
        type: 'object' as const,
        properties: {
          user: { $ref: '#/components/schemas/AuthUserProfile' },
          token: { type: 'string', description: 'JWT for Bearer auth on protected routes.' },
        },
      },
      ErrorPayload: {
        type: 'object' as const,
        properties: { error: { type: 'string' } },
      },
    } as const,
  },
};
