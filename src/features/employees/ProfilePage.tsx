import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useToast } from '@/components/ui/Toast';
import { mockEmployeesSource } from '@/mocks/sources';
import { useMockData } from '@/hooks/useMockData';
import {
  User, Mail, Phone, Building2, Hash, Calendar, Pencil, Shield,
  Lock, Eye, EyeOff, Clock, TrendingUp, Sun, Moon, Sunset,
  PhoneCall, Timer, Palmtree, Stethoscope, GraduationCap,
  ChevronLeft, CalendarCheck, Camera,
} from 'lucide-react';
import { getShiftLabel } from '@/i18n/helpers';
import { useLanguage } from '@/hooks/useLanguage';

/* ─── Shift icon/color helpers ─── */
const shiftMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  morning:  { icon: Sun,           color: '#22C55E', bg: 'rgba(34,197,94,0.10)' },
  evening:  { icon: Sunset,        color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  night:    { icon: Moon,          color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  oncall:   { icon: PhoneCall,     color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  overtime: { icon: Timer,         color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  vacation: { icon: Palmtree,      color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
  sick:     { icon: Stethoscope,   color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
  training: { icon: GraduationCap, color: '#06B6D4', bg: 'rgba(6,182,212,0.10)' },
};

export default function ProfilePage() {
  const { t } = useTranslation(['employees', 'common', 'forms']);
  const { dateLocale } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const shifts = useScheduleStore((s) => s.shifts);
  const { addToast } = useToast();

  const { employees, shiftTypes } = useMockData();
  const employee = employees.find((e) => e.id === user?.id);

  /* ─── Modals state ─── */
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  /* ─── Edit profile form ─── */
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | undefined>('');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /* ─── Password form ─── */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState('');

  /* ─── Shift computations ─── */
  const myShifts = useMemo(
    () => (user ? shifts.filter((s) => s.employeeId === user.id) : []),
    [shifts, user]
  );

  const shiftStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let total = 0;
    let completed = 0;
    myShifts.forEach((s) => {
      const key = s.shiftType || 'unknown';
      stats[key] = (stats[key] || 0) + 1;
      total++;
      if (s.status === 'completed') completed++;
    });
    return { stats, total, completed };
  }, [myShifts]);

  const nextShift = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myShifts
      .filter((s) => s.date >= today && s.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
  }, [myShifts]);

  const upcomingShifts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myShifts
      .filter((s) => s.date >= today && s.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(1, 4);
  }, [myShifts]);

  /* ─── Helpers ─── */
  const initials = user?.name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('') || '?';

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return d; }
  };

  const resolveShiftLabel = (key?: string) => key ? getShiftLabel(t, key) : '-';

  /* ─── Handlers ─── */
  const openEditModal = () => {
    setEditName(employee?.name || user?.name || '');
    setEditEmail(employee?.email || user?.email || '');
    setEditPhone(employee?.phone || '');
    setEditAvatar(employee?.avatar || user?.avatar || '');
    setEditOpen(true);
  };

  const handleSaveProfile = () => {
    if (!editName.trim()) return;
    updateProfile({ name: editName.trim(), email: editEmail.trim(), avatar: editAvatar });
    const source = mockEmployeesSource.find((e) => e.id === user?.id);
    if (source) {
      source.phone = editPhone.trim();
      if (editAvatar !== undefined) source.avatar = editAvatar;
    }
    setEditOpen(false);
    addToast({ type: 'success', title: t('common:toast.saved'), message: t('employees:profile.profileUpdated') });
  };

  const handleChangePassword = () => {
    setPwError('');
    if (currentPw !== '123456') { setPwError(t('forms:validation.currentPasswordWrong')); return; }
    if (newPw.length < 6) { setPwError(t('forms:validation.newPasswordMin')); return; }
    if (newPw !== confirmPw) { setPwError(t('forms:validation.newPasswordMismatch')); return; }
    setPasswordOpen(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError('');
    addToast({ type: 'success', title: t('common:toast.changed'), message: t('employees:profile.passwordChanged') });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('employees:profile.title')}</h1>

      {/* ═══ Grid Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ──────── 1. Profile Header & Status Card ──────── */}
        <Card className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user?.avatar || employee?.avatar ? (
                <img src={user?.avatar || employee?.avatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-white" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-white text-2xl font-bold shadow-lg select-none">
                  {initials}
                </div>
              )}
              {/* Live status dot */}
              <span className="absolute bottom-0.5 end-0.5 h-4 w-4 rounded-full border-2 border-white bg-success animate-pulse" title={t('common:status.active')} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-text-primary truncate">{user?.name}</h2>
                <Badge variant="success" className="gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-600" />
                  {t('common:status.active')}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={user?.role === 'admin' ? 'info' : 'default'}>
                  {user?.role === 'admin' ? t('common:role.admin') : t('common:role.employee')}
                </Badge>
                <span className="text-sm text-text-secondary">{employee?.position}</span>
              </div>
              {/* Quick fields */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{employee?.employeeNumber}</span>
                <span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{user?.departmentName}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{employee?.createdAt ? new Date(employee.createdAt).toLocaleDateString(dateLocale) : '-'}</span>
              </div>
            </div>

            {/* Edit button */}
            <Button variant="outline" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={openEditModal}>
              {t('employees:profile.editData')}
            </Button>
          </div>

          {/* Detail row */}
          <div className="mt-5 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: User, label: t('common:labels.name'), value: user?.name },
              { icon: Mail, label: t('common:labels.email'), value: employee?.email || user?.email, dir: 'ltr' as const },
              { icon: Phone, label: t('common:labels.phone'), value: employee?.phone || '-', dir: 'ltr' as const },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5">
                  <Icon className="w-4 h-4 text-text-secondary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-secondary">{f.label}</p>
                    <p className="text-sm font-medium text-text-primary truncate" dir={f.dir}>{f.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ──────── 2. Shift Statistics Card ──────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><TrendingUp className="w-4.5 h-4.5 text-primary" />{t('employees:profile.shiftStats')}</span>
            </CardTitle>
          </CardHeader>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-primary-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-primary">{shiftStats.total}</p>
              <p className="text-xs text-primary-700 mt-0.5">{t('employees:profile.totalShifts')}</p>
            </div>
            <div className="rounded-lg bg-success-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-success">{shiftStats.completed}</p>
              <p className="text-xs text-success-600 mt-0.5">{t('employees:profile.completed')}</p>
            </div>
          </div>

          {/* Per-type breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {shiftTypes.map((type) => {
              const count = shiftStats.stats[type.key] || 0;
              const meta = shiftMeta[type.key] || { icon: Clock, color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
              const Icon = meta.icon;
              return (
                <div
                  key={type.id}
                  className="flex flex-col items-center gap-1 rounded-lg px-2 py-3 transition-transform hover:scale-105"
                  style={{ backgroundColor: meta.bg }}
                >
                  <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  <span className="text-lg font-bold" style={{ color: meta.color }}>{count}</span>
                  <span className="text-[11px] text-text-secondary leading-tight text-center">{getShiftLabel(t, type.key)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ──────── 3. Next Shift & Upcoming Schedule Card ──────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><CalendarCheck className="w-4.5 h-4.5 text-primary" />{t('employees:profile.nextShift')}</span>
            </CardTitle>
          </CardHeader>

          {nextShift ? (() => {
            const meta = shiftMeta[nextShift.shiftType || ''] || { icon: Clock, color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
            const Icon = meta.icon;
            return (
              <div className="rounded-xl p-4 mb-4 border" style={{ borderColor: meta.color + '40', backgroundColor: meta.bg }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: meta.color + '20' }}>
                    <Icon className="w-6 h-6" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary">{resolveShiftLabel(nextShift.shiftType)}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{formatDate(nextShift.date)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold" style={{ color: meta.color }} dir="ltr">{nextShift.startTime} – {nextShift.endTime}</p>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="text-center py-6 text-text-secondary text-sm">{t('employees:profile.noUpcomingShifts')}</div>
          )}

          {/* Upcoming list */}
          {upcomingShifts.length > 0 && (
            <>
              <p className="text-xs font-medium text-text-secondary mb-2">{t('employees:profile.upcomingShifts')}</p>
              <div className="space-y-2">
                {upcomingShifts.map((s) => {
                  const meta = shiftMeta[s.shiftType || ''] || { icon: Clock, color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
                  const Icon = meta.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-background">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: meta.bg }}>
                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{resolveShiftLabel(s.shiftType)}</p>
                        <p className="text-xs text-text-secondary">{formatDate(s.date)}</p>
                      </div>
                      <span className="text-xs font-medium text-text-secondary" dir="ltr">{s.startTime} – {s.endTime}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* ──────── 4. Security & Password Card ──────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><Shield className="w-4.5 h-4.5 text-primary" />{t('employees:profile.security')}</span>
            </CardTitle>
          </CardHeader>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg bg-background px-4 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{t('employees:profile.password')}</p>
              <p className="text-xs text-text-secondary mt-0.5">{t('employees:profile.passwordDescription')}</p>
            </div>
            <Button variant="outline" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />} onClick={() => setPasswordOpen(true)}>
              {t('employees:profile.changePassword')}
            </Button>
          </div>
        </Card>
      </div>

      {/* ═══ Edit Profile Modal ═══ */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={t('employees:profile.editModalTitle')} size="sm">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              {editAvatar ? (
                <img src={editAvatar} alt="Edit Avatar" className="h-24 w-24 rounded-full object-cover border border-border" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-primary text-3xl font-bold border border-primary/20">
                  {initials}
                </div>
              )}
              <label className="absolute bottom-0 end-0 p-1.5 bg-white border border-border rounded-full shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                <Camera className="w-4 h-4 text-text-secondary" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
          </div>
          <Input label={t('common:labels.name')} value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label={t('common:labels.email')} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} dir="ltr" />
          <Input label={t('forms:labels.phoneNumber')} type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr" />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>{t('common:actions.cancel')}</Button>
            <Button size="sm" onClick={handleSaveProfile}>{t('forms:actions.saveChanges')}</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Change Password Modal ═══ */}
      <Modal isOpen={passwordOpen} onClose={() => { setPasswordOpen(false); setPwError(''); }} title={t('employees:profile.changePasswordModalTitle')} size="sm">
        <div className="space-y-4">
          {/* Current password */}
          <div className="relative">
            <Input
              label={t('forms:labels.currentPassword')}
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              dir="ltr"
            />
            <button
              type="button"
              className="absolute end-3 top-[2.1rem] text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* New password */}
          <div className="relative">
            <Input
              label={t('forms:labels.newPassword')}
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              dir="ltr"
              hint={t('forms:validation.passwordHint')}
            />
            <button
              type="button"
              className="absolute end-3 top-[2.1rem] text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Confirm password */}
          <Input
            label={t('forms:labels.confirmNewPassword')}
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            dir="ltr"
          />
          {pwError && (
            <p className="text-xs text-danger font-medium bg-danger-50 rounded-lg px-3 py-2">{pwError}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setPasswordOpen(false); setPwError(''); }}>{t('common:actions.cancel')}</Button>
            <Button size="sm" onClick={handleChangePassword}>{t('employees:profile.changePassword')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
