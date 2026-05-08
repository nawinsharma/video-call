import { createHmac } from 'crypto';
import axios from 'axios';

interface TURNCredentials {
  urls: string[];
  username: string;
  credential: string;
}

interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface TwilioNtsTokenResponse {
  ice_servers: ICEServer[];
}

function generateTURNCredentials(userId: string): TURNCredentials {
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

function getSelfHostedICEServers(userId: string): ICEServer[] {
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

async function getTwilioICEServers(): Promise<ICEServer[] | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const ttl = Number(process.env.TWILIO_NTS_TTL || '86400');

  if (!accountSid || !authToken) {
    return null;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`;

  try {
    const response = await axios.post<TwilioNtsTokenResponse>(
      endpoint,
      new URLSearchParams({ Ttl: String(ttl) }).toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    );

    if (Array.isArray(response.data.ice_servers) && response.data.ice_servers.length > 0) {
      return response.data.ice_servers;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[TURN] Failed to fetch Twilio NTS token, falling back to self-hosted TURN: ${message}`);
  }

  return null;
}

export async function getICEServers(userId: string): Promise<ICEServer[]> {
  const twilioIceServers = await getTwilioICEServers();
  if (twilioIceServers) {
    return twilioIceServers;
  }

  return getSelfHostedICEServers(userId);
}
