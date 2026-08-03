import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/axios';

type Step = 'register' | 'verify' | 'success';

type SignupDepartment = {
  id: string;
  name: {
    en: string;
    ar: string;
  };
};

type PendingVerificationState = {
  email: string;
  maskedEmail: string;
  resendAvailableAt: number;
};

type SignupRequestResponse = {
  ok: true;
  verificationRequired: true;
  maskedEmail: string;
  expiresInMinutes: number;
  resendCooldownSeconds: number;
  devCode?: string;
  userId: string;
};

type SignupResendResponse = {
  ok: true;
  verificationRequired?: true;
  maskedEmail?: string;
  resendCooldownSeconds?: number;
  devCode?: string;
  resent: boolean;
};

type SignupOptionsResponse = {
  departments: SignupDepartment[];
};

const SIGNUP_PENDING_STATE_KEY = 'signup-pending-verification';
const OTP_DIGIT_COUNT = 6;

function loadPendingVerificationState(): PendingVerificationState | null {
  try {
    const raw = window.sessionStorage.getItem(SIGNUP_PENDING_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingVerificationState>;
    if (
      typeof parsed.email !== 'string'
      || typeof parsed.maskedEmail !== 'string'
      || typeof parsed.resendAvailableAt !== 'number'
    ) {
      return null;
    }
    return {
      email: parsed.email,
      maskedEmail: parsed.maskedEmail,
      resendAvailableAt: parsed.resendAvailableAt,
    };
  } catch {
    return null;
  }
}

function persistPendingVerificationState(state: PendingVerificationState | null) {
  try {
    if (!state) {
      window.sessionStorage.removeItem(SIGNUP_PENDING_STATE_KEY);
      return;
    }
    window.sessionStorage.setItem(SIGNUP_PENDING_STATE_KEY, JSON.stringify(state));
  } catch {
    // The flow still works without persistence in restricted browser contexts.
  }
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function extractApiError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return {
      code: undefined,
      message: undefined,
      retryAfterSeconds: undefined,
    };
  }

  const errorPayload = error.response?.data as {
    error?: {
      code?: string;
      message?: string;
      retryAfterSeconds?: number;
    };
  } | undefined;

  return {
    code: errorPayload?.error?.code,
    message: errorPayload?.error?.message,
    retryAfterSeconds: errorPayload?.error?.retryAfterSeconds,
  };
}

function isSignupDepartment(value: unknown): value is SignupDepartment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const department = value as {
    id?: unknown;
    name?: {
      en?: unknown;
      ar?: unknown;
    };
  };

  return typeof department.id === 'string'
    && typeof department.name?.en === 'string'
    && typeof department.name?.ar === 'string';
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const isRtl = i18n.language === 'ar';
  const storedPending = loadPendingVerificationState();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [step, setStep] = useState<Step>(storedPending ? 'verify' : 'register');
  const [pending, setPending] = useState<PendingVerificationState | null>(storedPending);
  const [departments, setDepartments] = useState<SignupDepartment[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [departmentsError, setDepartmentsError] = useState('');
  const [departmentsLoadAttempt, setDepartmentsLoadAttempt] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_DIGIT_COUNT }, () => ''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    storedPending ? Math.max(0, Math.ceil((storedPending.resendAvailableAt - Date.now()) / 1000)) : 0,
  );

  const registerSchema = useMemo(() => z.object({
    name: z.string().trim().min(3, isRtl ? 'الاسم الكامل يجب أن يكون 3 أحرف على الأقل' : 'Full name must be at least 3 characters'),
    email: z.string().trim().email(isRtl ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address'),
    employeeNumber: z.string().trim().min(4, isRtl ? 'الرقم الوظيفي مطلوب' : 'Employee number is required'),
    phone: z.string().trim().min(9, isRtl ? 'رقم الجوال يجب أن يكون 9 أرقام على الأقل' : 'Mobile number must be at least 9 digits'),
    position: z.string().trim().min(2, isRtl ? 'يرجى تحديد المسمى الوظيفي' : 'Please enter a job title'),
    departmentId: z.string().trim().min(1, isRtl ? 'يرجى اختيار القسم' : 'Please choose a department'),
    password: z.string().min(6, isRtl ? 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل' : 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, isRtl ? 'يرجى تأكيد كلمة المرور' : 'Please confirm your password'),
  }).refine((value) => value.password === value.confirmPassword, {
    message: isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match',
    path: ['confirmPassword'],
  }), [isRtl]);

  type RegisterFormValues = z.infer<typeof registerSchema>;
  type DepartmentFormApi = {
    getValues: (name: 'departmentId') => string;
    setValue: (
      name: 'departmentId',
      value: string,
      options?: {
        shouldValidate?: boolean;
      },
    ) => void;
  };
  const departmentFormApiRef = useRef<DepartmentFormApi | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      departmentId: '',
      position: isRtl ? 'فني أشعة مقطعية' : 'CT Scan Technician',
      email: pending?.email ?? '',
    },
  });

  departmentFormApiRef.current = { getValues, setValue };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadDepartments = async () => {
      setIsLoadingDepartments(true);
      setDepartmentsError('');
      try {
        const response = await api.get<SignupOptionsResponse>('/auth/signup/options', {
          signal: controller.signal,
          timeout: 8_000,
        });
        const responseDepartments = Array.isArray(response.data?.departments)
          ? response.data.departments.filter(isSignupDepartment)
          : [];

        if (!Array.isArray(response.data?.departments) || responseDepartments.length !== response.data.departments.length) {
          throw new Error('Invalid sign-up departments response.');
        }
        if (cancelled) return;
        setDepartments(responseDepartments);
        const currentDepartmentId = departmentFormApiRef.current?.getValues('departmentId');
        if (!currentDepartmentId && responseDepartments[0]) {
          departmentFormApiRef.current?.setValue('departmentId', responseDepartments[0].id, { shouldValidate: true });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
          return;
        }
        if (cancelled) return;
        setDepartments([]);
        setDepartmentsError(
          axios.isAxiosError(error) && error.code === 'ECONNABORTED'
            ? (isRtl
              ? 'انتهت مهلة تحميل الأقسام. تأكد من تشغيل الخادم ثم حاول مرة أخرى.'
              : 'Department loading timed out. Make sure the backend is running and try again.')
            : (isRtl
              ? 'تعذر تحميل الأقسام المتاحة. تأكد من تشغيل الخادم ثم حاول مرة أخرى.'
              : 'Unable to load available departments. Make sure the backend is running and try again.'),
        );
      } finally {
        if (!cancelled) {
          setIsLoadingDepartments(false);
        }
      }
    };

    void loadDepartments();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [departmentsLoadAttempt, isRtl]);

  useEffect(() => {
    if (!pending) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((pending.resendAvailableAt - Date.now()) / 1000)));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [pending]);

  const handleOtpChange = (index: number, value: string) => {
    setVerifyError('');
    setResendMessage('');
    const digits = value.replace(/\D/g, '');

    if (digits.length === OTP_DIGIT_COUNT) {
      setOtpDigits(digits.split(''));
      otpRefs.current[OTP_DIGIT_COUNT - 1]?.focus();
      return;
    }

    if (!/^\d?$/.test(digits)) {
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = digits;
    setOtpDigits(nextDigits);

    if (digits && index < OTP_DIGIT_COUNT - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_DIGIT_COUNT - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_DIGIT_COUNT);
    if (pasted.length !== OTP_DIGIT_COUNT) {
      return;
    }
    setOtpDigits(pasted.split(''));
    otpRefs.current[OTP_DIGIT_COUNT - 1]?.focus();
    event.preventDefault();
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setRequestError('');
    setVerifyError('');
    setResendMessage('');
    setDevCode(null);

    try {
      const response = await api.post<SignupRequestResponse>('/auth/signup/request', {
        name: values.name,
        email: values.email,
        employeeNumber: values.employeeNumber,
        phone: values.phone,
        position: values.position,
        departmentId: values.departmentId,
        password: values.password,
      });

      const nextPendingState: PendingVerificationState = {
        email: values.email.trim().toLowerCase(),
        maskedEmail: response.data.maskedEmail,
        resendAvailableAt: Date.now() + response.data.resendCooldownSeconds * 1000,
      };

      persistPendingVerificationState(nextPendingState);
      setPending(nextPendingState);
      setDevCode(response.data.devCode ?? null);
      setOtpDigits(Array.from({ length: OTP_DIGIT_COUNT }, () => ''));
      setStep('verify');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      const { code, message } = extractApiError(error);

      if (code === 'EMAIL_ALREADY_REGISTERED') {
        setError('email', { message: isRtl ? 'هذا البريد الإلكتروني مسجل بالفعل. استخدم تسجيل الدخول.' : 'This email is already registered. Please sign in instead.' });
        return;
      }

      if (code === 'EMPLOYEE_NUMBER_TAKEN') {
        setError('employeeNumber', { message: isRtl ? 'الرقم الوظيفي مستخدم بالفعل.' : 'Employee number is already in use.' });
        return;
      }

      if (code === 'INVALID_DEPARTMENT') {
        setError('departmentId', { message: isRtl ? 'القسم المحدد غير صالح.' : 'Selected department is invalid.' });
        return;
      }

      setRequestError(
        message
        || (isRtl
          ? 'تعذر إنشاء طلب التسجيل حالياً. حاول مرة أخرى.'
          : 'Unable to create your registration request right now. Please try again.'),
      );
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending) {
      setStep('register');
      return;
    }

    const code = otpDigits.join('');
    if (code.length !== OTP_DIGIT_COUNT) {
      setVerifyError(
        isRtl
          ? 'أدخل رمز التحقق المكون من 6 أرقام بالكامل.'
          : 'Please enter the full 6-digit verification code.',
      );
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    setResendMessage('');

    try {
      await api.post('/auth/signup/verify', {
        email: pending.email,
        code,
      });
      persistPendingVerificationState(null);
      setPending(null);
      setDevCode(null);
      setStep('success');
    } catch (error) {
      const { code } = extractApiError(error);
      if (code === 'SIGNUP_OTP_EXPIRED') {
        setVerifyError(
          isRtl
            ? 'انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً.'
            : 'This verification code has expired. Request a new code.',
        );
      } else if (code === 'SIGNUP_OTP_ATTEMPTS_EXCEEDED') {
        setVerifyError(
          isRtl
            ? 'تم تجاوز الحد الأقصى للمحاولات. اطلب رمزاً جديداً.'
            : 'You reached the maximum number of attempts. Request a new code.',
        );
      } else if (code === 'SIGNUP_OTP_ALREADY_USED') {
        setVerifyError(
          isRtl
            ? 'تم استخدام رمز التحقق هذا من قبل.'
            : 'This verification code was already used.',
        );
      } else {
        setVerifyError(
          isRtl
            ? 'رمز التحقق غير صحيح. تحقق من بريدك الإلكتروني وأعد المحاولة.'
            : 'Incorrect verification code. Check your email and try again.',
        );
      }
      setOtpDigits(Array.from({ length: OTP_DIGIT_COUNT }, () => ''));
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!pending || remainingSeconds > 0) {
      return;
    }

    setIsResending(true);
    setVerifyError('');
    setResendMessage('');

    try {
      const response = await api.post<SignupResendResponse>('/auth/signup/resend', {
        email: pending.email,
      });

      const resendCooldownSeconds = response.data.resendCooldownSeconds ?? 60;
      const nextPendingState: PendingVerificationState = {
        email: pending.email,
        maskedEmail: response.data.maskedEmail ?? pending.maskedEmail,
        resendAvailableAt: Date.now() + resendCooldownSeconds * 1000,
      };

      persistPendingVerificationState(nextPendingState);
      setPending(nextPendingState);
      setDevCode(response.data.devCode ?? null);
      setOtpDigits(Array.from({ length: OTP_DIGIT_COUNT }, () => ''));
      setResendMessage(
        isRtl
          ? 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.'
          : 'A new verification code has been sent to your email.',
      );
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      const { code, message, retryAfterSeconds } = extractApiError(error);
      if (code === 'SIGNUP_OTP_RESEND_COOLDOWN' && retryAfterSeconds) {
        const nextPendingState: PendingVerificationState = {
          ...pending,
          resendAvailableAt: Date.now() + retryAfterSeconds * 1000,
        };
        persistPendingVerificationState(nextPendingState);
        setPending(nextPendingState);
        setVerifyError(
          isRtl
            ? `يرجى الانتظار ${retryAfterSeconds} ثانية قبل إعادة الإرسال.`
            : `Please wait ${retryAfterSeconds} seconds before resending.`,
        );
      } else {
        setVerifyError(
          message
          || (isRtl
            ? 'تعذر إعادة إرسال الرمز حالياً. حاول مرة أخرى.'
            : 'Unable to resend the verification code right now. Please try again.'),
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const restartSignup = () => {
    persistPendingVerificationState(null);
    setPending(null);
    setOtpDigits(Array.from({ length: OTP_DIGIT_COUNT }, () => ''));
    setVerifyError('');
    setResendMessage('');
    setDevCode(null);
    setStep('register');
  };

  const currentDepartmentName = (department: SignupDepartment) => (
    isRtl ? department.name.ar : department.name.en
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
      <aside className="relative hidden overflow-hidden border-s border-primary-700 bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-6 lg:py-8">
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
              className="h-full w-full scale-105 object-cover object-center transition-transform duration-1000"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/95 via-primary-900/80 to-primary-800/75 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle={t('common:hospital.healthAffairs')} />
          <div className="mt-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
              <span>{t('common:hospital.location')}</span>
            </div>
            <p className="text-sm font-medium text-primary-100">{t('common:hospital.name')}</p>
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">
              {isRtl ? 'بوابة انضمام الموظفين' : 'Employee Onboarding Portal'}
            </h1>
            <p className="mt-2 max-w-sm text-xs font-light leading-5 text-primary-100">
              {isRtl
                ? 'أنشئ حسابك الوظيفي ثم فعّل بريدك الإلكتروني عبر رمز OTP للوصول إلى الجدول والمناوبات.'
                : 'Create your employee account, then verify your email with a one-time code to unlock scheduling access.'}
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur-md">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <UserCheck className="h-4 w-4 text-accent" />
            {isRtl ? 'توثيق الحساب الوظيفي' : 'Employment account verification'}
          </div>
          <p className="text-[11px] font-light leading-5 text-primary-100/95">
            {isRtl
              ? 'سيتم إرسال رمز تحقق مكون من 6 أرقام إلى بريدك المؤسسي، ولا يصبح الحساب نشطاً إلا بعد التحقق.'
              : 'A 6-digit code is sent to your institutional email, and the account stays inactive until verification succeeds.'}
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-6">
        <div className="my-auto w-full max-w-[460px]">
          <div className="mb-3">
            <HospitalLogo size="md" subtitle="قسم الأشعة المقطعية - CT Scan" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">
              {step === 'verify'
                ? (isRtl ? 'تحقق من بريدك الإلكتروني' : 'Verify your email')
                : step === 'success'
                  ? (isRtl ? 'تم تفعيل الحساب' : 'Account verified')
                  : (isRtl ? 'إنشاء حساب جديد' : 'Create new account')}
            </h1>
            <p className="text-xs text-text-secondary">
              {step === 'verify'
                ? (isRtl ? 'أدخل رمز التحقق المرسل إلى بريدك المؤسسي' : 'Enter the verification code sent to your institutional email')
                : step === 'success'
                  ? (isRtl ? 'يمكنك الآن تسجيل الدخول بكلمة المرور التي أنشأتها' : 'You can now sign in with the password you created')
                  : (isRtl ? 'أدخل بياناتك الوظيفية للانضمام لنظام الجدولة' : 'Enter your employment details to join the scheduling system')}
            </p>
          </div>

          {step === 'register' && (
            <div className="card border border-border/80 !p-4 shadow-md sm:!p-5">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Input
                    label={isRtl ? 'الاسم الكامل (ثلاثي)' : 'Full name'}
                    placeholder={isRtl ? 'مثال: محمد الشهري' : 'e.g. Mohammed Al-Shehri'}
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label={isRtl ? 'البريد الإلكتروني المؤسسي' : 'Institutional email'}
                    type="email"
                    placeholder="name@hospital.sa"
                    dir="ltr"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Input
                    label={isRtl ? 'الرقم الوظيفي' : 'Employee number'}
                    placeholder={isRtl ? 'مثال: 48291' : 'e.g. 48291'}
                    dir="ltr"
                    error={errors.employeeNumber?.message}
                    {...register('employeeNumber')}
                  />
                  <Input
                    label={isRtl ? 'رقم الجوال' : 'Mobile number'}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-department" className="mb-1.5 block text-sm font-medium text-text-primary">
                      {isRtl ? 'القسم' : 'Department'}
                    </label>
                    <select
                      id="signup-department"
                      className="input-field w-full text-sm"
                      disabled={isLoadingDepartments || departments.length === 0}
                      {...register('departmentId')}
                    >
                      <option value="">
                        {isLoadingDepartments
                          ? (isRtl ? 'جاري تحميل الأقسام...' : 'Loading departments...')
                          : departments.length === 0
                            ? (isRtl ? 'لا توجد أقسام متاحة' : 'No departments available')
                          : (isRtl ? 'اختر القسم' : 'Select department')}
                      </option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {currentDepartmentName(department)}
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && <p className="mt-1 text-xs text-danger">{errors.departmentId.message}</p>}
                    {departmentsError && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-danger" role="alert">{departmentsError}</p>
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => setDepartmentsLoadAttempt((attempt) => attempt + 1)}
                        >
                          {isRtl ? 'إعادة المحاولة' : 'Retry'}
                        </button>
                      </div>
                    )}
                    {!isLoadingDepartments && !departmentsError && departments.length === 0 && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {isRtl ? 'لا توجد أقسام متاحة حالياً.' : 'No departments available.'}
                      </p>
                    )}
                  </div>

                  <Input
                    label={isRtl ? 'المسمى الوظيفي' : 'Job title'}
                    placeholder={isRtl ? 'مثال: فني أشعة' : 'e.g. Radiology Technologist'}
                    error={errors.position?.message}
                    {...register('position')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="relative">
                    <Input
                      label={isRtl ? 'كلمة المرور' : 'Password'}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pr-10"
                      error={errors.password?.message}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute end-1.5 top-[30px] inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary hover:bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={showPassword ? (isRtl ? 'إخفاء كلمة المرور' : 'Hide password') : (isRtl ? 'إظهار كلمة المرور' : 'Show password')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pr-10"
                      error={errors.confirmPassword?.message}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute end-1.5 top-[30px] inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary hover:bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={showConfirmPassword ? (isRtl ? 'إخفاء كلمة المرور' : 'Hide password') : (isRtl ? 'إظهار كلمة المرور' : 'Show password')}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {requestError && (
                  <div role="alert" className="rounded-btn border border-danger/20 bg-danger-50 px-3 py-2 text-xs text-danger">
                    {requestError}
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    type="submit"
                    className="w-full py-2 font-bold shadow-md"
                    loading={isSubmitting}
                    disabled={isLoadingDepartments || departments.length === 0}
                  >
                    {isRtl ? 'إرسال رمز التحقق' : 'Create account & send code'}
                  </Button>
                </div>
              </form>

              <div className="mt-3 border-t border-border pt-2.5 text-center text-xs text-text-secondary">
                <span>{isRtl ? 'لدي حساب وظيفي بالفعل؟' : 'Already have an employee account?'}</span>
                <Link to="/login" className="ms-1 inline-flex items-center gap-1 font-bold text-primary hover:underline">
                  <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
                  <ArrowRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                </Link>
              </div>
            </div>
          )}

          {step === 'verify' && pending && (
            <div className="card border border-border/80 !p-4 shadow-md sm:!p-5">
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-text-secondary">
                  <p className="font-semibold text-text-primary">
                    {isRtl ? `أرسلنا الرمز إلى ${pending.maskedEmail}` : `We sent the code to ${pending.maskedEmail}`}
                  </p>
                  <p className="mt-1" dir="ltr">{pending.email}</p>
                </div>

                {devCode && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-semibold">
                      {isRtl ? 'رمز التطوير الحالي' : 'Current development code'}
                    </p>
                    <p className="mt-1 font-mono text-base tracking-[0.35em]">{devCode}</p>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="flex justify-center gap-1.5 sm:gap-2" dir="ltr" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          otpRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={OTP_DIGIT_COUNT}
                        value={digit}
                        aria-label={isRtl ? `الرقم ${index + 1} من 6` : `Digit ${index + 1} of 6`}
                        onChange={(event) => handleOtpChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        className={`h-12 w-11 rounded-xl border-2 text-center font-mono text-lg font-bold transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                          verifyError ? 'border-danger' : digit ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      />
                    ))}
                  </div>

                  {verifyError && (
                    <div role="alert" className="rounded-btn border border-danger/20 bg-danger-50 px-3 py-2 text-xs text-danger">
                      {verifyError}
                    </div>
                  )}

                  {resendMessage && (
                    <div role="status" className="rounded-btn border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
                      {resendMessage}
                    </div>
                  )}

                  <Button type="submit" className="w-full py-2 font-bold shadow-md" loading={isVerifying}>
                    {isRtl ? 'تأكيد الرمز وتفعيل الحساب' : 'Verify code & activate account'}
                  </Button>
                </form>

                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className={remainingSeconds > 0 ? 'text-text-secondary' : 'text-warning'}>
                    {remainingSeconds > 0
                      ? (isRtl ? `إعادة الإرسال خلال ${formatCountdown(remainingSeconds)}` : `Resend available in ${formatCountdown(remainingSeconds)}`)
                      : (isRtl ? 'يمكنك طلب رمز جديد الآن' : 'You can request a new code now')}
                  </span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={remainingSeconds > 0 || isResending}
                    className="inline-flex items-center gap-1.5 font-medium text-primary transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {isResending ? (isRtl ? 'جارٍ الإرسال...' : 'Sending...') : (isRtl ? 'إعادة الإرسال' : 'Resend code')}
                  </button>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={restartSignup}
                    className="font-medium text-text-secondary hover:text-primary"
                  >
                    {isRtl ? 'استخدام بيانات تسجيل مختلفة' : 'Use different registration details'}
                  </button>
                  <Link to="/login" className="font-bold text-primary hover:underline">
                    {isRtl ? 'العودة إلى تسجيل الدخول' : 'Back to login'}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="card animate-fadeIn space-y-4 py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                {isRtl ? 'تم تفعيل بريدك الإلكتروني بنجاح' : 'Your email has been verified'}
              </h3>
              <p className="mx-auto max-w-xs text-xs text-text-secondary">
                {isRtl
                  ? 'أصبح حسابك نشطاً الآن ويمكنك تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.'
                  : 'Your account is now active. Sign in with your email and password to continue.'}
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button className="w-full">
                    {isRtl ? 'الذهاب إلى تسجيل الدخول' : 'Go to Sign In'}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
