import { useTranslation } from 'react-i18next';
import AdminProfileOverview from './AdminProfileOverview';
import EmployeeProfileOverview from './EmployeeProfileOverview';
import ProfileIdentityCard from './ProfileIdentityCard';
import { buildEmployeeScheduleView } from '@/lib/employeeScheduleView';
import { buildUnifiedOperationalAudit } from '@/lib/operationalAudit';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { resolveEffectiveEmployeeAccess } from '@/types/employeeAccess';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useOperationalAuditStore } from '@/stores/operationalAuditStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';

function fmt(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export default function ProfilePage() {
  const { t } = useTranslation('employees');
  const user = useAuthStore((state) => state.user);
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const roster = useEmployeeRosterStore((state) => state.employees);
  const matrices = useScheduleMatrixStore((state) => state.matricesByMonth);
  const currentMatrix = useScheduleMatrixStore((state) => state.data);
  const otMonths = useLateScheduleStore((state) => state.publishedRowsByMonth);
  const auditEntries = useOperationalAuditStore((state) => state.entries);
  const recordAudit = useOperationalAuditStore((state) => state.record);
  if (!user) return null;

  const saveEmail = (email: string) => {
    const before = user.email;
    updateProfile({ email });
    if (before !== email) recordAudit({ actorName: user.name, action: 'update', module: 'profile', entityId: 'email', entityLabel: t('profileView.email'), before, after: email, context: { route: '/profile' } });
  };
  const savePassword = (currentPassword: string, newPassword: string) => {
    const changed = changePassword(currentPassword, newPassword);
    if (changed) recordAudit({ actorName: user.name, action: 'update', module: 'profile', entityId: 'password', entityLabel: t('profileView.password'), context: { route: '/profile' } });
    return changed;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 6);
  const access = user.role === 'employee' ? resolveEffectiveEmployeeAccess(user, accessProfile) : null;
  const employeeId = access?.active ? access.scheduleEmployeeId : undefined;
  const visibleMatrices = access?.permissions['schedule.own.view'] ? matrices : {};
  const visibleOTMonths = access?.permissions['schedule.ot.own.view'] ? otMonths : {};
  const canViewOwnSchedule = Boolean(
    access?.permissions['schedule.own.view'] || access?.permissions['schedule.ot.own.view'],
  );
  const monthView = employeeId && canViewOwnSchedule ? buildEmployeeScheduleView(employeeId, { startDate: fmt(monthStart), endDate: fmt(monthEnd) }, visibleMatrices, visibleOTMonths, roster, fmt(now)) : undefined;
  const weekView = employeeId && canViewOwnSchedule ? buildEmployeeScheduleView(employeeId, { startDate: fmt(now), endDate: fmt(weekEnd) }, visibleMatrices, visibleOTMonths, roster, fmt(now)) : undefined;
  const scheduleAudit = [currentMatrix, ...Object.values(matrices)].filter((matrix): matrix is NonNullable<typeof matrix> => !!matrix).flatMap((matrix) => matrix.auditLog);
  const unifiedAudit = buildUnifiedOperationalAudit(scheduleAudit, auditEntries);

  return <div className="space-y-5"><header><h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('profileView.title')}</h1><p className="mt-1 text-sm text-text-secondary">{t('profileView.subtitle')}</p></header><ProfileIdentityCard user={user} onSaveEmail={saveEmail} onChangePassword={savePassword} />{user.role === 'employee' && monthView && weekView ? <EmployeeProfileOverview month={monthView} week={weekView} /> : user.role === 'employee' ? <p className="rounded-card border border-warning/30 bg-warning/10 p-4 text-sm text-text-primary">{t('profileView.unlinked')}</p> : <AdminProfileOverview recentEntries={unifiedAudit} />}</div>;
}
