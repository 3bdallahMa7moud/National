import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/axios';
import { fetchAndHydrateBootstrap } from '@/lib/backendBootstrap';
import { mapApiDepartmentToRecord, type ApiDepartment } from '@/lib/backendAdapters';
import { departmentRecordToDepartment, employeeRecordToEmployee } from '@/lib/localizedRecords';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { useLanguage } from '@/hooks/useLanguage';
import { Building2, Users, UserCheck, Plus, Edit2, Trash2 } from 'lucide-react';
import type { Department } from '@/types';

interface DepartmentFieldErrors {
  name?: string;
  description?: string;
  managerId?: string;
}

export default function DepartmentsPage() {
  const { t } = useTranslation(['departments', 'common', 'forms']);
  const navigate = useNavigate();
  const [editModal, setEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<DepartmentFieldErrors>({});
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();
  const { language } = useLanguage();
  const departmentRecords = useDepartmentStore((state) => state.records);
  const employeeRecords = useEmployeeDirectoryStore((state) => state.records);
  const setDepartmentRecords = useDepartmentStore((state) => state.setRecords);
  const activeEmployeeRecords = useMemo(
    () => employeeRecords.filter((employee) => employee.active),
    [employeeRecords],
  );
  const departments = useMemo(
    () => departmentRecords.map((record) => {
      const employeeCount = activeEmployeeRecords.filter((employee) => employee.departmentId === record.id).length;
      return departmentRecordToDepartment(record, language, employeeCount);
    }),
    [activeEmployeeRecords, departmentRecords, language],
  );
  const employees = useMemo(
    () => activeEmployeeRecords.map((record) => employeeRecordToEmployee(record, language)),
    [activeEmployeeRecords, language],
  );

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormError('');
    setFieldErrors({});
    setEditModal(true);
  };

  const handleDeleteClick = (dept: Department) => {
    setDeletingDept(dept);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return;
    setIsDeleting(true);
    try {
      await api.delete(`/departments/${deletingDept.id}`);
      setDepartmentRecords(departmentRecords.filter((r) => r.id !== deletingDept.id));
      await fetchAndHydrateBootstrap().catch(() => undefined);
      setDeleteModal(false);
      setDeletingDept(null);
      addToast({ type: 'success', title: t('common:toast.saved'), message: t('departments:deleteSuccess') });
    } catch (error) {
      if (isAxiosError(error)) {
        const payload = error.response?.data as { error?: { code?: string; message?: string } } | undefined;
        if (payload?.error?.code === 'DEPARTMENT_HAS_EMPLOYEES') {
          addToast({ type: 'error', title: t('common:toast.error'), message: t('departments:deleteHasEmployees') });
        } else {
          addToast({ type: 'error', title: t('common:toast.error'), message: payload?.error?.message || t('common:errorState.sectionMessage') });
        }
      } else {
        addToast({ type: 'error', title: t('common:toast.error'), message: t('common:errorState.sectionMessage') });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFormState = () => {
    setFormError('');
    setFieldErrors({});
  };

  const closeModal = () => {
    resetFormState();
    setEditModal(false);
  };

  const readFieldErrors = (details: unknown): DepartmentFieldErrors => {
    if (!details || typeof details !== 'object') return {};
    const fieldErrors = (details as { fieldErrors?: Record<string, unknown> }).fieldErrors;
    if (!fieldErrors || typeof fieldErrors !== 'object') return {};

    return {
      name: Array.isArray(fieldErrors.name) ? String(fieldErrors.name[0] ?? '') : undefined,
      description: Array.isArray(fieldErrors.description) ? String(fieldErrors.description[0] ?? '') : undefined,
      managerId: Array.isArray(fieldErrors.managerId) ? String(fieldErrors.managerId[0] ?? '') : undefined,
    };
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    resetFormState();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const managerIdValue = String(formData.get('managerId') || '').trim();

    if (!name) {
      setFieldErrors({ name: t('forms:validation.departmentNameRequired') });
      return;
    }

    setIsSaving(true);
    try {
      const response = editingDept
        ? await api.patch<{ department: ApiDepartment }>(`/departments/${editingDept.id}`, {
            name,
            description,
            managerId: managerIdValue || null,
          })
        : await api.post<{ department: ApiDepartment }>('/departments', {
            name,
            description,
            managerId: managerIdValue || null,
          });

      const updated = mapApiDepartmentToRecord(response.data.department);
      const nextRecords = editingDept
        ? departmentRecords.map((record) => record.id === updated.id ? updated : record)
        : [...departmentRecords, updated];
      setDepartmentRecords(nextRecords);
      await fetchAndHydrateBootstrap().catch(() => undefined);
      closeModal();
      addToast({
        type: 'success',
        title: t('common:toast.saved'),
        message: editingDept ? t('departments:updateSuccess') : t('departments:createSuccess'),
      });
    } catch (error) {
      if (isAxiosError(error)) {
        const payload = error.response?.data as {
          error?: {
            code?: string;
            message?: string;
            details?: unknown;
          };
        } | undefined;
        const apiFieldErrors = readFieldErrors(payload?.error?.details);
        if (apiFieldErrors.name || apiFieldErrors.description || apiFieldErrors.managerId) {
          setFieldErrors(apiFieldErrors);
          setFormError(t('departments:validationFailed'));
          return;
        }

        const message = payload?.error?.message || t('departments:validationFailed');
        setFormError(message);
        addToast({ type: 'error', title: t('common:toast.error'), message });
        return;
      }

      const message = t('common:errorState.sectionMessage');
      setFormError(message);
      addToast({ type: 'error', title: t('common:toast.error'), message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('departments:title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('departments:subtitle')}</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditingDept(null); resetFormState(); setEditModal(true); }}
        >
          {t('departments:addDepartment')}
        </Button>
      </div>

      <ErrorBoundary level="section" invalidateQueries>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const manager = employees.find((e) => e.id === dept.managerId);
            const deptEmployees = employees.filter((e) => e.departmentId === dept.id);

            return (
              <Card key={dept.id} className="flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(dept)}
                        title={t('departments:editDepartment')}
                        className="p-1.5 rounded-lg hover:bg-hover text-text-secondary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(dept)}
                        title={t('departments:deleteDepartment')}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-1 text-base font-semibold text-text-primary">{dept.name}</h3>
                  <p className="mb-5 line-clamp-2 text-xs leading-5 text-text-secondary">{dept.description}</p>

                  <div className="space-y-3 border-t border-border pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        {t('departments:departmentHead')}
                      </span>
                      <span className="font-medium text-text-primary">{manager?.name || t('common:labels.notSpecified')}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary flex items-center gap-2">
                        <Users className="w-4 h-4 text-success" />
                        {t('departments:employeeCount')}
                      </span>
                      <Badge variant="success">{t('departments:employeeCountBadge', { count: deptEmployees.length })}</Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
                  <span>{t('common:labels.code')}: {dept.id.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/employees?departmentId=${dept.id}`)}
                    className="text-primary font-medium cursor-pointer hover:underline focus:outline-none"
                  >
                    {t('departments:viewTeam')}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </ErrorBoundary>

      <Modal
        isOpen={editModal}
        onClose={closeModal}
        title={editingDept ? t('departments:editDepartment') : t('departments:addDepartment')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            name="name"
            label={t('forms:labels.departmentName')}
            defaultValue={editingDept?.name}
            error={fieldErrors.name}
            required
            placeholder={t('departments:namePlaceholder')}
          />
          <Input
            name="description"
            label={t('forms:labels.departmentDescription')}
            defaultValue={editingDept?.description}
            error={fieldErrors.description}
            placeholder={t('departments:descriptionPlaceholder')}
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{t('forms:labels.departmentHead')}</label>
            <select
              name="managerId"
              className={`input-field ${fieldErrors.managerId ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}`}
              defaultValue={editingDept?.managerId || ''}
              aria-invalid={fieldErrors.managerId ? true : undefined}
              aria-describedby={fieldErrors.managerId ? 'department-manager-error' : undefined}
            >
              <option value="">{t('forms:labels.selectSupervisor')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
              ))}
            </select>
            {fieldErrors.managerId && (
              <p id="department-manager-error" role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.managerId}
              </p>
            )}
          </div>
          {formError && (
            <p role="alert" className="rounded-btn bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
            <Button variant="secondary" type="button" onClick={closeModal}>{t('common:actions.cancel')}</Button>
            <Button type="submit" loading={isSaving}>{t('forms:actions.saveChanges')}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteModal}
        onClose={() => { if (!isDeleting) { setDeleteModal(false); setDeletingDept(null); } }}
        title={t('departments:deleteConfirmTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t('departments:deleteConfirmMessage', { name: deletingDept?.name })}
          </p>
          <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setDeleteModal(false); setDeletingDept(null); }}
              disabled={isDeleting}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {t('departments:deleteDepartment')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
