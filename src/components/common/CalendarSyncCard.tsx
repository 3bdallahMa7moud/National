import { useState } from 'react';
import { Copy, Check, Smartphone, Monitor, Apple } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CalendarSyncCardProps {
  icalUrl: string;
}

const tabs = [
  { id: 'google', label: 'Google Calendar', icon: Monitor },
  { id: 'apple', label: 'Apple Calendar', icon: Apple },
  { id: 'outlook', label: 'Outlook', icon: Monitor },
] as const;

const instructions: Record<string, string[]> = {
  google: [
    'افتح Google Calendar على الكمبيوتر',
    'من القائمة الجانبية، انقر على "+" بجوار "تقاويم أخرى"',
    'اختر "من عنوان URL"',
    'الصق رابط المزامنة أدناه',
    'انقر "إضافة تقويم"',
    'سيظهر جدولك خلال دقائق',
  ],
  apple: [
    'افتح تطبيق التقويم على iPhone أو Mac',
    'اذهب إلى الإعدادات > حسابات > إضافة حساب',
    'اختر "أخرى" ثم "اشتراك في تقويم"',
    'الصق رابط المزامنة',
    'اضغط "اشتراك"',
    'سيتم التحديث تلقائياً كل بضع ساعات',
  ],
  outlook: [
    'افتح Outlook على الويب (outlook.com)',
    'اذهب إلى التقويم',
    'انقر "إضافة تقويم" > "الاشتراك من الويب"',
    'الصق رابط المزامنة',
    'أدخل اسماً للتقويم (مثل: "جدول الأشعة")',
    'انقر "استيراد"',
  ],
};

export default function CalendarSyncCard({ icalUrl }: CalendarSyncCardProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('google');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* URL Card */}
      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-2">رابط المزامنة الخاص بك</h3>
        <p className="text-sm text-text-secondary mb-4">
          استخدم هذا الرابط لمزامنة جدولك مع تقويم هاتفك. الجدول سيتحدث تلقائياً عند أي تغيير.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={icalUrl}
            readOnly
            className="input-field flex-1 font-mono text-xs"
            dir="ltr"
          />
          <Button
            variant={copied ? 'primary' : 'secondary'}
            onClick={handleCopy}
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? 'تم النسخ!' : 'نسخ'}
          </Button>
        </div>
        <p className="text-xs text-text-secondary mt-3 flex items-center gap-1">
          <Smartphone className="w-3.5 h-3.5" />
          التحديثات تعتمد على تطبيق التقويم وقد تستغرق من دقائق إلى ساعات
        </p>
      </Card>

      {/* Instructions */}
      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">كيفية الإضافة</h3>
        <div className="flex gap-2 mb-4 border-b border-border pb-3 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <ol className="space-y-3">
          {instructions[activeTab]?.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50 text-primary text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-text-primary pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
