import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex p-4 bg-danger-50 rounded-full mb-4">
          <ShieldX className="w-12 h-12 text-danger" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">403</h1>
        <h2 className="text-xl font-semibold text-text-primary mb-2">غير مصرّح</h2>
        <p className="text-text-secondary mb-6">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
        <Link to="/">
          <Button>العودة للرئيسية</Button>
        </Link>
      </div>
    </div>
  );
}
