import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserCheck, ArrowRight } from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

const registerSchema = z.object({
  name: z.string().min(3, 'الاسم الكامل يجب أن يكون 3 أحرف على الأقل'),
  email: z.string().email('يرجى إدخال بريد إلكتروني صحيح').refine(val => val.includes('@'), 'يجب استخدام بريد إلكتروني صالح'),
  employeeNumber: z.string().min(4, 'الرقم الوظيفي مطلوب (4 أرقام على الأقل)'),
  phone: z.string().min(9, 'رقم الجوال يجب أن يكون 9 أرقام على الأقل'),
  position: z.string().min(2, 'يرجى تحديد المسمى الوظيفي'),
  department: z.string().min(1, 'يرجى اختيار القسم'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل'),
  confirmPassword: z.string().min(1, 'يرجى تأكيد كلمة المرور'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      department: 'dept-ct',
      position: 'فني أشعة مقطعية',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    await new Promise((r) => setTimeout(r, 1000));
    setSuccessMsg(true);

    // محاكاة إنشاء الحساب وتسجيل الدخول المباشر
    setTimeout(() => {
      login(
        {
          id: `emp-${Date.now().toString().slice(-4)}`,
          name: data.name,
          email: data.email,
          role: 'employee',
          departmentId: data.department,
          departmentName: 'قسم الأشعة المقطعية',
        },
        'mock-jwt-token-new-user'
      );
      navigate('/schedule/me');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_460px] overflow-hidden">
      {/* القسم الأزرق الجانبي مع صورة المستشفى الواقعية */}
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
            <h1 className="mt-1 max-w-sm text-2xl font-bold leading-snug text-white drop-shadow-sm">بوابة انضمام الموظفين</h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-primary-100 font-light">
              إنشاء حساب جديد لممارسي وموظفي قسم الأشعة المقطعية للوصول الفوري لجدول المناوبات والتكليفات الرسمية.
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-xl">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <UserCheck className="h-4 w-4 text-accent" />
            توثيق الحساب الوظيفي
          </div>
          <p className="text-[11px] leading-5 text-primary-100/95 font-light">
            يتم ربط رقمك الوظيفي بالهيكل التنظيمي لقسم الأشعة تلقائياً عند التسجيل مع تفعيل الصلاحيات الفورية.
          </p>
        </div>
      </aside>

      {/* قسم نموذج إنشاء الحساب */}
      <main className="flex min-h-screen items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="w-full max-w-[460px] my-auto">
          {/* Header */}
          <div className="mb-3">
            <HospitalLogo size="md" subtitle="قسم الأشعة المقطعية - CT Scan" className="mb-3 lg:hidden" />
            <h1 className="text-xl font-bold text-text-primary">إنشاء حساب جديد</h1>
            <p className="text-xs text-text-secondary">أدخل بياناتك الوظيفية للانضمام لنظام الجدولة</p>
          </div>

          {successMsg ? (
            <div className="card text-center py-6 space-y-3 animate-fadeIn">
              <div className="w-14 h-14 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-1">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">تم إنشاء حسابك بنجاح!</h3>
              <p className="text-xs text-text-secondary max-w-xs mx-auto">
                جاري توجيهك الآن إلى لوحة التحكم الشخصية وجدول المناوبات...
              </p>
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-3" />
            </div>
          ) : (
            <div className="card !p-4 sm:!p-5 shadow-md border border-border/80">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label="الاسم الكامل (ثلاثى)"
                    placeholder="مثال: محمد الشهري"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label="البريد الإلكتروني المؤسسي"
                    type="email"
                    placeholder="name@hospital.sa"
                    dir="ltr"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label="الرقم الوظيفي"
                    placeholder="مثال: 48291"
                    dir="ltr"
                    error={errors.employeeNumber?.message}
                    {...register('employeeNumber')}
                  />
                  <Input
                    label="رقم الجوال"
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">القسم</label>
                    <select
                      className="input-field text-sm w-full"
                      {...register('department')}
                    >
                      <option value="dept-ct">قسم الأشعة المقطعية (CT)</option>
                      <option value="dept-mri">قسم الرنين المغناطيسي (MRI)</option>
                      <option value="dept-er">أشعة الطوارئ (ER Rad)</option>
                    </select>
                    {errors.department && <p className="text-xs text-danger mt-1">{errors.department.message}</p>}
                  </div>

                  <Input
                    label="المسمى الوظيفي"
                    placeholder="مثال: فني أشعة"
                    error={errors.position?.message}
                    {...register('position')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Input
                      label="كلمة المرور"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pr-10"
                      error={errors.password?.message}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-[39px] right-3 text-text-secondary hover:text-text-primary focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label="تأكيد كلمة المرور"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      dir="ltr"
                      className="!pr-10"
                      error={errors.confirmPassword?.message}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute top-[39px] right-3 text-text-secondary hover:text-text-primary focus:outline-none"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <Button type="submit" className="w-full font-bold shadow-md py-2" loading={isSubmitting}>
                    تسجيل الحساب والانضمام
                  </Button>
                </div>
              </form>

              {/* Back to Login Link */}
              <div className="mt-3 border-t border-border pt-2.5 text-center text-xs text-text-secondary">
                <span>لدي حساب وظيفي بالفعل؟ </span>
                <Link to="/login" className="font-bold text-primary hover:underline ms-1 inline-flex items-center gap-1">
                  <span>تسجيل الدخول</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
