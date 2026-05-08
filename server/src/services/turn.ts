import { createHmac } from 'crypto';

interface TURNCredentials {
  urls: string[];
  username: string;
  credential: string;
}

export function generateTURNCredentials(userId: string): TURNCredentials {
  const turnSecret = process.env.TURN_SECRET || 'turn-secret-key';
  const turnServer = process.env.TURN_SERVER || 'turn:turn.example.com:3478';
  const turnTlsServer = process.env.TURN_TLS_SERVER || 'turns:turn.example.com:5349';

  const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600; // 24h validity
  const username = `${timestamp}:${userId}`;

  const hmac = createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return {
    urls: [turnServer, turnTlsServer],
    username,
    credential,
  };
}

export function getICEServers(userId: string) {
  const turnCredentials = generateTURNCredentials(userId);

  return [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: turnCredentials.urls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    },
  ];
}
