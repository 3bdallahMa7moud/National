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

function previewDeliveryMessage() {
  return 'Real email delivery is not configured. Set EMAIL_PROVIDER="resend", RESEND_API_KEY, and a valid EMAIL_FROM sender.';
}

function maskEmailAddress(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '[invalid-email]';
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 1))}@${domain}`;
}

function sanitizeProviderLog(value: string) {
  return value
    .replace(/\bre_[A-Za-z0-9_-]+\b/g, '[REDACTED_API_KEY]')
    .replace(/(?<!\d)\d{6}(?!\d)/g, '[REDACTED_OTP]');
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function sendWithResend(message: EmailMessage) {
  let response: Response;
  const recipient = maskEmailAddress(message.to);

  try {
    response = await fetch('https://api.resend.com/emails', {
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
  } catch (error) {
    const messageText = sanitizeProviderLog(describeError(error));
    console.error(`[email:resend] request failed for ${recipient}: ${messageText}`);
    throw new EmailDeliveryError(
      isProduction ? 'Email delivery request failed.' : `Email delivery request failed: ${messageText}`,
    );
  }

  const body = sanitizeProviderLog(await response.text());

  if (response.ok) {
    console.info(`[email:resend] send accepted for ${recipient}: status=${response.status} response=${body || '<empty>'}`);
    return;
  }

  console.error(`[email:resend] send rejected for ${recipient}: status=${response.status} response=${body || '<empty>'}`);
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

  if (env.NODE_ENV === 'test') {
    console.info(`[email:${env.EMAIL_PROVIDER}] queued "${message.subject}" to ${message.to}`);
    return;
  }

  if (isProduction) {
    throw new EmailDeliveryError('EMAIL_PROVIDER=console is not allowed in production.');
  }

  throw new EmailDeliveryError(previewDeliveryMessage());
}

interface BrandedEmailTemplateOptions {
  badgeTitleEn: string;
  badgeTitleAr: string;
  headlineEn: string;
  headlineAr: string;
  subheadEn: string;
  subheadAr: string;
  code: string;
  expiryMinutes: number;
  actionUrl?: string;
  actionTextEn?: string;
  actionTextAr?: string;
}

function renderBrandedEmailTemplate(options: BrandedEmailTemplateOptions): string {
  const actionButtonHtml = options.actionUrl && options.actionTextEn && options.actionTextAr
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.actionUrl}"
           style="background: #0284c7; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(2,132,199,0.25);">
          ${options.actionTextAr} &bull; ${options.actionTextEn}
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.headlineEn}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center;">
              <div style="display: inline-block; background: rgba(2, 132, 199, 0.2); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 20px; padding: 6px 14px; margin-bottom: 12px;">
                <span style="color: #38bdf8; font-size: 13px; font-weight: 600; letter-spacing: 0.05em;">🏥 ${options.badgeTitleAr} | ${options.badgeTitleEn}</span>
              </div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.4;">${options.headlineAr}</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 6px 0 0 0;">${options.headlineEn}</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <!-- Arabic Section -->
              <div style="direction: rtl; text-align: right; margin-bottom: 16px;">
                <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
                  ${options.subheadAr}
                </p>
              </div>

              <!-- English Section -->
              <div style="direction: ltr; text-align: left; margin-bottom: 24px;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0;">
                  ${options.subheadEn}
                </p>
              </div>

              <!-- OTP Code Display Box -->
              <div style="background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 20px 0;">
                <div style="font-size: 13px; font-weight: 600; color: #0369a1; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                  رمز التحقق • Verification Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 36px; font-weight: 800; letter-spacing: 0.25em; color: #0c4a6e; padding: 4px 0;">
                  ${options.code}
                </div>
              </div>

              <!-- Action Button (if applicable) -->
              ${actionButtonHtml}

              <!-- Expiry & Security Warning Box -->
              <div style="background: #f8fafc; border-radius: 8px; border-left: 4px solid #0284c7; border-right: 4px solid #0284c7; padding: 14px 16px; margin-top: 24px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="direction: rtl; text-align: right; color: #475569; font-size: 13px; line-height: 1.6; padding-bottom: 8px;">
                      ⏱️ <strong>صلاحية الرمز:</strong> صالح لمدة <strong>${options.expiryMinutes === 1 ? 'دقيقة واحدة' : `${options.expiryMinutes} دقائق`}</strong> فقط.<br>
                      🔒 <strong>تنبيه أمني:</strong> لا تشارك هذا الرمز مطلقاً مع أي شخص.
                    </td>
                  </tr>
                  <tr>
                    <td style="direction: ltr; text-align: left; color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                      ⏱️ This code expires in <strong>${options.expiryMinutes === 1 ? '1 minute' : `${options.expiryMinutes} minutes`}</strong>.<br>
                      🔒 Security note: Never share this verification code with anyone.
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                نظام جدولة الأشعة المقطعية &bull; CT Scan Scheduling System<br>
                هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendSignupVerificationEmail(args: {
  to: string;
  code: string;
  expiryMinutes: number;
}) {
  const expiryText = args.expiryMinutes === 1
    ? 'صلاحية الرمز: دقيقة واحدة / Expires in 1 minute.'
    : `صلاحية الرمز: ${args.expiryMinutes} دقائق / Expires in ${args.expiryMinutes} minutes.`;

  const subject = 'رمز التحقق لتسجيل الحساب | Verify your account';
  const text = [
    'رمز التحقق الخاص بك في نظام جدولة الأشعة المقطعية:',
    'Your CT Scan Scheduling verification code is:',
    '',
    args.code,
    '',
    expiryText,
    'تنبيه أمني: لا تشارك هذا الرمز مع أي شخص / Do not share this code with anyone.',
  ].join('\n');

  const html = renderBrandedEmailTemplate({
    badgeTitleAr: 'نظام جدولة الأشعة',
    badgeTitleEn: 'CT Scan System',
    headlineAr: 'تأكيد الحساب ورمز التحقق',
    headlineEn: 'Account Verification Code',
    subheadAr: 'مرحباً بك، استخدم رمز التحقق التالي لإتمام تسجيل حسابك في نظام جدولة الأشعة المقطعية:',
    subheadEn: 'Welcome! Please use the following verification code to complete your account registration:',
    code: args.code,
    expiryMinutes: args.expiryMinutes,
  });

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
    ? 'إعداد كلمة المرور للحساب | Set up your account password'
    : 'إعادة تعيين كلمة المرور | Reset your password';
  const introAr = isSetup
    ? 'استخدم رمز التحقق التالي لإكمال إعداد كلمة المرور لحسابك في نظام جدولة الأشعة المقطعية:'
    : 'تم استلام طلب لإعادة تعيين كلمة المرور الخاصة بحسابك. استخدم الرمز التالي للمتابعة:';
  const introEn = isSetup
    ? 'Use this verification code to finish setting up your CT Scan Scheduling account password:'
    : 'A password reset was requested for your account. Use this verification code to continue:';
  const actionTextAr = isSetup ? 'إعداد كلمة المرور' : 'إعادة تعيين كلمة المرور';
  const actionTextEn = isSetup ? 'Set Up Password' : 'Reset Password';

  const expiryText = args.expiryMinutes === 1
    ? 'صلاحية الرمز: دقيقة واحدة / Expires in 1 minute.'
    : `صلاحية الرمز: ${args.expiryMinutes} دقائق / Expires in ${args.expiryMinutes} minutes.`;

  const text = [
    introAr,
    introEn,
    '',
    args.code,
    '',
    expiryText,
    'تنبيه أمني: لا تشارك هذا الرمز مع أي شخص / Do not share this code with anyone.',
    '',
    `${actionTextAr} / ${actionTextEn}:`,
    recoveryUrl.toString(),
  ].join('\n');

  const html = renderBrandedEmailTemplate({
    badgeTitleAr: 'نظام جدولة الأشعة',
    badgeTitleEn: 'CT Scan System',
    headlineAr: isSetup ? 'إعداد كلمة المرور الجديدة' : 'إعادة تعيين كلمة المرور',
    headlineEn: isSetup ? 'Set Up Your Password' : 'Reset Your Password',
    subheadAr: introAr,
    subheadEn: introEn,
    code: args.code,
    expiryMinutes: args.expiryMinutes,
    actionUrl: recoveryUrl.toString(),
    actionTextAr,
    actionTextEn,
  });

  await sendEmail({
    to: args.to,
    subject,
    text,
    html,
  });
}
