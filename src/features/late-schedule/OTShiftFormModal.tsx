import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { OTShiftInput, OTShiftRow, OTUnit } from '@/types/lateSchedule';

interface OTShiftFormModalProps {
  isOpen: boolean;
  row?: OTShiftRow | null;
  units?: OTUnit[];
  onClose(): void;
  onSave(input: OTShiftInput): void;
  onArchive?(): void;
}

type FieldErrors = Partial<Record<keyof OTShiftInput, string>>;

export default function OTShiftFormModal({ isOpen, row, units = [], onClose, onSave, onArchive }: OTShiftFormModalProps) {
  const { t, i18n } = useTranslation(['common']);
  const isRtl = i18n.language === 'ar';
  const [form, setForm] = useState<OTShiftInput>({ title: '', location: '', timeRange: '', hours: 0, backgroundColor: '#E0F2FE', textColor: '#075985' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(row
      ? {
          unitId: row.unitId,
          title: row.title,
          location: row.location,
          timeRange: row.timeRange,
          hours: row.hours,
          backgroundColor: row.backgroundColor || '#E0F2FE',
          textColor: row.textColor || '#075985',
          shortCode: row.shortCode || '',
          icon: row.icon || '',
        }
      : {
          unitId: units.find((unit) => !unit.archived)?.id,
          title: '',
          location: units.find((unit) => !unit.archived)?.name || 'General OT',
          timeRange: '',
          hours: 0,
          backgroundColor: '#E0F2FE',
          textColor: '#075985',
          shortCode: '',
          icon: '',
        });
    setErrors({});
    setConfirmArchive(false);
  }, [isOpen, row, units]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.title.trim()) next.title = t('common:lateSchedule.validation.titleRequired', { defaultValue: isRtl ? 'اسم الشفت مطلوب' : 'Shift title is required' });
    if (!form.location.trim()) next.location = t('common:lateSchedule.validation.locationRequired', { defaultValue: isRtl ? 'الموقع مطلوب' : 'Location is required' });
    if (!form.timeRange.trim()) next.timeRange = t('common:lateSchedule.validation.timeRequired', { defaultValue: isRtl ? 'الوقت مطلوب' : 'Time range is required' });
    if (!Number.isFinite(form.hours) || form.hours <= 0) next.hours = t('common:lateSchedule.validation.hoursInvalid', { defaultValue: isRtl ? 'يجب أن تكون الساعات أكبر من صفر' : 'Hours must be greater than zero' });
    return next;
  };

  const submit = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({
      title: form.title.trim(),
      location: form.location.trim(),
      timeRange: form.timeRange.trim(),
      hours: form.hours,
      unitId: form.unitId,
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      shortCode: form.shortCode,
      icon: form.icon,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row
        ? t('common:lateSchedule.form.editTitle', { defaultValue: isRtl ? 'تعديل شفت OT' : 'Edit OT shift' })
        : t('common:lateSchedule.form.addTitle', { defaultValue: isRtl ? 'إضافة شفت OT' : 'Add OT shift' })}
      size="sm"
    >
      <div className="space-y-4">
        <Input label={t('common:lateSchedule.form.title', { defaultValue: isRtl ? 'اسم الشفت' : 'Shift title' })} value={form.title} error={errors.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <label className="block text-sm font-medium text-text-primary">
          <span className="mb-1.5 block">{isRtl ? 'الوحدة' : 'Unit'}</span>
          <select
            className="input-field min-h-11"
            value={form.unitId || ''}
            onChange={(event) => {
              const unit = units.find((item) => item.id === event.target.value);
              setForm({ ...form, unitId: event.target.value, location: unit?.name || form.location });
            }}
          >
            {units.filter((unit) => !unit.archived).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </label>
        <Input label={t('common:lateSchedule.form.location', { defaultValue: isRtl ? 'الموقع' : 'Location' })} value={form.location} error={errors.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <Input label={t('common:lateSchedule.form.timeRange', { defaultValue: isRtl ? 'الوقت' : 'Time range' })} value={form.timeRange} error={errors.timeRange} placeholder="17:00-21:00" dir="ltr" onChange={(event) => setForm({ ...form, timeRange: event.target.value })} />
        <Input label={t('common:lateSchedule.form.hours', { defaultValue: isRtl ? 'الساعات' : 'Hours' })} value={form.hours || ''} error={errors.hours} type="number" min="0.5" step="0.5" onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={isRtl ? 'الكود المختصر' : 'Short code'} value={form.shortCode || ''} onChange={(event) => setForm({ ...form, shortCode: event.target.value })} />
          <Input label={isRtl ? 'الأيقونة' : 'Icon'} value={form.icon || ''} onChange={(event) => setForm({ ...form, icon: event.target.value })} />
          <Input label={isRtl ? 'لون الخلفية' : 'Background color'} type="color" value={form.backgroundColor || '#E0F2FE'} onChange={(event) => setForm({ ...form, backgroundColor: event.target.value })} />
          <Input label={isRtl ? 'لون النص' : 'Text color'} type="color" value={form.textColor || '#075985'} onChange={(event) => setForm({ ...form, textColor: event.target.value })} />
        </div>

        {row && onArchive && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            {!confirmArchive ? (
              <Button variant="danger" className="min-h-11" onClick={() => setConfirmArchive(true)}>
                {t('common:lateSchedule.form.archive', { defaultValue: isRtl ? 'أرشفة شفت OT' : 'Archive OT shift' })}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-danger">{t('common:lateSchedule.form.archiveConfirmText', { defaultValue: isRtl ? 'هل تريد أرشفة هذا الشفت؟' : 'Archive this shift?' })}</span>
                <Button variant="danger" className="min-h-11" onClick={onArchive}>
                  {t('common:lateSchedule.form.confirmArchive', { defaultValue: isRtl ? 'تأكيد الأرشفة' : 'Confirm archive' })}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" className="min-h-11" onClick={onClose}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          <Button className="min-h-11" onClick={submit}>
            {t('common:lateSchedule.form.save', { defaultValue: isRtl ? 'حفظ شفت OT' : 'Save OT shift' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
