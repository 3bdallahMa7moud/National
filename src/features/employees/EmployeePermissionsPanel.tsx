import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSION_TEMPLATES,
  effectivePermissions,
  type EmployeeAccessSubject,
  type EmployeePermission,
  type EmployeePermissionTemplateId,
} from '@/types/employeeAccess';
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
  const ensureProfile = useEmployeeAccessStore((state) => state.ensureProfile);
  const setTemplate = useEmployeeAccessStore((state) => state.setTemplate);
  const setOverride = useEmployeeAccessStore((state) => state.setOverride);
  const setRosterLink = useEmployeeAccessStore((state) => state.setRosterLink);

  useEffect(() => {
    if (profile) return;
    ensureProfile(employee, actorName);
  }, [actorName, employee, ensureProfile, profile]);

  if (!profile) return null;

  const effective = effectivePermissions(profile.templateId, profile.overrides);
  const complete = (result: ReturnType<typeof setTemplate>) => {
    if (result.ok) onSaved?.();
    else onError?.(result.reason === 'duplicate_roster_link'
      ? t('access:permissions.duplicateLink')
      : t('access:permissions.storageError'));
  };

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
            value={profile.templateId}
            onChange={(event) => complete(setTemplate(
              employee.accountId,
              event.target.value as EmployeePermissionTemplateId,
              actorName,
            ))}
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
            value={profile.scheduleEmployeeId ?? ''}
            onChange={(event) => complete(setRosterLink(employee.accountId, event.target.value || undefined, actorName))}
          >
            <option value="">{t('access:permissions.unlinked')}</option>
            {roster.map((option) => (
              <option key={option.employeeId} value={option.employeeId}>{option.code} · {option.fullName}</option>
            ))}
          </select>
        </label>
      </div>

      {!profile.scheduleEmployeeId && (
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
            inherited={EMPLOYEE_PERMISSION_TEMPLATES[profile.templateId].permissions[permission]}
            effective={effective[permission]}
            override={profile.overrides[permission]}
            label={t(`access:permissions.items.${permission}`)}
            inheritLabel={t('access:permissions.inherit')}
            enabledLabel={t('access:permissions.enabled')}
            disabledLabel={t('access:permissions.disabled')}
            onChange={(value) => complete(setOverride(employee.accountId, permission, value, actorName))}
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
