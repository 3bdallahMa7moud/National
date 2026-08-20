import axios from 'axios';
import { startTransition, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { isAdminOrSuperAdmin } from '@/types';
import api from '@/lib/axios';
import { mapViewerToAuthUser, type ApiViewer } from '@/lib/backendAdapters';
import AuthSplitLayout, {
  AUTH_FORM_COLUMN_CLASS,
  AUTH_HERO_COLUMN_CLASS,
  AUTH_MAIN_COLUMN_CLASS,
} from './AuthSplitLayout';

type LoginForm = { identifier: string; password: string };

export default function LoginPage() {
  const { t, i18n } = useTranslation(['auth', 'forms', 'common']);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof api.get === 'function') {
      void api.get('/health').catch(() => undefined);
    }
  }, []);

  const loginSchema = useMemo(() => z.object({
    identifier: z.string().min(1, t('auth:login.identifierRequired')),
    password: z.string().min(1, t('forms:validation.passwordRequired')),
  }), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    const executeLogin = async (attempt = 0): Promise<void> => {
      try {
        const response = await api.post<{ user: ApiViewer }>('/auth/login', data);
        const authUser = mapViewerToAuthUser(response.data.user, i18n.language === 'ar' ? 'ar' : 'en');
        login(authUser);
        startTransition(() => {
          navigate(isAdminOrSuperAdmin(authUser) ? '/admin/dashboard' : '/employee/dashboard');
        });
        void import('@/lib/authenticatedBackend')
          .then(({ startAuthenticatedBackend }) => startAuthenticatedBackend())
          .catch(() => undefined);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const isTransient = !error.response || status === 502 || status === 503 || status === 504;

          if (isTransient && attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return executeLogin(attempt + 1);
          }

          const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

          if (status === 401 || code === 'INVALID_CREDENTIALS') {
            setError(t('auth:login.invalidCredentials'));
            return;
          }

          if (isTransient || status === 500) {
            setError(t('auth:login.connectionError'));
            return;
          }

          if (code === 'EMAIL_VERIFICATION_REQUIRED') {
            setError(t('auth:login.emailVerificationRequired'));
            return;
          }
        }

        setError(t('auth:login.unexpectedError'));
      }
    };

    await executeLogin();
  };

  return (
    <AuthSplitLayout>
      <aside className={AUTH_HERO_COLUMN_CLASS}>
        <div
          className="auth-login-hero-image absolute inset-0 z-0 bg-cover bg-center"
          role="img"
          aria-label={t('common:hospital.imageAlt')}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#06131b]/95 via-[#083d48]/88 to-[#0b7285]/76 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle={t('common:hospital.healthAffairs')} />
          <div className="mt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20 mb-3 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(34,197,94,0.75)]" />
              <span>{t('auth:login.heroBadge')}</span>
            </div>
            <p className="text-sm font-medium text-white/90 drop-shadow-sm">{t('common:hospital.name')}</p>
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">{t('auth:login.heroTitle')}</h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-white/82 drop-shadow-sm">
              {t('auth:login.heroDescription')}
            </p>

            <div className="mt-5 flex flex-col gap-2.5 max-w-sm">
              <div className="rounded-xl border border-white/20 bg-slate-950/60 p-3 backdrop-blur-md shadow-lg transition-all hover:bg-slate-950/80">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary-400 dark:bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(46,169,184,0.9)] dark:shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                  <div className="text-xs font-bold text-primary-200 dark:text-cyan-300 tracking-wide">
                    {t('auth:login.feature1Title')}
                  </div>
                </div>
                <div className="mt-1 text-[11px] leading-4 text-white/90 ps-4">
                  {t('auth:login.feature1Desc')}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-slate-950/60 p-3 backdrop-blur-md shadow-lg transition-all hover:bg-slate-950/80">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary-400 dark:bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(46,169,184,0.9)] dark:shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                  <div className="text-xs font-bold text-primary-200 dark:text-cyan-300 tracking-wide">
                    {t('auth:login.feature2Title')}
                  </div>
                </div>
                <div className="mt-1 text-[11px] leading-4 text-white/90 ps-4">
                  {t('auth:login.feature2Desc')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-slate-950/60 p-4 backdrop-blur-md shadow-xl">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-primary-300 dark:text-cyan-400" />
            {t('auth:login.secureAccessTitle')}
          </div>
          <p className="text-[11px] leading-5 text-white/90 font-light">
            {t('auth:login.secureAccessDescription')}
          </p>
        </div>
      </aside>

      <main data-testid="auth-main-column" className={AUTH_MAIN_COLUMN_CLASS}>
        <div className="absolute top-4 end-4 z-10 flex items-center gap-2">
          <LanguageSwitcher variant="popover" />
          <ThemeSwitcher variant="icon" />
        </div>

        <div data-testid="auth-form-column" className={AUTH_FORM_COLUMN_CLASS}>
          <div className="mb-3">
            <HospitalLogo size="md" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">{t('auth:login.title')}</h1>
            <p className="text-xs text-text-secondary">{t('auth:login.subtitle')}</p>
          </div>

          <div className="card !p-4 sm:!p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Input
                label={t('auth:login.identifierLabel')}
                type="text"
                placeholder={t('auth:login.identifierPlaceholder')}
                error={errors.identifier?.message}
                {...register('identifier')}
              />

              <div className="relative">
                <Input
                  label={t('auth:login.password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  dir="ltr"
                  className="!pr-12"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-7 inline-flex h-10 w-10 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label={showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors"
                >
                  <KeyRound className="h-3 w-3" />
                  {t('auth:login.forgotPassword', 'Forgot Password?')}
                </button>
              </div>

              {error && (
                <div className="rounded-btn border border-danger/20 bg-danger-50 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full py-2 dark:!bg-primary-800 dark:hover:!bg-primary-700"
                loading={isSubmitting}
              >
                {t('auth:login.submit')}
              </Button>
            </form>

          </div>

          <div className="mt-3 text-center text-[10px] text-text-secondary/60 leading-5">
            <p>Created by Eshraq Alrujaimi</p>
            <p>
              Technical Development by{' '}
              <a
                href="https://wa.me/201006513006"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Abdallah Mahmoud
              </a>
            </p>
          </div>
        </div>

      </main>
    </AuthSplitLayout>
  );
}
