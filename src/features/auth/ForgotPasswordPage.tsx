// ============================================================
// ForgotPasswordPage — 3-step OTP Password Recovery
// Step 1: Enter email / employee number → request OTP by email
// Step 2: Enter 6-digit OTP with auto-advance and countdown
// Step 3: Set new password with strength indicator → success
// ============================================================

import { isAxiosError } from 'axios';
import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2,
  ArrowLeft, RotateCcw, ShieldCheck, Loader2,
  AlertCircle, ChevronRight, Clock,
} from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import AuthSplitLayout, {
  AUTH_FORM_COLUMN_CLASS,
  AUTH_HERO_COLUMN_CLASS,
  AUTH_MAIN_COLUMN_CLASS,
} from './AuthSplitLayout';

/* ─── Types ─── */
type Step = 1 | 2 | 3 | 'success' | 'no-email';
const RESEND_COOLDOWN_SECONDS = 60; // 1 minute cooldown to resend

/* ─── Password strength helper ─── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { score: 1, label: 'Weak', color: 'bg-red-500' },
    { score: 2, label: 'Fair', color: 'bg-orange-400' },
    { score: 3, label: 'Good', color: 'bg-yellow-400' },
    { score: 4, label: 'Strong', color: 'bg-emerald-500' },
  ];
  return levels[score - 1] ?? { score: 0, label: '', color: '' };
}

/* ─── Main Component ─── */
export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledIdentifier = searchParams.get('identifier')?.trim() ?? '';
  const startsReady = searchParams.get('ready') === '1' && prefilledIdentifier.length > 0;

  /* ─── State ─── */
  const [step, setStep] = useState<Step>(startsReady ? 2 : 1);
  const [identifier, setIdentifier] = useState(prefilledIdentifier);
  const [identifierError, setIdentifierError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [foundEmployeeName, setFoundEmployeeName] = useState('');
  const [foundEmail, setFoundEmail] = useState(prefilledIdentifier.includes('@') ? prefilledIdentifier : '');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(startsReady ? 0 : RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /* ─── OTP input refs ─── */
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpGroupId = `otp-group-${useId()}`;
  const otpErrorId = `${otpGroupId}-error`;

  const readApiErrorMessage = useCallback((error: unknown, fallbackEn: string, fallbackAr: string) => {
    if (isAxiosError(error)) {
      const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return isRtl ? fallbackAr : fallbackEn;
  }, [isRtl]);

  /* ─── Resend Countdown timer ─── */
  useEffect(() => {
    if (step !== 2) return;
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  /* ─── Step 1: Verify email / employee number ─── */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifierError('');
    const val = identifier.trim();
    if (!val) {
      setIdentifierError(isRtl ? 'هذا الحقل مطلوب' : 'This field is required');
      return;
    }
    setIsChecking(true);

    try {
      const response = await api.post<{
        ok: true;
        accountFound?: boolean;
        hasEmail?: boolean;
        maskedEmail?: string | null;
        userId?: string;
        displayName?: { en: string; ar: string };
      }>('/auth/forgot-password/request', { identifier: val });

      if (!response.data.accountFound) {
        setIdentifierError(
          isRtl
            ? 'لم يتم العثور على حساب باسم المستخدم هذا أو البريد الإلكتروني.'
            : 'No account found with this username or email.'
        );
        return;
      }

      if (!response.data.hasEmail) {
        setFoundEmployeeName(isRtl ? response.data.displayName?.ar || '' : response.data.displayName?.en || '');
        setStep('no-email');
        return;
      }

      setFoundEmployeeName(isRtl ? response.data.displayName?.ar || '' : response.data.displayName?.en || '');
      setFoundEmail(response.data.maskedEmail || '');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep(2);
    } catch (error) {
      setIdentifierError(readApiErrorMessage(
        error,
        'Unable to send the verification code right now.',
        'تعذر إرسال كود التحقق حالياً.',
      ));
    } finally {
      setIsChecking(false);
    }
  };

  /* ─── Step 2: Verify OTP ─── */
  const handleOtpChange = (index: number, value: string) => {
    setOtpError('');
    // Handle paste of full OTP
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      const digits = value.split('');
      setOtpDigits(digits);
      otpRefs.current[5]?.focus();
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpDigits.join('');
    if (entered.length < 6) {
      setOtpError(isRtl ? 'الرجاء إدخال الكود المكون من 6 أرقام كاملاً' : 'Please enter the full 6-digit code');
      return;
    }
    try {
      await api.post('/auth/forgot-password/verify', { identifier, code: entered });
      setOtpError('');
      setNewPassword('');
      setConfirmPassword('');
      setPwError('');
      setStep(3);
    } catch {
      setOtpError(isRtl ? 'الكود غير صحيح. يرجى التحقق من بريدك الإلكتروني والمحاولة مجدداً.' : 'Incorrect code. Please check your email and try again.');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const handleResendOtp = useCallback(async () => {
    setIsResending(true);
    try {
      await api.post('/auth/forgot-password/request', { identifier });
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      otpRefs.current[0]?.focus();
    } catch (error) {
      setOtpError(readApiErrorMessage(
        error,
        'Unable to send a new code right now. Please try again shortly.',
        'تعذر إرسال كود جديد حالياً. حاول مرة أخرى بعد قليل.',
      ));
    } finally {
      setIsResending(false);
    }
  }, [identifier, readApiErrorMessage]);

  /* ─── Step 3: Save new password ─── */
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 6) {
      setPwError(isRtl ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/auth/forgot-password/reset', { identifier, code: otpDigits.join(''), password: newPassword });
    } catch {
      setIsSaving(false);
      setPwError(isRtl ? 'تعذر حفظ كلمة المرور الجديدة' : 'Unable to save the new password');
      return;
    }
    setIsSaving(false);
    setStep('success');
  };

  /* ─── Password strength ─── */
  const strength = getPasswordStrength(newPassword);

  /* ─── Format countdown ─── */
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  /* ─── Obfuscate email ─── */
  const maskedEmail = foundEmail
    ? foundEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c)
    : '';

  /* ─── Step indicator data ─── */
  const steps = [
    { num: 1, label: isRtl ? 'البريد' : 'Email' },
    { num: 2, label: 'OTP' },
    { num: 3, label: isRtl ? 'كلمة المرور' : 'Password' },
  ];
  const currentStepNum = step === 'success' ? 3 : (step as number);

  return (
    <AuthSplitLayout>

      {/* ─── Left Hero Panel ─── */}
      <aside className={AUTH_HERO_COLUMN_CLASS}>
        <div className="absolute inset-0 z-0">
          <picture className="block h-full w-full">
            <source
              type="image/webp"
              srcSet="/saudi-hospital-640.webp 640w, /saudi-hospital-1024.webp 1024w"
              sizes="(min-width: 1024px) 55vw, 100vw"
            />
            <img
              src="/saudi-hospital-1024.webp"
              alt={t('common:hospital.imageAlt')}
              width="1024"
              height="1024"
              className="h-full w-full object-cover object-center scale-105"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-[#06131b]/96 via-[#083d48]/90 to-[#0b7285]/78 backdrop-blur-[1px]" />
        </div>
        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle={t('common:hospital.healthAffairs')} />
          <div className="mt-8 max-w-sm space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              <span>{isRtl ? 'استعادة آمنة لكلمة المرور' : 'Secure Password Recovery'}</span>
            </div>
            <h2 className="text-2xl font-bold leading-snug text-white drop-shadow-sm">
              {isRtl ? 'نسيت كلمة المرور؟ لا تقلق!' : 'Forgot your password? No worries!'}
            </h2>
            <p className="text-sm leading-6 text-white/80">
              {isRtl
                ? 'سيتم إرسال كود التحقق OTP إلى بريدك الإلكتروني المسجل لإعادة تعيين كلمة مرورك بأمان.'
                : 'A one-time OTP code will be sent to your registered email to securely reset your password.'}
            </p>

            {/* Security badges */}
            <div className="mt-6 flex flex-col gap-3">
              {[
                { Icon: Clock, text: isRtl ? 'كود OTP صالح لمدة 10 دقائق فقط' : 'OTP valid for 10 minutes only' },
                { Icon: Mail, text: isRtl ? 'يُرسل حصرياً لبريدك المسجل' : 'Sent exclusively to your registered email' },
                { Icon: ShieldCheck, text: isRtl ? 'بياناتك محمية بالكامل' : 'Your data is fully protected' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 backdrop-blur-sm">
                  <item.Icon className="h-4 w-4 text-cyan-300 shrink-0" />
                  <span className="text-xs text-white/85 font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom watermark */}
        <p className="relative z-10 text-[11px] text-white/40">
          © 2025 {t('common:hospital.healthAffairs')}
        </p>
      </aside>

      {/* ─── Right Form Panel ─── */}
      <main data-testid="auth-main-column" className={AUTH_MAIN_COLUMN_CLASS}>
        {/* Top bar */}
        <div className="absolute top-4 end-4 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        <div data-testid="auth-form-column" className={`${AUTH_FORM_COLUMN_CLASS} space-y-6`}>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-primary transition-colors group"
          >
            {isRtl
              ? <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              : <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />}
            {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Login'}
          </button>

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isRtl ? 'استعادة كلمة المرور' : 'Reset Your Password'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {isRtl ? 'اتبع الخطوات أدناه لإعادة تعيين كلمة مرورك' : 'Follow the steps below to reset your password'}
            </p>
          </div>

          {/* Step indicator */}
          {(step === 1 || step === 2 || step === 3) && (
            <div className="flex items-center justify-between gap-1">
              {steps.map((s, i) => {
                const isDone = currentStepNum > s.num;
                const isActive = currentStepNum === s.num;
                return (
                  <div key={s.num} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center flex-1">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all duration-300',
                        isDone ? 'bg-primary border-primary text-white' : '',
                        isActive ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/20' : '',
                        !isDone && !isActive ? 'bg-surface-muted border-border text-text-secondary' : ''
                      )}>
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                      </div>
                      <span className={cn(
                        'mt-1 text-[10px] font-medium',
                        isActive ? 'text-primary' : isDone ? 'text-text-secondary' : 'text-text-secondary/60'
                      )}>
                        {s.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={cn(
                        'h-0.5 flex-1 mx-1 rounded-full transition-all duration-500 mb-4',
                        currentStepNum > s.num ? 'bg-primary' : 'bg-border'
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ STEP 1: Email ═══ */}
          {step === 1 && (
            <div className="card !p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-text-primary">
                    {isRtl ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or Username'}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {isRtl ? 'سنرسل لك كود التحقق' : "We'll send you a verification code"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Input
                    label={isRtl ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or Username'}
                    placeholder={isRtl ? 'البريد الإلكتروني أو اسم المستخدم' : 'Enter email or username'}
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setIdentifierError(''); }}
                    error={identifierError}
                    autoFocus
                  />
                </div>

                {identifierError && (
                  <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-xs text-danger">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{identifierError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" loading={isChecking} icon={<Mail className="h-4 w-4" />}>
                  {isRtl ? 'إرسال كود التحقق' : 'Send Verification Code'}
                </Button>
              </form>
            </div>
          )}

          {/* ═══ STEP 2: OTP ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              {/* OTP Form */}
              <div className="card space-y-5 !px-2.5 !py-5 sm:!p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">
                      {isRtl ? 'أدخل كود التحقق' : 'Enter Verification Code'}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {maskedEmail
                        ? (isRtl ? `أرسلنا الكود إلى ${maskedEmail}` : `Sent to ${maskedEmail}`)
                        : (isRtl ? 'أدخل الكود الذي وصلك عبر البريد الإلكتروني.' : 'Enter the code that was sent to your email.')}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOtpVerify} className="space-y-4">
                  {/* 6-digit boxes */}
                  <fieldset className="m-0 border-0 p-0" aria-describedby={otpError ? otpErrorId : undefined}>
                    <legend id={otpGroupId} className="sr-only">
                      {isRtl ? 'رمز التحقق المكوّن من 6 أرقام' : '6-digit verification code'}
                    </legend>
                    <div className="flex justify-center gap-0.5 sm:gap-2" dir="ltr" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          maxLength={6}
                          value={digit}
                          aria-label={isRtl ? `الرقم ${i + 1} من 6` : `Digit ${i + 1} of 6`}
                          aria-invalid={otpError ? true : undefined}
                          aria-describedby={otpError ? otpErrorId : undefined}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className={cn(
                            'h-12 w-11 rounded-xl border-2 text-center text-lg font-bold font-mono',
                            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                            'bg-surface dark:bg-slate-900 text-text-primary transition-all duration-150',
                            digit ? 'border-primary bg-primary/5' : 'border-border',
                            otpError ? 'border-danger animate-shake' : ''
                          )}
                        />
                      ))}
                    </div>
                  </fieldset>

                  {otpError && (
                    <div id={otpErrorId} role="alert" className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-xs text-danger">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" icon={<ShieldCheck className="h-4 w-4" />}>
                    {isRtl ? 'تحقق من الكود' : 'Verify Code'}
                  </Button>
                </form>

                {/* Resend row */}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-text-secondary">
                    {resendCooldown > 0
                      ? (isRtl ? `يمكنك إعادة الإرسال خلال ${formatTime(resendCooldown)}` : `Resend in ${formatTime(resendCooldown)}`)
                      : (isRtl ? 'لم يصلك الرمز؟' : "Didn't receive code?")}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isResending}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    {isResending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RotateCcw className="h-3 w-3" />}
                    {isRtl ? 'إعادة إرسال' : 'Resend Code'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: New Password ═══ */}
          {step === 3 && (
            <div className="card !p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-text-primary">
                    {isRtl ? 'كلمة المرور الجديدة' : 'Create New Password'}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {isRtl ? `مرحباً ${foundEmployeeName}، اختر كلمة مرور قوية` : `Hi ${foundEmployeeName}, choose a strong password`}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePassword} className="space-y-4">
                {/* New password */}
                <div className="relative">
                  <Input
                    label={isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    dir="ltr"
                    className="!pr-11"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-0 top-[1.75rem] inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary hover:bg-hover hover:text-text-primary"
                    aria-label={showPw ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
                  >
                    {showPw
                      ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                      : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-all duration-300',
                            strength.score >= i ? strength.color : 'bg-border'
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn(
                      'text-[11px] font-medium',
                      strength.color.replace('bg-', 'text-')
                    )}>
                      {isRtl
                        ? { Weak: 'ضعيفة', Fair: 'مقبولة', Good: 'جيدة', Strong: 'قوية' }[strength.label] ?? ''
                        : strength.label}
                    </p>
                  </div>
                )}

                {/* Confirm password */}
                <div className="relative">
                  <Input
                    label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    dir="ltr"
                    className="!pr-11"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-0 top-[1.75rem] inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary hover:bg-hover hover:text-text-primary"
                    aria-label={showConfirm ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
                  >
                    {showConfirm
                      ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                      : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPassword && (
                  <p className={cn('text-xs flex items-center gap-1.5', newPassword === confirmPassword ? 'text-emerald-600' : 'text-danger')}>
                    {newPassword === confirmPassword
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> {isRtl ? 'كلمتا المرور متطابقتان' : 'Passwords match'}</>
                      : <><AlertCircle className="h-3.5 w-3.5" /> {isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}</>}
                  </p>
                )}

                {pwError && (
                  <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-xs text-danger">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{pwError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" loading={isSaving} icon={<Lock className="h-4 w-4" />}>
                  {isRtl ? 'حفظ كلمة المرور الجديدة' : 'Save New Password'}
                </Button>
              </form>
            </div>
          )}

          {/* ═══ SUCCESS ═══ */}
          {step === 'success' && (
            <div className="card !p-8 text-center space-y-5">
              {/* Animated checkmark */}
              <div className="flex justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {isRtl ? 'تم تغيير كلمة المرور بنجاح!' : 'Password Changed Successfully!'}
                </h2>
                <p className="mt-2 text-sm text-text-secondary leading-6">
                  {isRtl
                    ? `مرحباً ${foundEmployeeName}، تمت إعادة تعيين كلمة مرورك بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.`
                    : `Hi ${foundEmployeeName}, your password has been reset successfully. You can now log in with your new password.`}
                </p>
              </div>

              <Button
                className="w-full"
                icon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => navigate('/login')}
              >
                {isRtl ? 'الذهاب لتسجيل الدخول' : 'Go to Login'}
              </Button>
            </div>
          )}

          {/* ═══ STEP: No Email ═══ */}
          {step === 'no-email' && (
            <div className="card !p-6 text-center space-y-5">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertCircle className="h-8 w-8" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {isRtl ? 'لا يوجد بريد إلكتروني مسجل' : 'No Email Registered'}
                </h2>
                <p className="mt-2 text-sm text-text-secondary leading-6">
                  {isRtl
                    ? `مرحباً ${foundEmployeeName || ''}، هذا الحساب غير مرتبط ببريد إلكتروني حالياً. اطلب من مسؤول النظام إضافة بريد إلكتروني أولاً، ثم أعد محاولة استعادة كلمة المرور.`
                    : `Hi ${foundEmployeeName || ''}, this account does not have an email address on file. Ask an administrator to add an email address first, then try password recovery again.`}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  {isRtl ? 'رجوع' : 'Back'}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AuthSplitLayout>
  );
}
