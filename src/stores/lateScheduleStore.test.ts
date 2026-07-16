import { describe, expect, it } from 'vitest';
import { createLateScheduleStore, LATE_SCHEDULE_STORAGE_KEY, V3_LATE_SCHEDULE_STORAGE_KEY, V4_LATE_SCHEDULE_STORAGE_KEY } from './lateScheduleStore';
import type { LateScheduleStorage } from './lateScheduleStore';
import type { OTShiftRow } from '@/types/lateSchedule';
import { isActiveLateScheduleRow, orderLateScheduleRows } from '@/lib/lateScheduleOrder';

class MemoryStorage implements LateScheduleStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class FailingStorage extends MemoryStorage {
  setItem() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }
}

class ToggleFailingStorage extends MemoryStorage {
  shouldFail = false;
  setItem(key: string, value: string) {
    if (this.shouldFail) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    super.setItem(key, value);
  }
}

const row = (assignments: OTShiftRow['assignments'] = {}): OTShiftRow => ({
  id: 'row-1',
  title: 'Late shift',
  location: 'KASCH',
  timeRange: '17:00-21:00',
  hours: 4,
  assignments,
});

describe('lateScheduleStore v5 administration', () => {
  it('migrates v3 rows to units and preserves all assignments', () => {
    const storage = new MemoryStorage();
    storage.setItem(V3_LATE_SCHEDULE_STORAGE_KEY, JSON.stringify({
      version: 3,
      currentYear: 2026,
      currentMonth: 6,
      notice: 'notice',
      rowsByMonth: {
        '2026-07': [row({
          1: [
            { kind: 'employee', employeeId: 'e1' },
            { kind: 'employee', employeeId: 'e2' },
            { kind: 'employee', employeeId: 'e3' },
          ],
        })],
      },
    }));

    const store = createLateScheduleStore({ storage });
    expect(store.getState().rows[0].assignments[1]).toHaveLength(3);
    expect(store.getState().units[0].name).toBe('KASCH');
    expect(store.getState().rows[0].unitId).toBe(store.getState().units[0].id);
    expect(JSON.parse(storage.getItem(LATE_SCHEDULE_STORAGE_KEY) || '{}').version).toBe(5);
  });

  it('migrates the last published v4 snapshot without exposing later draft edits', () => {
    const storage = new MemoryStorage();
    const published = row({ 1: [{ kind: 'employee', employeeId: 'published-employee' }] });
    const draft = row({ 1: [{ kind: 'employee', employeeId: 'draft-employee' }] });
    storage.setItem(V4_LATE_SCHEDULE_STORAGE_KEY, JSON.stringify({
      version: 4,
      currentYear: 2026,
      currentMonth: 6,
      notice: 'notice',
      rowsByMonth: { '2026-07': [draft] },
      unitsByMonth: { '2026-07': [{ id: 'unit-1', name: 'KASCH' }] },
      monthStatuses: { '2026-07': 'draft' },
      versionsByMonth: {
        '2026-07': [{
          id: 'published-version', createdAt: '2026-07-01T00:00:00.000Z', actorName: 'Admin', reason: 'publish',
          rows: [published], units: [{ id: 'unit-1', name: 'KASCH' }], notice: 'notice',
        }],
      },
      deletedMonths: [],
    }));

    const store = createLateScheduleStore({ storage });
    expect(store.getState().rows[0].assignments[1]).toEqual([{ kind: 'employee', employeeId: 'draft-employee' }]);
    expect(store.getState().publishedRowsByMonth['2026-07'][0].assignments[1])
      .toEqual([{ kind: 'employee', employeeId: 'published-employee' }]);
    expect(store.getState().departmentIdsByMonth['2026-07']).toBe('dept-1');
    expect(JSON.parse(storage.getItem(LATE_SCHEDULE_STORAGE_KEY) || '{}').version).toBe(5);
  });

  it('keeps employee-facing OT unchanged until Publish creates a new snapshot', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row({ 1: [{ kind: 'employee', employeeId: 'employee-1' }] })] },
    });

    expect(store.getState().setCellAssignments('row-1', 1, ['employee-2']).ok).toBe(true);
    expect(store.getState().publishedRowsByMonth['2026-07'][0].assignments[1])
      .toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);

    expect(store.getState().publishCurrentMonth('Admin').ok).toBe(true);
    expect(store.getState().publishedRowsByMonth['2026-07'][0].assignments[1])
      .toEqual([{ kind: 'employee', employeeId: 'employee-2' }]);
  });

  it('reloads a published OT snapshot for another tab without changing that tab month', () => {
    const storage = new MemoryStorage();
    const firstTab = createLateScheduleStore({
      storage,
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });
    const secondTab = createLateScheduleStore({ storage });
    secondTab.getState().setMonth(2026, 7);

    firstTab.getState().setCellAssignments('row-1', 1, ['employee-2']);
    firstTab.getState().publishCurrentMonth('Admin');
    secondTab.getState().reloadFromStorage();

    expect(secondTab.getState().month).toBe(7);
    expect(secondTab.getState().publishedRowsByMonth['2026-07'][0].assignments[1])
      .toEqual([{ kind: 'employee', employeeId: 'employee-2' }]);
  });

  it('accepts unlimited unique employees in one cell', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });
    const employeeIds = Array.from({ length: 50 }, (_, index) => `employee-${index + 1}`);
    const result = store.getState().setCellAssignments('row-1', 1, [...employeeIds, 'employee-1']);
    expect(result.ok).toBe(true);
    expect(store.getState().rows[0].assignments[1]).toHaveLength(50);
  });

  it('keeps clear, reset and delete independent and retains five recovery versions', () => {
    const storage = new MemoryStorage();
    const store = createLateScheduleStore({
      storage,
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });

    for (let index = 0; index < 6; index += 1) {
      store.getState().setCellAssignments('row-1', 1, [`employee-${index}`]);
      expect(store.getState().clearAllAssignments().ok).toBe(true);
    }
    expect(store.getState().versionsByMonth['2026-07']).toHaveLength(5);
    expect(store.getState().rows).toHaveLength(1);

    expect(store.getState().resetCurrentMonth().ok).toBe(true);
    expect(store.getState().rows.every((item) => Object.keys(item.assignments).length === 0)).toBe(true);

    const reloaded = createLateScheduleStore({ storage });
    expect(reloaded.getState().rows.every((item) => Object.keys(item.assignments).length === 0)).toBe(true);
  });

  it('treats a legacy locked OT month as published and keeps it editable', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });
    expect(store.getState().publishCurrentMonth().ok).toBe(true);
    store.setState({ monthStatuses: { '2026-07': 'locked' as never } });
    expect(store.getState().currentMonthStatus()).toBe('published');
    expect(store.getState().setCellAssignments('row-1', 1, ['employee-1']).ok).toBe(true);
  });

  it('persists unit order and moves a shift between OT units without losing assignments', () => {
    const storage = new MemoryStorage();
    const store = createLateScheduleStore({
      storage,
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: {
        '2026-07': [
          row({ 1: [{ kind: 'employee', employeeId: 'employee-1' }] }),
          { ...row(), id: 'row-2', title: 'Second KASCH shift' },
          { ...row(), id: 'row-3', title: 'Cardiac shift', location: 'CARD' },
        ],
      },
    });
    const [kaschUnit, cardUnit] = store.getState().units;

    expect(store.getState().reorderUnit(cardUnit.id, kaschUnit.id, 'before').ok).toBe(true);
    expect(store.getState().units.map((unit) => unit.id)).toEqual([cardUnit.id, kaschUnit.id]);

    expect(store.getState().reorderRow('row-1', cardUnit.id, 'row-3', 'before').ok).toBe(true);
    const moved = store.getState().rows.find((item) => item.id === 'row-1')!;
    expect(moved.unitId).toBe(cardUnit.id);
    expect(moved.location).toBe(cardUnit.name);
    expect(moved.assignments[1]).toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);

    const reloaded = createLateScheduleStore({ storage });
    expect(reloaded.getState().units.map((unit) => unit.id)).toEqual([cardUnit.id, kaschUnit.id]);
    const reloadedRows = reloaded.getState().rows;
    expect(reloadedRows.findIndex((item) => item.id === 'row-1')).toBe(reloadedRows.findIndex((item) => item.id === 'row-3') - 1);
    expect(reloadedRows.find((item) => item.id === 'row-1')!.assignments[1]).toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);
  });

  it('copies and pastes a complete OT table across months while preserving its snapshot, order and colors', () => {
    const storage = new MemoryStorage();
    const sourceRows: OTShiftRow[] = [
      {
        ...row({
          1: [{ kind: 'employee', employeeId: 'employee-1' }],
          31: [
            { kind: 'employee', employeeId: 'employee-31' },
            { kind: 'unresolved', legacyCode: 'LEGACY-31' },
          ],
        }),
        id: 'row-card',
        title: 'Cardiac late shift',
        location: 'CARD',
        backgroundColor: '#7C3AED',
        textColor: '#FFFFFF',
        shortCode: 'CL',
        icon: 'moon',
        highlightedDays: [1, 31],
      },
      {
        ...row({ 2: [{ kind: 'employee', employeeId: 'employee-2' }] }),
        id: 'row-kasch',
        title: 'KASCH late shift',
      },
    ];
    const store = createLateScheduleStore({
      storage,
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': sourceRows },
    });

    expect(store.getState().copyCurrentTable()).toMatchObject({
      ok: true,
      affected: 4,
      omittedAssignments: 0,
      sourceKey: '2026-07',
    });
    expect(store.getState().tableClipboard?.units.map((unit) => unit.name)).toEqual(['CARD', 'KASCH']);

    // Copy is a real snapshot: later source edits must not change it.
    expect(store.getState().setCellAssignments('row-card', 1, ['changed-after-copy']).ok).toBe(true);
    store.getState().setMonth(2027, 1);
    const paste = store.getState().pasteCopiedTable('Admin');

    expect(paste).toMatchObject({
      ok: true,
      affected: 2,
      omittedAssignments: 2,
      sourceKey: '2026-07',
      targetKey: '2027-02',
    });
    expect(store.getState().units.map((unit) => unit.name)).toEqual(['CARD', 'KASCH']);
    expect(store.getState().rows.map((item) => item.id)).toEqual(['row-card', 'row-kasch']);
    const pastedCard = store.getState().rows[0];
    expect(pastedCard.backgroundColor).toBe('#7C3AED');
    expect(pastedCard.textColor).toBe('#FFFFFF');
    expect(pastedCard.shortCode).toBe('CL');
    expect(pastedCard.icon).toBe('moon');
    expect(pastedCard.highlightedDays).toEqual([1]);
    expect(pastedCard.assignments[1]).toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);
    expect(pastedCard.assignments[31]).toBeUndefined();
    expect(store.getState().rows[1].assignments[2]).toEqual([{ kind: 'employee', employeeId: 'employee-2' }]);
    expect(store.getState().monthStatuses['2027-02']).toBe('draft');
    expect(store.getState().versionsByMonth['2027-02'][0].reason).toBe('paste');
    expect(store.getState().tableClipboard?.sourceKey).toBe('2026-07');

    const persisted = JSON.parse(storage.getItem(LATE_SCHEDULE_STORAGE_KEY) || '{}');
    expect(persisted.rowsByMonth['2027-02'][0].assignments['31']).toBeUndefined();
    expect(persisted.tableClipboard).toBeUndefined();

    const reloaded = createLateScheduleStore({ storage });
    expect(reloaded.getState().rows[0].backgroundColor).toBe('#7C3AED');
    expect(reloaded.getState().rows[0].assignments[1]).toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);
    expect(reloaded.getState().tableClipboard).toBeNull();
  });

  it('rolls back a failed OT table paste and keeps the in-memory clipboard available', () => {
    const storage = new ToggleFailingStorage();
    const target = { ...row({ 3: [{ kind: 'employee', employeeId: 'target-employee' }] }), id: 'target-row', title: 'Existing target' };
    const store = createLateScheduleStore({
      storage,
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: {
        '2026-07': [row({ 1: [{ kind: 'employee', employeeId: 'source-employee' }] })],
        '2026-08': [target],
      },
    });

    expect(store.getState().copyCurrentTable().ok).toBe(true);
    store.getState().setMonth(2026, 7);
    const before = {
      rows: store.getState().rows,
      units: store.getState().units,
      rowsByMonth: store.getState().rowsByMonth,
      unitsByMonth: store.getState().unitsByMonth,
      monthStatuses: store.getState().monthStatuses,
      versionsByMonth: store.getState().versionsByMonth,
      publishedRowsByMonth: store.getState().publishedRowsByMonth,
      publishedUnitsByMonth: store.getState().publishedUnitsByMonth,
      departmentIdsByMonth: store.getState().departmentIdsByMonth,
      deletedMonths: store.getState().deletedMonths,
    };
    storage.shouldFail = true;

    expect(store.getState().pasteCopiedTable('Admin')).toEqual({
      ok: false,
      reason: 'storage_error',
      message: 'Unable to save OT administration data.',
    });
    expect(store.getState().rows).toEqual(before.rows);
    expect(store.getState().units).toEqual(before.units);
    expect(store.getState().rowsByMonth).toEqual(before.rowsByMonth);
    expect(store.getState().unitsByMonth).toEqual(before.unitsByMonth);
    expect(store.getState().monthStatuses).toEqual(before.monthStatuses);
    expect(store.getState().versionsByMonth).toEqual(before.versionsByMonth);
    expect(store.getState().publishedRowsByMonth).toEqual(before.publishedRowsByMonth);
    expect(store.getState().publishedUnitsByMonth).toEqual(before.publishedUnitsByMonth);
    expect(store.getState().departmentIdsByMonth).toEqual(before.departmentIdsByMonth);
    expect(store.getState().deletedMonths).toEqual(before.deletedMonths);
    expect(store.getState().storageError).toBeTruthy();
    expect(store.getState().tableClipboard?.sourceKey).toBe('2026-07');
  });

  it('rejects OT paste cleanly when no table has been copied', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });

    expect(store.getState().pasteCopiedTable()).toMatchObject({ ok: false, reason: 'no_clipboard' });
    expect(store.getState().versionsByMonth['2026-07']).toBeUndefined();
  });

  it('applies and clears unlimited employees across an OT day range', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });
    const ids = Array.from({ length: 10 }, (_, index) => `employee-${index}`);
    expect(store.getState().setRangeAssignments('row-1', 2, 5, ids).ok).toBe(true);
    for (let day = 2; day <= 5; day += 1) expect(store.getState().rows[0].assignments[day]).toHaveLength(10);
    expect(store.getState().clearRangeAssignments('row-1', 3, 4).ok).toBe(true);
    expect(store.getState().rows[0].assignments[2]).toHaveLength(10);
    expect(store.getState().rows[0].assignments[3]).toBeUndefined();
    expect(store.getState().rows[0].assignments[4]).toBeUndefined();
    expect(store.getState().rows[0].assignments[5]).toHaveLength(10);
  });

  it('excludes rows in archived OT units from every active ordered view', () => {
    const store = createLateScheduleStore({
      storage: new MemoryStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: {
        '2026-07': [
          row(),
          { ...row(), id: 'row-card', title: 'Cardiac shift', location: 'CARD' },
        ],
      },
    });
    const cardUnit = store.getState().units.find((unit) => unit.name === 'CARD')!;
    expect(store.getState().archiveUnit(cardUnit.id).ok).toBe(true);

    const activeRows = orderLateScheduleRows(store.getState().rows, store.getState().units)
      .filter((item) => isActiveLateScheduleRow(item, store.getState().units));
    expect(activeRows.map((item) => item.id)).toEqual(['row-1']);
  });

  it('rolls back an OT mutation and reports storage failure when persistence is full', () => {
    const store = createLateScheduleStore({
      storage: new FailingStorage(),
      initialYear: 2026,
      initialMonth: 6,
      initialRowsByMonth: { '2026-07': [row()] },
    });
    const result = store.getState().setCellAssignments('row-1', 1, ['employee-1']);
    expect(result).toEqual({ ok: false, reason: 'storage_error' });
    expect(store.getState().rows[0].assignments[1]).toBeUndefined();
    expect(store.getState().storageError).toBeTruthy();
  });
});
