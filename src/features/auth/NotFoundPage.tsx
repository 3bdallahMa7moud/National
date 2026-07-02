import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex p-4 bg-warning-50 rounded-full mb-4">
          <FileQuestion className="w-12 h-12 text-warning" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
        <h2 className="text-xl font-semibold text-text-primary mb-2">الصفحة غير موجودة</h2>
        <p className="text-text-secondary mb-6">الصفحة التي تبحث عنها غير متوفرة</p>
        <Link to="/">
          <Button>العودة للرئيسية</Button>
        </Link>
      </div>
    </div>
  );
}
