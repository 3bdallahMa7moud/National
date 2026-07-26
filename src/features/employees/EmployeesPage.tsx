import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/common/DataTable';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { useToast } from '@/components/ui/Toast';
import { useLanguage } from '@/hooks/useLanguage';
import type { MockEmployeeSource } from '@/mocks/types';
import {
  Plus, Edit2, Trash2, Search, CheckCircle2, Copy, UserPlus,
  Hash, KeyRound, Mail, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { setEmployeePassword } from '@/mocks/mockPasswordStore';
import { JOB_TITLE_OPTIONS, findJobTitleOption, type Employee, type UserRole } from '@/types';
import EmployeePermissionsPanel from './EmployeePermissionsPanel';
import { getOfficialEmployeeRoster } from '@/stores/employeeRosterStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { effectivePermissions } from '@/types/employeeAccess';
import { useAuthStore } from '@/stores/authStore';
import {
  getEmployeeDirectoryRecord,
  useEmployeeDirectoryStore,
} from '@/stores/employeeDirectoryStore';

/* ─── helpers ─── */
function generateId(): string {
  return 'emp-' + Date.now();
}
function generateEmpNumber(): string {
  const nums = useEmployeeDirectoryStore.getState().records
    .map((employee) => parseInt(employee.employeeNumber.replace(/\D/g, ''), 10))
    .filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'EMP-' + String(max + 1).padStart(3, '0');
}

const DEFAULT_DEPT_ID = 'dept-1';
const DEFAULT_DEPT_NAME = { ar: 'قسم الأشعة المقطعية', en: 'CT Scan Department' };

interface AddForm {
  name: string;
  bn: string;
  code: string;
  jobTitleId: string;
  phone: string;
  role: 'employee' | 'admin';
}
const emptyForm = (): AddForm => ({
  name: '', bn: '', code: '', jobTitleId: JOB_TITLE_OPTIONS[0].id, phone: '', role: 'employee',
});

interface AddedInfo { empNumber: string; name: string }

export default function EmployeesPage() {
  const { t } = useTranslation(['employees', 'common', 'forms', 'access']);
  const { language } = useLanguage();
  const { employees: allEmployees } = useMockData();
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const actor = user;
  const roleLabels: Record<UserRole, string> = {
    super_admin: t('common:role.superAdmin', 'Super Admin'),
    admin: t('common:role.admin', 'Admin'),
    employee: t('common:role.employee', 'Employee'),
  };
  const accessProfiles = useEmployeeAccessStore((state) => state.profiles);
  const addDirectoryEmployee = useEmployeeDirectoryStore((state) => state.addEmployee);
  const updateDirectoryEmployee = useEmployeeDirectoryStore((state) => state.updateEmployee);
  const setDirectoryActive = useEmployeeDirectoryStore((state) => state.setActive);

  const [searchParams, setSearchParams] = useSearchParams();
  const deptIdFilter = searchParams.get('departmentId') || '';

  /* ─── local state ─── */
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editBn, setEditBn] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editJobTitleId, setEditJobTitleId] = useState<string>(JOB_TITLE_OPTIONS[0].id);
  const [addedInfo, setAddedInfo] = useState<AddedInfo | null>(null);  // confirmation screen
  const [form, setForm] = useState<AddForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<AddForm>>({});
  const [copied, setCopied] = useState<'num' | 'pw' | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<Employee | null>(null);
  const [permissionsEmployee, setPermissionsEmployee] = useState<Employee | null>(null);

  /* ─── derived data ─── */
  const employees = useMemo(
    () => allEmployees,
    [allEmployees],
  );
  const filtered = employees.filter((e) => {
    const matchesSearch = e.name.includes(search) || e.email.includes(search) || e.employeeNumber.includes(search);
    const matchesDept = !deptIdFilter || e.departmentId === deptIdFilter;
    return matchesSearch && matchesDept;
  });

  /* ─── form helpers ─── */
  const setField = (k: keyof AddForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFormErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validateForm = (): boolean => {
    const errs: Partial<AddForm> = {};
    if (!form.name.trim()) errs.name = t('forms:validation.nameMin');
    if (!form.bn.trim()) errs.bn = t('forms:validation.nameMin', { defaultValue: 'BN required' });
    if (!form.code.trim()) errs.code = t('forms:validation.nameMin');
    if (!form.jobTitleId) errs.jobTitleId = t('forms:validation.positionMin');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ─── handlers ─── */
  const handleAdd = () => {
    if (!validateForm()) return;
    const empNumber = form.bn.trim() || generateEmpNumber();
    const employeeName = form.name.trim();
    const selectedTitle = JOB_TITLE_OPTIONS.find((t) => t.id === form.jobTitleId) ?? JOB_TITLE_OPTIONS[0];
    const newSource: MockEmployeeSource = {
      id: generateId(),
      name: { ar: employeeName, en: employeeName },
      email: '',
      phone: form.phone.trim(),
      role: 'employee',
      departmentId: DEFAULT_DEPT_ID,
      departmentName: DEFAULT_DEPT_NAME,
      position: { ar: selectedTitle.ar, en: selectedTitle.en },
      employeeNumber: empNumber,
      code: form.code.trim().toUpperCase(),
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const result = addDirectoryEmployee(newSource, actor?.name);
    if (!result.ok) {
      addToast({ type: 'error', title: t('common:toast.error'), message: result.message || result.reason });
      return;
    }
    setAddedInfo({ empNumber, name: employeeName });
    setForm(emptyForm());
    setFormErrors({});
  };

  const handleCloseAdd = () => {
    setAddOpen(false);
    setAddedInfo(null);
    setForm(emptyForm());
    setFormErrors({});
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditName(emp.name || '');
    setEditBn(emp.employeeNumber || '');
    setEditCode(emp.code || '');
    setEditJobTitleId(findJobTitleOption(emp.position).id);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    const result = setDirectoryActive(id, false, actor?.name);
    if (!result.ok) {
      addToast({ type: 'error', title: t('common:toast.error'), message: result.message || result.reason });
      return;
    }
    setDeleteDialog(null);
    addToast({ type: 'success', title: t('common:toast.deleted'), message: t('employees:management.deleteSuccess') });
  };

  const handleCopy = (text: string, kind: 'num' | 'pw') => {
    navigator.clipboard.writeText(text).catch(() => { });
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleResetPassword = (emp: Employee) => {
    setResetPasswordDialog(emp);
  };

  const confirmResetPassword = () => {
    if (!resetPasswordDialog) return;
    setEmployeePassword(resetPasswordDialog.id, '123456');
    setResetPasswordDialog(null);
    setEditOpen(false);
    addToast({ type: 'success', title: t('employees:management.resetPasswordSuccess') });
  };

  /* ─── table columns ─── */
  const columns = [
    { key: 'employeeNumber', header: t('employees:management.columns.number'), className: 'w-24' },
    {
      key: 'name',
      header: t('employees:management.columns.employee'),
      render: (emp: Employee) => {
        const record = getEmployeeDirectoryRecord(emp.id);
        return (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-medium">{emp.name}</p>
              {record && record.issues.length > 0 && (
                <Badge variant="danger">{t('employees:management.needsReview', 'Needs review')}</Badge>
              )}
              {record?.role === 'employee' && !record.active && (
                <Badge variant="danger">{t('employees:management.inactive', 'Inactive')}</Badge>
              )}
              {record?.role === 'employee' && !record.scheduleEmployeeId && (
                <Badge variant="warning">{t('employees:management.notLinked', 'Not linked')}</Badge>
              )}
              {record?.role === 'employee'
                && accessProfiles[record.accountId]
                && !effectivePermissions(
                  accessProfiles[record.accountId].templateId,
                  accessProfiles[record.accountId].overrides,
                )['schedule.requests.respond'] && (
                  <Badge variant="warning">{t('employees:management.cannotReceiveSwap', 'Cannot receive shift requests')}</Badge>
              )}
            </div>
            <p className="text-xs text-text-secondary">{emp.position}</p>
          </div>
        );
      },
    },
    {
      key: 'email',
      header: t('employees:management.columns.email'),
      render: (emp: Employee) => emp.email
        ? <span dir="ltr" className="text-text-secondary text-sm">{emp.email}</span>
        : <span className="text-text-secondary/50 text-xs italic">{t('common:labels.notSet', '—')}</span>,
    },
    {
      key: 'role',
      header: t('employees:management.columns.role'),
      render: (emp: Employee) => {
        const record = getEmployeeDirectoryRecord(emp.id);
        const role = record?.role || emp.role;
        if (role === 'super_admin') {
          return (
            <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 font-bold">
              👑 {t('common:role.superAdmin', 'Super Admin')}
            </Badge>
          );
        }
        if (role === 'admin') {
          return (
            <Badge variant="info" className="bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700 font-bold">
              🛡️ {t('common:role.admin', 'Admin')}
            </Badge>
          );
        }
        return (
          <Badge variant="default">
            👤 {t('common:role.employee', 'Employee')}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: t('employees:management.columns.actions'),
      className: 'w-56',
      render: (emp: Employee) => {
        const record = getEmployeeDirectoryRecord(emp.id);
        const currentRole = record?.role || emp.role;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {user?.role === 'super_admin' && (
              <select
                value={currentRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  const res = useEmployeeDirectoryStore.getState().setRole(emp.id, newRole, user.name);
                  if (res.ok) {
                    addToast({
                      type: 'success',
                      title: t('common:toast.updated', 'Updated'),
                      message: t('employees:management.roleUpdated', {
                        name: emp.name,
                        role: roleLabels[newRole],
                      }),
                    });
                  } else {
                    addToast({
                      type: 'error',
                      title: t('common:toast.error'),
                      message: res.message || res.reason,
                    });
                  }
                }}
                className="input-field text-xs font-semibold py-1 px-2 h-9 bg-surface-card border-border-subtle hover:border-primary/50 text-text-primary rounded-btn cursor-pointer"
                title={t('employees:management.changeRole', 'Change user role')}
              >
                <option value="employee">👤 {roleLabels.employee}</option>
                <option value="admin">🛡️ {roleLabels.admin}</option>
                <option value="super_admin">👑 {roleLabels.super_admin}</option>
              </select>
            )}
            {currentRole !== 'super_admin' && (
              <button
                type="button"
                onClick={() => setPermissionsEmployee(emp)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-btn text-primary transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={t('access:permissions.title')}
                title={t('access:permissions.title')}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleEdit(emp)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={t('employees:management.editEmployeeAria', { name: emp.name })}
              title={t('employees:management.editEmployeeAria', { name: emp.name })}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialog(emp.id)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-btn text-danger transition-colors hover:bg-danger-50 focus:outline-none focus:ring-2 focus:ring-danger/30"
              aria-label={t('employees:management.deleteEmployeeAria', { name: emp.name })}
              title={t('employees:management.deleteEmployeeAria', { name: emp.name })}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  /* ─── Mobile Employee Card ─── */
  const renderMobileCard = (emp: Employee) => {
    const record = getEmployeeDirectoryRecord(emp.id);
    const currentRole = record?.role || emp.role;

    const roleBadge = (() => {
      if (currentRole === 'super_admin') return (
        <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 font-bold text-xs">
          👑 {t('common:role.superAdmin', 'Super Admin')}
        </Badge>
      );
      if (currentRole === 'admin') return (
        <Badge variant="info" className="bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700 font-bold text-xs">
          🛡️ {t('common:role.admin', 'Admin')}
        </Badge>
      );
      return (
        <Badge variant="default" className="text-xs">
          👤 {t('common:role.employee', 'Employee')}
        </Badge>
      );
    })();

    return (
      <div
        key={emp.id}
        className="rounded-xl border border-border bg-surface-card p-4 space-y-3 shadow-sm"
      >
        {/* Top row: number + role */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-text-secondary bg-surface-muted px-2 py-0.5 rounded-md shrink-0" dir="ltr">
              {emp.employeeNumber}
            </span>
            {roleBadge}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {currentRole !== 'super_admin' && (
              <button
                type="button"
                onClick={() => setPermissionsEmployee(emp)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-primary transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={t('access:permissions.title')}
                title={t('access:permissions.title')}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleEdit(emp)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={t('employees:management.editEmployeeAria', { name: emp.name })}
              title={t('employees:management.editEmployeeAria', { name: emp.name })}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialog(emp.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-danger transition-colors hover:bg-danger-50 focus:outline-none focus:ring-2 focus:ring-danger/30"
              aria-label={t('employees:management.deleteEmployeeAria', { name: emp.name })}
              title={t('employees:management.deleteEmployeeAria', { name: emp.name })}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Name + position + badges */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <p className="font-semibold text-text-primary">{emp.name}</p>
            {record && record.issues.length > 0 && (
              <Badge variant="danger" className="text-xs">{t('employees:management.needsReview', 'Needs review')}</Badge>
            )}
            {record?.role === 'employee' && !record.active && (
              <Badge variant="danger" className="text-xs">{t('employees:management.inactive', 'Inactive')}</Badge>
            )}
            {record?.role === 'employee' && !record.scheduleEmployeeId && (
              <Badge variant="warning" className="text-xs">{t('employees:management.notLinked', 'Not linked')}</Badge>
            )}
            {record?.role === 'employee'
              && accessProfiles[record.accountId]
              && !effectivePermissions(
                accessProfiles[record.accountId].templateId,
                accessProfiles[record.accountId].overrides,
              )['schedule.requests.respond'] && (
              <Badge variant="warning" className="text-xs">{t('employees:management.cannotReceiveSwap', 'Cannot receive shift requests')}</Badge>
            )}
          </div>
          <p className="text-xs text-text-secondary">{emp.position}</p>
        </div>

        {/* Email */}
        {emp.email ? (
          <p className="text-xs text-text-secondary" dir="ltr">{emp.email}</p>
        ) : (
          <p className="text-xs text-text-secondary/50 italic">{t('common:labels.notSet', '—')}</p>
        )}

        {/* Role select for super_admin */}
        {user?.role === 'super_admin' && (
          <select
            value={currentRole}
            onChange={(e) => {
              const newRole = e.target.value as UserRole;
              const res = useEmployeeDirectoryStore.getState().setRole(emp.id, newRole, user.name);
              if (res.ok) {
                addToast({
                  type: 'success',
                  title: t('common:toast.updated', 'Updated'),
                  message: t('employees:management.roleUpdated', { name: emp.name, role: roleLabels[newRole] }),
                });
              } else {
                addToast({ type: 'error', title: t('common:toast.error'), message: res.message || res.reason });
              }
            }}
            className="input-field text-xs font-semibold py-1 px-2 h-9 bg-surface-card border-border-subtle hover:border-primary/50 text-text-primary rounded-btn cursor-pointer w-full"
            title={t('employees:management.changeRole', 'Change user role')}
          >
            <option value="employee">👤 {roleLabels.employee}</option>
            <option value="admin">🛡️ {roleLabels.admin}</option>
            <option value="super_admin">👑 {roleLabels.super_admin}</option>
          </select>
        )}
      </div>
    );
  };

  /* ─── JSX ─── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('employees:management.title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {t('employees:management.countInDepartment', { count: employees.length })}
          </p>
        </div>
        <Button className="w-full sm:w-auto" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
          {t('employees:management.addEmployee')}
        </Button>
      </div>

      {deptIdFilter && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-primary">
            {t('common:labels.filteringByDepartment') || 'تصفية الموظفين حسب القسم المختار'} ({deptIdFilter.toUpperCase()})
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="text-xs font-bold text-primary hover:underline"
          >
            {t('common:actions.showAll') || 'عرض جميع الموظفين'}
          </button>
        </div>
      )}

      {/* Search + Table/Cards */}
      <Card>
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder={t('employees:management.searchPlaceholder')}
            aria-label={t('employees:management.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field ps-10"
          />
        </div>

        <ErrorBoundary level="section" invalidateQueries>
          {/* Mobile: card list (hidden on md+) */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-text-secondary text-sm">{t('common:dataTable.empty')}</p>
            ) : (
              filtered.map((emp) => renderMobileCard(emp))
            )}
          </div>

          {/* Desktop: data table (hidden below md) */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={filtered} keyExtractor={(e) => e.id} />
          </div>
        </ErrorBoundary>
      </Card>

      {/* ═══ Add Employee Modal ═══ */}
      <Modal
        isOpen={addOpen}
        onClose={handleCloseAdd}
        title={addedInfo ? t('employees:management.addedSuccess') : t('employees:management.addEmployee')}
        size="md"
      >
        {addedInfo ? (
          /* ── Success / Credentials screen ── */
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-text-primary">{addedInfo.name}</p>
                <p className="text-sm text-text-secondary mt-0.5">{t('employees:management.addedSubtitle')}</p>
              </div>
            </div>

            {/* Credentials cards */}
            <div className="space-y-2">
              {/* Employee number */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <Hash className="w-4 h-4 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">{t('employees:management.columns.number')}</p>
                  <p className="text-sm font-bold text-text-primary font-mono" dir="ltr">{addedInfo.empNumber}</p>
                </div>
                <button
                  onClick={() => handleCopy(addedInfo.empNumber, 'num')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
                  title={t('common:actions.copy', 'Copy')}
                  aria-label={t('common:actions.copy', 'Copy')}
                >
                  {copied === 'num' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Default password */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <KeyRound className="w-4 h-4 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">{t('employees:management.defaultPassword')}</p>
                  <p className="text-sm font-bold text-text-primary font-mono tracking-widest" dir="ltr">123456</p>
                </div>
                <button
                  onClick={() => handleCopy('123456', 'pw')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
                  title={t('common:actions.copy', 'Copy')}
                  aria-label={t('common:actions.copy', 'Copy')}
                >
                  {copied === 'pw' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Hint */}
            <p className="text-xs text-text-secondary bg-surface-muted rounded-lg px-3 py-2 flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />
              {t('employees:management.addedHint')}
            </p>

            <div className="flex justify-end pt-1">
              <Button onClick={handleCloseAdd}>{t('common:actions.close')}</Button>
            </div>
          </div>
        ) : (
          /* ── Add form ── */
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
          >
            {/* Name & BN */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t('employees:management.name')}
                placeholder="محمد السعيد / Mohammed Al-Saeed"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                error={formErrors.name}
              />
              <Input
                label={t('employees:management.bn')}
                placeholder="EMP-001 or 45892"
                value={form.bn}
                onChange={(e) => setField('bn', e.target.value)}
                error={formErrors.bn}
                hint={t('employees:management.bnHint')}
                dir="ltr"
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                {t('forms:labels.jobTitle')}
              </label>
              <select
                value={form.jobTitleId}
                onChange={(e) => setField('jobTitleId', e.target.value)}
                className="input-field cursor-pointer"
              >
                {JOB_TITLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {language === 'ar' ? opt.ar : opt.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Code */}
            <div>
              <Input
                label={t('forms:labels.code')}
                placeholder="MS"
                value={form.code}
                maxLength={5}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                error={formErrors.code}
                hint={t('employees:management.codeHint')}
                dir="ltr"
              />
            </div>

            {/* Default password notice */}
            <div className="flex items-center gap-2.5 rounded-lg bg-primary-50 border border-primary/20 px-3 py-2.5">
              <KeyRound className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">
                {t('employees:management.defaultPasswordNotice')}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button variant="secondary" type="button" onClick={handleCloseAdd}>
                {t('common:actions.cancel')}
              </Button>
              <Button type="submit" icon={<UserPlus className="w-4 h-4" />}>
                {t('employees:management.addEmployee')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ═══ Edit Employee Modal ═══ */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('employees:management.editEmployee')}
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingEmployee) {
              const selectedTitle = JOB_TITLE_OPTIONS.find((t) => t.id === editJobTitleId) ?? JOB_TITLE_OPTIONS[0];
              const titleText = language === 'ar' ? selectedTitle.ar : selectedTitle.en;
              void titleText;
              const result = updateDirectoryEmployee(editingEmployee.id, {
                name: { ar: editName.trim(), en: editName.trim() },
                employeeNumber: editBn.trim(),
                code: editCode.trim().toUpperCase(),
                position: { ar: selectedTitle.ar, en: selectedTitle.en },
              }, actor?.name);
              if (!result.ok) {
                addToast({ type: 'error', title: t('common:toast.error', 'Error'), message: result.message || result.reason });
                return;
              }
            }
            setEditOpen(false);
            addToast({ type: 'success', title: t('common:toast.saved') });
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={t('employees:management.name')}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label={t('employees:management.bn')}
              value={editBn}
              onChange={(e) => setEditBn(e.target.value)}
              dir="ltr"
              required
            />
          </div>
          <Input
            label={t('forms:labels.code')}
            value={editCode}
            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
            placeholder="e.g. AH, MK"
            maxLength={5}
            dir="ltr"
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              {t('forms:labels.jobTitle')}
            </label>
            <select
              value={editJobTitleId}
              onChange={(e) => setEditJobTitleId(e.target.value)}
              className="input-field cursor-pointer"
            >
              {JOB_TITLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {language === 'ar' ? opt.ar : opt.en}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setEditOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => editingEmployee && handleResetPassword(editingEmployee)}
              className="!text-danger !border-danger/30 hover:!bg-danger-50"
            >
              {t('employees:management.resetPasswordBtn')}
            </Button>
            <Button type="submit">{t('common:actions.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* ═══ Delete Confirm ═══ */}
      <Modal
        isOpen={!!permissionsEmployee}
        onClose={() => setPermissionsEmployee(null)}
        title={t('access:permissions.title')}
        size="lg"
      >
        {permissionsEmployee && (() => {
          const source = getEmployeeDirectoryRecord(permissionsEmployee.id);
          if (!source) return null;
          return (
            <EmployeePermissionsPanel
              employee={{
                accountId: source.accountId,
                name: permissionsEmployee.name,
                departmentId: source.departmentId,
                scheduleEmployeeId: source.scheduleEmployeeId,
                active: source.active,
              }}
              roster={getOfficialEmployeeRoster().map((employee) => ({
                employeeId: employee.employeeId,
                code: employee.code,
                fullName: employee.fullName,
              }))}
              actorName={actor?.name || 'Administrator'}
              onSaved={() => {
                addToast({ type: 'success', title: t('common:toast.saved') });
              }}
              onError={(message) => addToast({
                type: 'error',
                title: t('common:toast.error', 'Error'),
                message,
              })}
            />
          );
        })()}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog)}
        title={t('employees:management.deleteTitle')}
        message={t('employees:management.deleteMessage')}
      />

      {/* ═══ Reset Password Confirm ═══ */}
      <ConfirmDialog
        isOpen={!!resetPasswordDialog}
        onClose={() => setResetPasswordDialog(null)}
        onConfirm={confirmResetPassword}
        title={t('employees:management.resetPasswordTitle')}
        message={t('employees:management.resetPasswordMessage', { name: resetPasswordDialog?.name ?? '' })}
      />
    </div>
  );
}
