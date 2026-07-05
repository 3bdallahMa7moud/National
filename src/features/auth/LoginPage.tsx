import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { mockLogin } from '@/mocks/mockData';

type LoginForm = { email: string; password: string };

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'forms', 'common']);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t('forms:validation.emailRequired')),
    password: z.string().min(1, t('forms:validation.passwordRequired')),
  }), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    await new Promise((r) => setTimeout(r, 800));

    const result = mockLogin(data.email, data.password);
    if (!result) {
      setError(t('auth:login.invalidCredentials'));
      return;
    }

    login(result.user, result.token);
    navigate(result.user.role === 'admin' ? '/admin/dashboard' : '/schedule/me');
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_460px] overflow-hidden">
      <aside className="relative hidden overflow-hidden border-s border-primary-700 bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-6 lg:py-8">
        <div className="absolute inset-0 z-0">
          <img
            src="/saudi-hospital.png"
            alt={t('common:hospital.imageAlt')}
            className="h-full w-full object-cover object-center transform scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/95 via-primary-900/80 to-primary-800/75 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle={t('common:hospital.healthAffairs')} />
          <div className="mt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20 mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>{t('common:hospital.location')}</span>
            </div>
            <p className="text-sm font-medium text-primary-100">{t('common:hospital.name')}</p>
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">{t('auth:login.heroTitle')}</h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-primary-100 font-light">
              {t('auth:login.heroDescription')}
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-xl">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-accent" />
            {t('auth:login.secureAccessTitle')}
          </div>
          <p className="text-[11px] leading-5 text-primary-100/95 font-light">
            {t('auth:login.secureAccessDescription')}
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="absolute top-4 end-4 z-10">
          <LanguageSwitcher variant="popover" />
        </div>

        <div className="w-full max-w-[420px] my-auto">
          <div className="mb-3">
            <HospitalLogo size="md" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">{t('auth:login.title')}</h1>
            <p className="text-xs text-text-secondary">{t('auth:login.subtitle')}</p>
          </div>

          <div className="card !p-4 sm:!p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Input
                label={t('auth:login.email')}
                type="email"
                placeholder="admin@hospital.sa"
                dir="ltr"
                error={errors.email?.message}
                {...register('email')}
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
                  className="absolute end-3.5 top-[39px] text-text-secondary transition-colors hover:text-text-primary focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-border bg-gray-50/80 p-1.5 flex flex-col items-center">
                  <span className="font-bold text-primary"> admin@hospital.sa</span>
                  <span className="text-text-secondary font-mono text-[10px]" dir="ltr">123456</span>
                </div>
                <div className="rounded-lg border border-border bg-gray-50/80 p-1.5 flex flex-col items-center">
                  <span className="font-bold text-primary"> employee@hospital.sa</span>
                  <span className="text-text-secondary font-mono text-[10px]" dir="ltr">123456</span>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-border pt-2.5 text-center text-xs text-text-secondary">
              <span>{t('auth:login.noAccount')} </span>
              <Link to="/register" className="font-bold text-primary hover:underline ms-1">
                {t('auth:login.createAccount')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
