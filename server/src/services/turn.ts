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

const PUBLIC_STUN_SERVERS: ICEServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
];

let warnedMissingTurn = false;

function parseUrls(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function getConfiguredTurnUrls() {
  const explicitUrls = parseUrls(process.env.TURN_URLS);
  if (explicitUrls.length > 0) return explicitUrls;

  return [process.env.TURN_SERVER, process.env.TURN_TLS_SERVER]
    .filter((url): url is string => Boolean(url))
    .filter((url) => !url.includes('example.com'));
}

function generateTURNCredentials(userId: string, urls: string[]): TURNCredentials | null {
  const turnSecret = process.env.TURN_SECRET;
  if (!turnSecret || turnSecret === 'your-turn-secret-key' || turnSecret === 'turn-secret-key') {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600; // 24h validity
  const username = `${timestamp}:${userId}`;

  const hmac = createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return {
    urls,
    username,
    credential,
  };
}

function getSelfHostedICEServers(userId: string): ICEServer[] {
  const turnUrls = getConfiguredTurnUrls();
  const staticUsername = process.env.TURN_USERNAME;
  const staticCredential = process.env.TURN_PASSWORD ?? process.env.TURN_CREDENTIAL;

  if (turnUrls.length > 0 && staticUsername && staticCredential) {
    return [
      ...PUBLIC_STUN_SERVERS,
      {
        urls: turnUrls,
        username: staticUsername,
        credential: staticCredential,
      },
    ];
  }

  const generatedCredentials = turnUrls.length > 0 ? generateTURNCredentials(userId, turnUrls) : null;
  if (generatedCredentials) {
    return [
      ...PUBLIC_STUN_SERVERS,
      {
        urls: generatedCredentials.urls,
        username: generatedCredentials.username,
        credential: generatedCredentials.credential,
      },
    ];
  }

  if (!warnedMissingTurn) {
    warnedMissingTurn = true;
    console.warn(
      '[TURN] No real TURN server is configured. Calls may fail across carrier NATs or strict firewalls. ' +
        'Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN or TURN_URLS plus TURN_USERNAME/TURN_PASSWORD.'
    );
  }

  return PUBLIC_STUN_SERVERS;
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
