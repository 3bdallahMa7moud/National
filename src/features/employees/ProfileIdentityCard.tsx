import { useEffect, useState } from 'react';
import {
  Briefcase,
  Building2,
  Hash,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import type { AuthUser } from '@/types';

interface Props {
  user: AuthUser;
  onSaveEmail: (email: string) => Promise<boolean>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function ProfileIdentityCard({ user, onSaveEmail, onChangePassword }: Props) {
  const { t, i18n } = useTranslation('employees');
  const isAr = i18n.language === 'ar';

  const directoryRecord = useEmployeeDirectoryStore((state) =>
    state.records.find((r) => r.accountId === user.id),
  );

  const employeeNumber = directoryRecord?.employeeNumber || user.employeeNumber || '';
  const position = (isAr ? directoryRecord?.position.ar : directoryRecord?.position.en) || user.position || '';
  const code = directoryRecord?.code || user.code || '';
  const phone = directoryRecord?.phone || user.phone || '';
  const departmentName = (isAr ? directoryRecord?.departmentName.ar : directoryRecord?.departmentName.en) || user.departmentName || '';
  const name = (isAr ? directoryRecord?.name.ar : directoryRecord?.name.en) || user.name;
  const currentRole = directoryRecord?.role || user.role;

  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => setEmail(user.email), [user.email]);

  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const roleBadgeVariant = currentRole === 'super_admin' ? 'warning' : currentRole === 'admin' ? 'info' : 'default';
  const roleLabel = currentRole === 'super_admin'
    ? t('profileView.superAdmin', 'Super Admin')
    : currentRole === 'admin'
      ? t('profileView.admin')
      : t('profileView.employee');

  const savePassword = async () => {
    if (newPassword.length < 6 || newPassword !== confirmPassword) {
      setPasswordError(t('profileView.passwordMismatch'));
      return;
    }
    setIsSavingPassword(true);
    const result = await onChangePassword(currentPassword, newPassword);
    setIsSavingPassword(false);
    if (!result.ok) {
      setPasswordError(result.error || t('profileView.currentPasswordInvalid'));
      return;
    }
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  return (
    <>
      <Card className="space-y-6">
        {/* ─── Profile Header ─── */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 text-2xl font-bold text-white shadow-md shadow-primary/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-text-primary sm:text-2xl">{name}</h2>
              <Badge variant="success" className="text-xs">
                {t('profileView.active')}
              </Badge>
              <Badge variant={roleBadgeVariant} className="text-xs font-semibold">
                {roleLabel}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              {position && (
                <span className="font-medium text-text-primary">{position}</span>
              )}
              {position && departmentName && <span className="opacity-40">•</span>}
              {departmentName && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {departmentName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {employeeNumber && (
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1 text-xs font-semibold font-mono text-text-secondary border border-border/60" dir="ltr">
                  <Hash className="h-3 w-3 text-primary" />
                  <span className="text-text-secondary/70">BN:</span> {employeeNumber}
                </span>
              )}
              {code && (
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1 text-xs font-semibold font-mono text-text-secondary border border-border/60" dir="ltr">
                  <Tag className="h-3 w-3 text-primary" />
                  <span className="text-text-secondary/70">{t('profileView.code')}:</span> {code}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Detailed Info Grid ─── */}
        <div className="border-t border-border pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            {t('profileView.personalInfo')}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Employee Number (BN) */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Hash className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.bn')}</p>
                <p className="text-sm font-semibold text-text-primary font-mono" dir="ltr">
                  {employeeNumber || t('profileView.notSet')}
                </p>
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.position')}</p>
                <p className="truncate text-sm font-semibold text-text-primary">
                  {position || t('profileView.notSet')}
                </p>
              </div>
            </div>

            {/* Code */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Tag className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.code')}</p>
                <p className="text-sm font-semibold text-text-primary font-mono" dir="ltr">
                  {code || t('profileView.notSet')}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Phone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.phone')}</p>
                <p className="text-sm font-semibold text-text-primary" dir="ltr">
                  {phone || t('profileView.notSet')}
                </p>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.department')}</p>
                <p className="truncate text-sm font-semibold text-text-primary">
                  {departmentName || t('profileView.notSet')}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3.5 transition-colors hover:bg-surface-muted/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-950/40">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">{t('profileView.email')}</p>
                <p className="truncate text-sm font-semibold text-text-primary" dir="ltr">
                  {email || user.email || t('profileView.notSet')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Security & Action Cards ─── */}
        <div className="border-t border-border pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Email Management Card */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-950/50">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-secondary">{t('profileView.email')}</p>
                  <p className="truncate text-sm font-semibold text-text-primary" dir="ltr">
                    {email || user.email || t('profileView.notSet')}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmailOpen(true)}
                icon={<Pencil className="h-3.5 w-3.5" />}
                className="shrink-0"
              >
                {t('profileView.editEmail')}
              </Button>
            </div>

            {/* Password & Security Card */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-950/50">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{t('profileView.security')}</p>
                  <p className="text-xs text-text-secondary">{t('profileView.passwordProtected')}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordOpen(true)}
                icon={<LockKeyhole className="h-3.5 w-3.5" />}
                className="shrink-0"
              >
                {t('profileView.changePassword')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Modal isOpen={emailOpen} onClose={() => setEmailOpen(false)} title={t('profileView.editEmail')} size="sm">
        <div className="space-y-4">
          <Input
            label={t('profileView.email')}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError('');
            }}
            dir="ltr"
          />
          {emailError && (
            <p role="alert" className="rounded-btn bg-danger/10 px-3 py-2 text-sm text-danger">
              {emailError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>
              {t('profileView.cancel')}
            </Button>
            <Button
              loading={isSavingEmail}
              onClick={async () => {
                setIsSavingEmail(true);
                const ok = await onSaveEmail(email.trim());
                setIsSavingEmail(false);
                if (ok) setEmailOpen(false);
                else setEmailError(t('common:errorState.sectionMessage'));
              }}
              disabled={!email.trim()}
            >
              {t('profileView.saveEmail')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={t('profileView.changePassword')}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={t('profileView.currentPassword')}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            dir="ltr"
          />
          <Input
            label={t('profileView.newPassword')}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            dir="ltr"
          />
          <Input
            label={t('profileView.confirmPassword')}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            dir="ltr"
          />
          {passwordError && (
            <p role="alert" className="rounded-btn bg-danger/10 px-3 py-2 text-sm text-danger">
              {passwordError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPasswordOpen(false)}>
              {t('profileView.cancel')}
            </Button>
            <Button
              loading={isSavingPassword}
              icon={<LockKeyhole className="h-4 w-4" />}
              onClick={() => {
                void savePassword();
              }}
            >
              {t('profileView.savePassword')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
