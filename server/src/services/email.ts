import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'OneConnect <onboarding@resend.dev>';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  return new Resend(apiKey);
}

export async function sendRegistrationOtpEmail(email: string, otp: string) {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Your OneConnect verification code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a;">
        <p>Your OneConnect verification code is:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 20px 0;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
    text: `Your OneConnect verification code is ${otp}. This code expires in 10 minutes.`,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send verification email');
  }
}
