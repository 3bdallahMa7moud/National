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
  const [form, setForm] = useState<OTShiftInput>({ title: '', location: '', timeRange: '17:00-21:00', hours: 4, backgroundColor: '#E0F2FE', textColor: '#075985' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmArchive, setConfirmArchive] = useState(false);
  const activeUnits = units.filter((unit) => !unit.archived);

  const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  useEffect(() => {
    if (!isOpen) return;
    const firstUnit = activeUnits[0];
    setForm(row
      ? {
        unitId: row.unitId,
        title: row.title,
        location: row.location || firstUnit?.name || 'General OT',
        timeRange: row.timeRange || '17:00-21:00',
        hours: row.hours || 4,
        backgroundColor: row.backgroundColor || '#E0F2FE',
        textColor: row.textColor || '#075985',
        shortCode: row.shortCode || '',
        icon: row.icon || '',
      }
      : {
        unitId: firstUnit?.id,
        title: '',
        location: firstUnit?.name || 'General OT',
        timeRange: '17:00-21:00',
        hours: 4,
        backgroundColor: '#E0F2FE',
        textColor: '#075985',
        shortCode: '',
        icon: '',
      });
    setErrors({});
    setConfirmArchive(false);
  }, [activeUnits, isOpen, row, units]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.title.trim()) next.title = t('common:lateSchedule.validation.titleRequired', { defaultValue: isRtl ? 'اسم الشفت مطلوب' : 'Shift title is required' });
    if (!form.timeRange.trim()) next.timeRange = t('common:lateSchedule.validation.timeRequired', { defaultValue: isRtl ? 'الوقت مطلوب' : 'Time range is required' });
    return next;
  };

  const submit = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const selectedUnitName = units.find((u) => u.id === form.unitId)?.name || form.location.trim() || form.title.trim() || 'General OT';
    onSave({
      title: form.title.trim(),
      location: selectedUnitName,
      timeRange: form.timeRange.trim() || '17:00-21:00',
      hours: form.hours,
      unitId: form.unitId,
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      shortCode: form.shortCode?.trim(),
      icon: form.icon?.trim(),
    });
  };

  const [fromTime = '17:00', toTime = '21:00'] = form.timeRange.split('-');
  const selectedUnitName = units.find((unit) => unit.id === form.unitId)?.name || form.location || 'General OT';

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
            className="input-field min-h-11 w-full"
            value={form.unitId || ''}
            disabled={activeUnits.length === 0}
            onChange={(event) => {
              const unit = units.find((item) => item.id === event.target.value);
              setForm({ ...form, unitId: event.target.value, location: unit?.name || form.location });
            }}
          >
            {activeUnits.length === 0
              ? <option value="">{isRtl ? 'لا توجد وحدات متاحة بعد' : 'No units available yet'}</option>
              : activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </label>
        {activeUnits.length === 0 && (
          <p className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
            {isRtl
              ? 'أضف وحدة OT أولاً من قسم إدارة الوحدات، أو احفظ الشفت الآن وسيُستخدم موقع عام مؤقتًا.'
              : 'Add an OT unit first from the management section, or save now and this shift will use a temporary general location.'}
          </p>
        )}
        <div className="rounded-xl border border-border bg-surface-muted px-3 py-2.5">
          <p className="text-xs font-bold text-text-primary">{isRtl ? 'الموقع الحالي' : 'Current location'}</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{selectedUnitName}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {isRtl
              ? 'تغيير الوحدة يحدّث اسم الموقع المعروض لهذا الشفت في الجدول والتصدير.'
              : 'Changing the unit updates the location label shown for this shift in the schedule and exports.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            {t('common:lateSchedule.form.timeRange', { defaultValue: isRtl ? 'الوقت' : 'Time range' })}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1">{isRtl ? 'من (From)' : 'From'}</span>
              <select
                className="input-field min-h-11 w-full"
                value={fromTime || '17:00'}
                onChange={(event) => {
                  const newStart = event.target.value;
                  const currentEnd = toTime || '21:00';
                  const startHour = parseInt(newStart.split(':')[0], 10);
                  const endHour = parseInt(currentEnd.split(':')[0], 10);
                  let diff = endHour - startHour;
                  if (diff <= 0) diff += 24;
                  setForm({
                    ...form,
                    timeRange: `${newStart}-${currentEnd}`,
                    hours: diff > 0 ? diff : form.hours,
                  });
                }}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1">{isRtl ? 'إلى (To)' : 'To'}</span>
              <select
                className="input-field min-h-11 w-full"
                value={toTime || '21:00'}
                onChange={(event) => {
                  const newEnd = event.target.value;
                  const currentStart = fromTime || '17:00';
                  const startHour = parseInt(currentStart.split(':')[0], 10);
                  const endHour = parseInt(newEnd.split(':')[0], 10);
                  let diff = endHour - startHour;
                  if (diff <= 0) diff += 24;
                  setForm({
                    ...form,
                    timeRange: `${currentStart}-${newEnd}`,
                    hours: diff > 0 ? diff : form.hours,
                  });
                }}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
          {errors.timeRange && <p className="mt-1 text-xs text-danger">{errors.timeRange}</p>}
        </div>


        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-danger">{t('common:lateSchedule.form.archiveConfirmText', { defaultValue: isRtl ? 'هل تريد أرشفة هذا الشفت؟' : 'Archive this shift?' })}</span>
                <Button variant="danger" className="min-h-11" onClick={onArchive}>
                  {t('common:lateSchedule.form.confirmArchive', { defaultValue: isRtl ? 'تأكيد الأرشفة' : 'Confirm archive' })}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="min-h-11" onClick={onClose}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          <Button className="min-h-11" onClick={submit}>
            {t('common:lateSchedule.form.save', { defaultValue: isRtl ? 'حفظ شفت OT' : 'Save OT shift' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
