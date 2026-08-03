import { env, isProduction } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

async function sendWithResend(message: EmailMessage) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new EmailDeliveryError(
    isProduction
      ? `Email delivery failed with status ${response.status}.`
      : `Email delivery failed with status ${response.status}: ${body}`,
  );
}

export async function sendEmail(message: EmailMessage) {
  if (env.EMAIL_PROVIDER === 'resend') {
    await sendWithResend(message);
    return;
  }

  if (isProduction) {
    throw new EmailDeliveryError('EMAIL_PROVIDER=console is not allowed in production.');
  }

  console.info(`[email:${env.EMAIL_PROVIDER}] queued "${message.subject}" to ${message.to}`);
}

export async function sendSignupVerificationEmail(args: {
  to: string;
  code: string;
  expiryMinutes: number;
}) {
  const subject = 'Verify your CT Scan Scheduling account';
  const text = [
    'Your CT Scan Scheduling verification code is:',
    args.code,
    '',
    `This code expires in ${args.expiryMinutes} minutes.`,
    'Do not share this code with anyone.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Your CT Scan Scheduling verification code is:</p>
      <p style="font-size: 28px; letter-spacing: 0.35em; font-weight: 700; margin: 16px 0;">${args.code}</p>
      <p>This code expires in ${args.expiryMinutes} minutes.</p>
      <p>Do not share this code with anyone.</p>
    </div>
  `;

  await sendEmail({
    to: args.to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail(args: {
  to: string;
  code: string;
  expiryMinutes: number;
  appOrigin: string;
  identifier: string;
  purpose?: 'reset' | 'setup';
}) {
  const recoveryUrl = new URL('/forgot-password', args.appOrigin);
  recoveryUrl.searchParams.set('identifier', args.identifier);
  recoveryUrl.searchParams.set('ready', '1');

  const isSetup = args.purpose === 'setup';
  const subject = isSetup
    ? 'Set up your CT Scan Scheduling password'
    : 'Reset your CT Scan Scheduling password';
  const intro = isSetup
    ? 'Use this verification code to finish setting up your CT Scan Scheduling account:'
    : 'Use this verification code to reset your CT Scan Scheduling password:';
  const actionLine = isSetup
    ? 'Open the password setup page:'
    : 'Open the password recovery page:';

  const text = [
    intro,
    args.code,
    '',
    `This code expires in ${args.expiryMinutes} minutes.`,
    'Do not share this code with anyone.',
    '',
    actionLine,
    recoveryUrl.toString(),
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>${intro}</p>
      <p style="font-size: 28px; letter-spacing: 0.35em; font-weight: 700; margin: 16px 0;">${args.code}</p>
      <p>This code expires in ${args.expiryMinutes} minutes.</p>
      <p>Do not share this code with anyone.</p>
      <p><a href="${recoveryUrl.toString()}">${actionLine}</a></p>
    </div>
  `;

  await sendEmail({
    to: args.to,
    subject,
    text,
    html,
  });
}
