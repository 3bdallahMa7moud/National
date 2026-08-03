import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSION_TEMPLATES,
  effectivePermissions,
  type EmployeePermission,
  type EmployeePermissionTemplateId,
  type EmployeeAccessProfile,
  type EmployeeAccessSubject,
} from '@/types/employeeAccess';
import api from '@/lib/axios';
import { fetchAndHydrateBootstrap } from '@/lib/backendBootstrap';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';

export interface EmployeePermissionsRosterOption {
  employeeId: string;
  code: string;
  fullName: string;
}

interface EmployeePermissionsPanelProps {
  employee: EmployeeAccessSubject;
  roster: EmployeePermissionsRosterOption[];
  actorName: string;
  onSaved?: () => void;
  onError?: (message: string) => void;
}

export default function EmployeePermissionsPanel({
  employee,
  roster,
  actorName,
  onSaved,
  onError,
}: EmployeePermissionsPanelProps) {
  const { t } = useTranslation(['access']);
  const profile = useEmployeeAccessStore((state) => state.profiles[employee.accountId]);
  const [isSaving, setIsSaving] = useState(false);

  const resolvedProfile: EmployeeAccessProfile = profile ?? {
    accountId: employee.accountId,
    departmentId: employee.departmentId,
    scheduleEmployeeId: employee.scheduleEmployeeId,
    templateId: 'standard',
    overrides: {},
    active: employee.active !== false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: actorName,
  };

  const persistProfile = async (nextProfile: EmployeeAccessProfile) => {
    setIsSaving(true);
    try {
      await api.patch(`/employees/${employee.accountId}/access`, {
        templateId: nextProfile.templateId,
        overrides: nextProfile.overrides,
        scheduleEmployeeId: nextProfile.scheduleEmployeeId ?? null,
        active: nextProfile.active,
      });
      await fetchAndHydrateBootstrap();
      onSaved?.();
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.error?.code === 'ROSTER_LINK_TAKEN'
          ? t('access:permissions.duplicateLink')
          : error.response?.data?.error?.message;
        onError?.(message || t('access:permissions.storageError'));
      } else {
        onError?.(t('access:permissions.storageError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const effective = effectivePermissions(resolvedProfile.templateId, resolvedProfile.overrides);

  return (
    <section className="space-y-4" aria-labelledby={`employee-access-${employee.accountId}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-btn bg-primary-50 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h3 id={`employee-access-${employee.accountId}`} className="font-semibold text-text-primary">
            {t('access:permissions.title')}
          </h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{t('access:permissions.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-text-primary">
          <span className="mb-1.5 block">{t('access:permissions.template')}</span>
          <select
            className="input-field w-full"
            value={resolvedProfile.templateId}
            disabled={isSaving}
            onChange={(event) => {
              void persistProfile({
                ...resolvedProfile,
                templateId: event.target.value as EmployeePermissionTemplateId,
              });
            }}
          >
            {(Object.keys(EMPLOYEE_PERMISSION_TEMPLATES) as EmployeePermissionTemplateId[]).map((templateId) => (
              <option key={templateId} value={templateId}>{t(`access:permissions.templates.${templateId}`)}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-text-primary">
          <span className="mb-1.5 block">{t('access:permissions.rosterLink')}</span>
          <select
            className="input-field w-full"
            value={resolvedProfile.scheduleEmployeeId ?? ''}
            disabled={isSaving}
            onChange={(event) => {
              void persistProfile({
                ...resolvedProfile,
                scheduleEmployeeId: event.target.value || undefined,
              });
            }}
          >
            <option value="">{t('access:permissions.unlinked')}</option>
            {roster.map((option) => (
              <option key={option.employeeId} value={option.employeeId}>{option.code} · {option.fullName}</option>
            ))}
          </select>
        </label>
      </div>

      {!resolvedProfile.scheduleEmployeeId && (
        <div className="flex gap-2 rounded-card border border-warning/30 bg-warning-50 p-3 text-xs leading-5 text-text-primary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>{t('access:permissions.unlinkedWarning')}</p>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {EMPLOYEE_PERMISSIONS.map((permission) => (
          <PermissionRow
            key={permission}
            permission={permission}
            inherited={EMPLOYEE_PERMISSION_TEMPLATES[resolvedProfile.templateId].permissions[permission]}
            effective={effective[permission]}
            override={resolvedProfile.overrides[permission]}
            label={t(`access:permissions.items.${permission}`)}
            inheritLabel={t('access:permissions.inherit')}
            enabledLabel={t('access:permissions.enabled')}
            disabledLabel={t('access:permissions.disabled')}
            onChange={(value) => {
              const overrides = { ...resolvedProfile.overrides };
              if (value === undefined) delete overrides[permission];
              else overrides[permission] = value;
              void persistProfile({
                ...resolvedProfile,
                overrides,
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionRow({
  permission,
  inherited,
  effective,
  override,
  label,
  inheritLabel,
  enabledLabel,
  disabledLabel,
  onChange,
}: {
  permission: EmployeePermission;
  inherited: boolean;
  effective: boolean;
  override?: boolean;
  label: string;
  inheritLabel: string;
  enabledLabel: string;
  disabledLabel: string;
  onChange(value: boolean | undefined): void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-muted p-3">
      <span className="min-w-0 text-sm font-medium text-text-primary">{label}</span>
      <select
        aria-label={label}
        data-permission={permission}
        className={`min-w-[8.5rem] rounded-btn border px-2 py-1.5 text-xs font-semibold ${
          effective ? 'border-success/30 bg-success-50 text-success' : 'border-border bg-surface text-text-secondary'
        }`}
        value={override === undefined ? 'inherit' : override ? 'enabled' : 'disabled'}
        onChange={(event) => onChange(event.target.value === 'inherit' ? undefined : event.target.value === 'enabled')}
      >
        <option value="inherit">{inheritLabel} ({inherited ? enabledLabel : disabledLabel})</option>
        <option value="enabled">{enabledLabel}</option>
        <option value="disabled">{disabledLabel}</option>
      </select>
    </label>
  );
}
