import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldX } from 'lucide-react';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

export default function ForbiddenPage() {
  const { t } = useTranslation(['auth']);

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher variant="popover" />
      </div>
      <div className="text-center">
        <div className="inline-flex p-4 bg-danger-50 rounded-full mb-4">
          <ShieldX className="w-12 h-12 text-danger" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">403</h1>
        <h2 className="text-xl font-semibold text-text-primary mb-2">{t('auth:forbidden.title')}</h2>
        <p className="text-text-secondary mb-6">{t('auth:forbidden.message')}</p>
        <Link to="/">
          <Button>{t('auth:forbidden.backHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
