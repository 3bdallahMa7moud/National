import { useEffect, useState } from 'react';
import { Building2, LockKeyhole, Mail, Pencil, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { AuthUser } from '@/types';

interface Props {
  user: AuthUser;
  onSaveEmail: (email: string) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => boolean;
}

export default function ProfileIdentityCard({ user, onSaveEmail, onChangePassword }: Props) {
  const { t } = useTranslation('employees');
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  useEffect(() => setEmail(user.email), [user.email]);
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const savePassword = () => {
    if (newPassword.length < 6 || newPassword !== confirmPassword) { setPasswordError(t('profileView.passwordMismatch')); return; }
    if (!onChangePassword(currentPassword, newPassword)) { setPasswordError(t('profileView.currentPasswordInvalid')); return; }
    setPasswordOpen(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError('');
  };

  return <><Card><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">{initials}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-text-primary">{user.name}</h2><Badge variant="success">{t('profileView.active')}</Badge><Badge variant={user.role === 'admin' ? 'info' : 'default'}>{user.role === 'admin' ? t('profileView.admin') : t('profileView.employee')}</Badge></div><div className="mt-3 grid grid-cols-1 gap-2 text-sm text-text-secondary sm:grid-cols-2"><p className="flex items-center gap-2"><Building2 className="h-4 w-4" aria-hidden="true" />{user.departmentName}</p><p className="flex items-center gap-2" dir="ltr"><Mail className="h-4 w-4" aria-hidden="true" />{user.email || t('profileView.notSet')}</p></div></div></div><div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-btn bg-background p-4"><span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary"><UserRound className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-xs text-text-secondary">{t('profileView.email')}</p><p className="truncate text-sm font-medium text-text-primary" dir="ltr">{user.email || t('profileView.notSet')}</p></div><button type="button" aria-label={t('profileView.editEmail')} onClick={() => setEmailOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-btn text-primary hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30"><Pencil className="h-4 w-4" aria-hidden="true" /></button></div><div className="flex items-center gap-3 rounded-btn bg-background p-4"><span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{t('profileView.security')}</p><p className="text-xs text-text-secondary">{t('profileView.passwordProtected')}</p></div><Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>{t('profileView.changePassword')}</Button></div></div></Card><Modal isOpen={emailOpen} onClose={() => setEmailOpen(false)} title={t('profileView.editEmail')} size="sm"><div className="space-y-4"><Input label={t('profileView.email')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} dir="ltr" /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEmailOpen(false)}>{t('profileView.cancel')}</Button><Button onClick={() => { onSaveEmail(email.trim()); setEmailOpen(false); }} disabled={!email.trim()}>{t('profileView.saveEmail')}</Button></div></div></Modal><Modal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} title={t('profileView.changePassword')} size="sm"><div className="space-y-4"><Input label={t('profileView.currentPassword')} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /><Input label={t('profileView.newPassword')} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><Input label={t('profileView.confirmPassword')} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />{passwordError && <p role="alert" className="rounded-btn bg-danger/10 px-3 py-2 text-sm text-danger">{passwordError}</p>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPasswordOpen(false)}>{t('profileView.cancel')}</Button><Button icon={<LockKeyhole className="h-4 w-4" />} onClick={savePassword}>{t('profileView.savePassword')}</Button></div></div></Modal></>;
}
