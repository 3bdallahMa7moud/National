import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

export default function NotFoundPage() {
  const { t } = useTranslation(['auth']);

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher variant="popover" />
      </div>
      <div className="text-center">
        <div className="inline-flex p-4 bg-warning-50 rounded-full mb-4">
          <FileQuestion className="w-12 h-12 text-warning" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
        <h2 className="text-xl font-semibold text-text-primary mb-2">{t('auth:notFound.title')}</h2>
        <p className="text-text-secondary mb-6">{t('auth:notFound.message')}</p>
        <Link to="/">
          <Button>{t('auth:notFound.backHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
