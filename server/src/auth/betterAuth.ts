import { betterAuth } from 'better-auth';
import { emailOTP, username } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db, schema } from '../db';
import { sendRegistrationOtpEmail } from '../services/email';

const port = process.env.PORT || '3000';
const baseURL = process.env.BETTER_AUTH_URL || `http://localhost:${port}`;

export const auth = betterAuth({
  appName: 'OneConnect',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'change-this-better-auth-secret',
  trustedOrigins: [
    'videocall://',
    'videocall://*',
    'oneconnect://',
    'oneconnect://*',
    ...(process.env.NODE_ENV === 'development' ? ['exp://', 'exp://**'] : []),
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  user: {
    fields: {
      name: 'displayName',
      image: 'avatarUrl',
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    requireEmailVerification: true,
    autoSignIn: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  plugins: [
    username(),
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      resendStrategy: 'rotate',
      storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'email-verification') return;
        await sendRegistrationOtpEmail(email, otp);
      },
    }),
  ],
  advanced: {
    database: {
      generateId: (options) => {
        if (options.model === 'user') return false;
        return crypto.randomUUID();
      },
    },
  },
});

export type Auth = typeof auth;
