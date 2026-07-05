import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

type RegisterFormValues = {
  name: string;
  email: string;
  employeeNumber: string;
  phone: string;
  position: string;
  department: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'forms', 'common']);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const registerSchema = useMemo(() => z.object({
    name: z.string().min(3, t('forms:validation.nameMin')),
    email: z.string().email(t('forms:validation.emailInvalid')).refine(val => val.includes('@'), t('forms:validation.emailDomain')),
    employeeNumber: z.string().min(4, t('forms:validation.employeeNumberMin')),
    phone: z.string().min(9, t('forms:validation.phoneMin')),
    position: z.string().min(2, t('forms:validation.positionMin')),
    department: z.string().min(1, t('forms:validation.departmentRequired')),
    password: z.string().min(6, t('forms:validation.passwordMin')),
    confirmPassword: z.string().min(1, t('forms:validation.confirmPasswordRequired')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('forms:validation.passwordMismatch'),
    path: ['confirmPassword'],
  }), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      department: 'dept-ct',
      position: t('auth:register.defaultPosition'),
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    await new Promise((r) => setTimeout(r, 1000));
    setSuccessMsg(true);

    setTimeout(() => {
      login(
        {
          id: `emp-${Date.now().toString().slice(-4)}`,
          name: data.name,
          email: data.email,
          role: 'employee',
          departmentId: data.department,
          departmentName: t('auth:register.defaultDepartmentName'),
        },
        'mock-jwt-token-new-user'
      );
      navigate('/schedule/me');
    }, 1500);
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
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">{t('auth:register.heroTitle')}</h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-primary-100 font-light">
              {t('auth:register.heroDescription')}
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-xl">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <UserCheck className="h-4 w-4 text-accent" />
            {t('auth:register.verificationTitle')}
          </div>
          <p className="text-[11px] leading-5 text-primary-100/95 font-light">
            {t('auth:register.verificationDescription')}
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="absolute top-4 end-4 z-10">
          <LanguageSwitcher variant="popover" />
        </div>

        <div className="w-full max-w-[460px] my-auto">
          <div className="mb-3">
            <HospitalLogo size="md" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">{t('auth:register.title')}</h1>
            <p className="text-xs text-text-secondary">{t('auth:register.subtitle')}</p>
          </div>

          {successMsg ? (
            <div className="card text-center py-6 space-y-3 animate-fadeIn">
              <div className="w-14 h-14 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-1">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">{t('auth:register.successTitle')}</h3>
              <p className="text-xs text-text-secondary max-w-xs mx-auto">
                {t('auth:register.successMessage')}
              </p>
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-3" />
            </div>
          ) : (
            <div className="card !p-4 sm:!p-5 shadow-md border border-border/80">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label={t('auth:register.fullName')}
                    placeholder={t('auth:register.fullNamePlaceholder')}
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label={t('auth:register.institutionalEmail')}
                    type="email"
                    placeholder="name@hospital.sa"
                    dir="ltr"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label={t('auth:register.employeeNumber')}
                    placeholder={t('auth:register.employeeNumberPlaceholder')}
                    dir="ltr"
                    error={errors.employeeNumber?.message}
                    {...register('employeeNumber')}
                  />
                  <Input
                    label={t('auth:register.mobile')}
                    placeholder={t('auth:register.mobilePlaceholder')}
                    dir="ltr"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">{t('auth:register.department')}</label>
                    <select className="input-field text-sm w-full" {...register('department')}>
                      <option value="dept-ct">{t('auth:register.departments.ct')}</option>
                      <option value="dept-mri">{t('auth:register.departments.mri')}</option>
                      <option value="dept-er">{t('auth:register.departments.er')}</option>
                    </select>
                    {errors.department && <p className="text-xs text-danger mt-1">{errors.department.message}</p>}
                  </div>

                  <Input
                    label={t('auth:register.position')}
                    placeholder={t('auth:register.positionPlaceholder')}
                    error={errors.position?.message}
                    {...register('position')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Input
                      label={t('auth:register.password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pe-10"
                      error={errors.password?.message}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-[39px] end-3 text-text-secondary hover:text-text-primary focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label={t('auth:register.confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pe-10"
                      error={errors.confirmPassword?.message}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute top-[39px] end-3 text-text-secondary hover:text-text-primary focus:outline-none"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <Button type="submit" className="w-full font-bold shadow-md py-2" loading={isSubmitting}>
                    {t('auth:register.submit')}
                  </Button>
                </div>
              </form>

              <div className="mt-3 border-t border-border pt-2.5 text-center text-xs text-text-secondary">
                <span>{t('auth:register.hasAccount')} </span>
                <Link to="/login" className="font-bold text-primary hover:underline ms-1 inline-flex items-center gap-1">
                  <span>{t('auth:register.loginLink')}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
