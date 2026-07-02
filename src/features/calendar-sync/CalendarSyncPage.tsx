import CalendarSyncCard from '@/components/common/CalendarSyncCard';
import { useAuthStore } from '@/stores/authStore';
import { RefreshCw, ShieldCheck } from 'lucide-react';

export default function CalendarSyncPage() {
  const user = useAuthStore((s) => s.user);

  // Generate unique mock iCal URL based on user ID
  const icalUrl = `https://hospital.sa/api/v1/schedule/sync/ical/${user?.id || 'emp-001'}/ct-department.ics`;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-primary-50 text-primary">
            <RefreshCw className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">مزامنة التقويم (Calendar Sync)</h1>
        </div>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          اربط جدول شيفتات قسم الأشعة المقطعية مباشرة مع تطبيق التقويم في هاتفك أو جهازك الشخصي
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-card border border-primary/20 bg-primary-50/70 p-4">
        <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs text-text-primary space-y-1">
          <p className="font-bold">مزامنة آمنة ومشفرة</p>
          <p className="text-text-secondary leading-relaxed">
            هذا الرابط خاص بحسابك فقط يحتوي على رمز أمان فريد. عند حدوث أي تعديل في الجدول أو تكليفك بنوبة طوارئ (On-Call)، سيقوم تطبيق التقويم لديك بتحديث المواعيد تلقائياً دون الحاجة للدخول إلى النظام.
          </p>
        </div>
      </div>

      <CalendarSyncCard icalUrl={icalUrl} />
    </div>
  );
}
