import { useState, useMemo } from 'react';
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
import { mockLogin } from '@/mocks/mockData';
import AuthSplitLayout, {
  AUTH_FORM_COLUMN_CLASS,
  AUTH_HERO_COLUMN_CLASS,
  AUTH_MAIN_COLUMN_CLASS,
} from './AuthSplitLayout';

type LoginForm = { identifier: string; password: string };

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'forms', 'common']);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const loginSchema = useMemo(() => z.object({
    identifier: z.string().min(1, t('auth:login.identifierRequired')),
    password: z.string().min(1, t('forms:validation.passwordRequired')),
  }), [t]);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const handleFillDemo = (identifier: string) => {
    setValue('identifier', identifier, { shouldValidate: true });
    setValue('password', '123456', { shouldValidate: true });
    setError('');
  };

  const onSubmit = async (data: LoginForm) => {
    setError('');
    await new Promise((r) => setTimeout(r, 800));

    const result = mockLogin(data.identifier, data.password);
    if (!result) {
      setError(t('auth:login.invalidCredentials'));
      return;
    }

    login(result.user, result.token);
    navigate(result.user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
  };

  return (
    <AuthSplitLayout>
      <aside className={AUTH_HERO_COLUMN_CLASS}>
        <div className="absolute inset-0 z-0">
          <img
            src="/saudi-hospital.webp"
            alt={t('common:hospital.imageAlt')}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-cover object-center transform scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06131b]/95 via-[#083d48]/88 to-[#0b7285]/76 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle={t('common:hospital.healthAffairs')} />
          <div className="mt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20 mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
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
                dir="ltr"
                error={errors.identifier?.message}
                {...register('identifier')}
              />

              <div className="relative">
                <Input
                  label={t('auth:login.password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  dir="ltr"
                  className="!pe-10"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-1.5 top-[29px] inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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

              <Button type="submit" className="w-full py-2" loading={isSubmitting}>
                {t('auth:login.submit')}
              </Button>
            </form>

            <div className="mt-3 border-t border-border pt-2.5">
              <p className="mb-1.5 text-center text-[11px] font-semibold text-text-secondary">{t('auth:login.demoAccounts')}</p>
              <div className="flex flex-col gap-2 text-[11px]">
                {/* Admin demo */}
                <button
                  type="button"
                  onClick={() => handleFillDemo('EMP-001')}
                  className="rounded-lg border border-border bg-surface-muted/80 p-2 flex items-center justify-between w-full text-start hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-primary">{t('common:role.admin')}</span>
                    <span className="text-[10px] text-text-secondary ms-1.5 font-mono" dir="ltr">EMP-001</span>
                  </div>
                  <span className="text-text-secondary font-mono text-[10px] bg-background px-2 py-0.5 rounded border border-border font-semibold" dir="ltr">123456</span>
                </button>
                {/* Employee demo */}
                <button
                  type="button"
                  onClick={() => handleFillDemo('EMP-002')}
                  className="rounded-lg border border-border bg-surface-muted/80 p-2 flex items-center justify-between w-full text-start hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-primary">{t('common:role.employee')}</span>
                    <span className="text-[10px] text-text-secondary ms-1.5 font-mono" dir="ltr">EMP-002</span>
                  </div>
                  <span className="text-text-secondary font-mono text-[10px] bg-background px-2 py-0.5 rounded border border-border font-semibold" dir="ltr">123456</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 w-full text-center px-4">
          <p className="text-[11px] leading-relaxed text-text-secondary/70 font-medium">
            Created by Eshraq Alruhaimi<br />
            Technical Development by Abdallah Mahmoud
          </p>
        </div>
      </main>
    </AuthSplitLayout>
  );
}
