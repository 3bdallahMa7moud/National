// ============================================================
// useScheduleMatrix — Hook connecting store + derived state
// ============================================================
// Used by AdminSchedulePage. No network calls.

import { useEffect, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { resolveScheduleMatrixLocale } from '@/lib/scheduleMatrixLocale';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { Facility } from '@/types/scheduleMatrix';

export function useScheduleMatrix() {
  const { language } = useLanguage();
  const store = useScheduleMatrixStore();
  const setLocale = useScheduleMatrixStore((s) => s.setLocale);
  const loadMonth = useScheduleMatrixStore((s) => s.loadMonth);
  const month = useScheduleMatrixStore((s) => s.month);
  const year = useScheduleMatrixStore((s) => s.year);

  useEffect(() => {
    loadMonth(month, year);
  }, [loadMonth, month, year]);

  useEffect(() => {
    setLocale(language);
  }, [language, setLocale]);

  const data = useMemo(
    () => (store.data ? resolveScheduleMatrixLocale(store.data, language) : null),
    [store.data, language],
  );

  const filteredFacilities = useMemo<Facility[]>(() => {
    if (!data) return [];
    const facilities = store.facilityFilter
      ? data.facilities.filter((f) => f.id === store.facilityFilter)
      : data.facilities;

    return facilities.map((facility) => ({
      ...facility,
      units: facility.units.filter((unit) => !unit.archived),
    }));
  }, [data, store.facilityFilter]);

  const totalRows = useMemo(() => {
    let count = 0;
    for (const f of filteredFacilities) {
      for (const u of f.units) {
        count += u.rows.length;
      }
    }
    return count;
  }, [filteredFacilities]);

  const daysInMonth = useMemo(
    () => new Date(store.year, store.month + 1, 0).getDate(),
    [store.year, store.month],
  );

  const conflictCount = store.conflictCount();
  const isDirty = store.isDirty();
  const pendingDraftCount = store.pendingDraftCount();

  const goToPrevMonth = () => {
    if (store.month === 0) {
      store.loadMonth(11, store.year - 1);
    } else {
      store.loadMonth(store.month - 1, store.year);
    }
  };

  const goToNextMonth = () => {
    if (store.month === 11) {
      store.loadMonth(0, store.year + 1);
    } else {
      store.loadMonth(store.month + 1, store.year);
    }
  };

  return {
    ...store,
    data,
    filteredFacilities,
    totalRows,
    daysInMonth,
    conflictCount,
    isDirty,
    pendingDraftCount,
    goToPrevMonth,
    goToNextMonth,
  };
}
