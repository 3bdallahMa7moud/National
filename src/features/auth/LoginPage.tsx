import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Scan, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { mockLogin } from '@/mocks/mockData';

const loginSchema = z.object({
  email: z.string().email('يرجى إدخال بريد إلكتروني صحيح'),
  password: z.string().min(1, 'يرجى إدخال كلمة المرور'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800));

    const result = mockLogin(data.email, data.password);
    if (!result) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    login(result.user, result.token);
    navigate(result.user.role === 'admin' ? '/admin/dashboard' : '/schedule/me');
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_460px] overflow-hidden">
      <aside className="relative hidden overflow-hidden border-s border-primary-700 bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-6 lg:py-8">
        {/* الصورة في الخلفية بحجم الجزء الأزرق كامل */}
        <div className="absolute inset-0 z-0">
          <img
            src="/saudi-hospital.png"
            alt="مستشفى الحرس الوطني - مدينة الملك عبدالعزيز الطبية"
            className="h-full w-full object-cover object-center transform scale-105 transition-transform duration-1000"
          />
          {/* غطاء أزرق متدرج (Blue Overlay) بحيث تكون الصورة مدمجة داخل اللون */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/95 via-primary-900/80 to-primary-800/75 backdrop-blur-[1px]" />
        </div>

        {/* المحتوى يظهر بوضوح فوق الخلفية المدمجة */}
        <div className="relative z-10">
          <HospitalLogo size="lg" variant="white" subtitle="الشؤون الصحية بوزارة الحرس الوطني" />
          <div className="mt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20 mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>مدينة الملك عبدالعزيز الطبية - الرياض / جدة</span>
            </div>
            <p className="text-sm font-medium text-primary-100">مستشفى الحرس الوطني</p>
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">نظام جدولة الأشعة المقطعية</h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-primary-100 font-light">
              إدارة النوبات والتكليفات اليومية لقسم الأشعة المقطعية من مكان واحد وبأعلى معايير الحماية والكفاءة التشغيلية.
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-xl">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-accent" />
            دخول آمن للفريق الطبي
          </div>
          <p className="text-[11px] leading-5 text-primary-100/95 font-light">
            يتم عرض الصلاحيات والصفحات حسب دور المستخدم داخل النظام مع التوثيق المباشر لسجل الحضور والمناوبات.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="w-full max-w-[420px] my-auto">
          {/* Header */}
          <div className="mb-3">
            <HospitalLogo size="md" subtitle="قسم الأشعة المقطعية - CT Scan" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">تسجيل الدخول</h1>
            <p className="text-xs text-text-secondary">استخدم حساب المستشفى للوصول إلى نظام الجدولة</p>
          </div>

          {/* Form */}
          <div className="card !p-4 sm:!p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="admin@hospital.sa"
                dir="ltr"
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="relative">
                <Input
                  label="كلمة المرور"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  dir="ltr"
                  className="!pr-10"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-[39px] text-text-secondary transition-colors hover:text-text-primary focus:outline-none"
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
                تسجيل الدخول
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-3 border-t border-border pt-2.5">
              <p className="mb-1.5 text-center text-[11px] font-semibold text-text-secondary">حسابات تجريبية سريعة</p>
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

            {/* Create Account Link */}
            <div className="mt-3 border-t border-border pt-2.5 text-center text-xs text-text-secondary">
              <span>ليس لديك حساب موظف؟ </span>
              <Link to="/register" className="font-bold text-primary hover:underline ms-1">
                إنشاء حساب جديد ←
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
