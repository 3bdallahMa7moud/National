import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCHEDULE_ADMIN_CONTROL_STORAGE_KEY,
  SCHEDULE_MATRIX_HISTORY_STORAGE_KEY,
  SCHEDULE_MONTHLY_STORAGE_KEY,
  useScheduleMatrixStore,
} from './scheduleMatrixStore';
import { mergeBrushAssignments } from '@/lib/scheduleAssignments';

describe('scheduleMatrixStore administration', () => {
  beforeEach(() => {
    localStorage.clear();
    useScheduleMatrixStore.setState({
      matricesByMonth: {},
      draftsByMonth: {},
      monthStatuses: {},
      versionsByMonth: {},
      tableClipboard: null,
      deletedMonths: [],
      storageError: null,
      draftCellKeys: [],
      undoStack: [],
    });
    useScheduleMatrixStore.getState().loadMonth(6, 2026);
  });

  it('stores many unique employees in one cell and removes duplicates', () => {
    const state = useScheduleMatrixStore.getState();
    const row = state.data!.facilities[0].units[0].rows[0];
    const assignments = Array.from({ length: 50 }, (_, index) => ({
      employeeId: `employee-${index + 1}`,
      employeeCode: `E${index + 1}`,
    }));
    state.assignCell(row.id, 1, [...assignments, assignments[0]]);
    const updated = useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0];
    expect(updated.cellsByDay[1]).toHaveLength(50);
  });

  it('allows the brush to select an unlimited employee group', () => {
    const store = useScheduleMatrixStore.getState();
    Array.from({ length: 50 }, (_, index) => `E${index + 1}`).forEach((code) => {
      expect(store.toggleBrushEmployeeCode(code)).toEqual({ ok: true });
    });
    expect(useScheduleMatrixStore.getState().brushEmployeeCodes).toHaveLength(50);
  });

  it('merges 50 brush employees into one cell without duplicates or a cell limit', () => {
    const employees = Array.from({ length: 50 }, (_, index) => ({
      employeeId: `employee-${index + 1}`,
      code: `E${index + 1}`,
    }));
    const result = mergeBrushAssignments(
      [{ employeeId: employees[0].employeeId, employeeCode: employees[0].code }],
      [...employees, employees[0]],
    );
    expect(result).toMatchObject({ ok: true, changed: true });
    if (result.ok) expect(result.assignments).toHaveLength(50);
  });

  it('requires an explicit destructive choice before deleting a unit with assignments', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units.find((candidate) => candidate.rows.some((row) =>
      Object.values(row.cellsByDay).some((assignments) => assignments.length > 0),
    ))!;
    const affectedAssignments = unit.rows.reduce((total, row) => total
      + Object.values(row.cellsByDay).reduce((rowTotal, assignments) => rowTotal + assignments.length, 0), 0);

    expect(state.deleteUnit(facility.id, unit.id)).toEqual({
      ok: false,
      reason: 'has_assignments',
      affectedAssignments,
    });
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units.some((candidate) => candidate.id === unit.id)).toBe(true);

    expect(useScheduleMatrixStore.getState().deleteUnit(facility.id, unit.id, true, 'Admin')).toEqual({
      ok: true,
      affectedAssignments,
    });
    const updated = useScheduleMatrixStore.getState().data!.facilities[0];
    expect(updated.units.some((candidate) => candidate.id === unit.id)).toBe(false);
    expect(useScheduleMatrixStore.getState().data!.settings[0].units.some((candidate) => candidate.id === unit.id)).toBe(false);
  });

  it('rolls back a unit deletion and reports storage_error when persistence fails', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const beforeUnits = JSON.parse(JSON.stringify(facility.units));
    const beforeDefinitions = JSON.parse(JSON.stringify(state.data!.settings[0].units));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = state.deleteUnit(facility.id, unit.id, true, 'Admin');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units).toEqual(beforeUnits);
    expect(useScheduleMatrixStore.getState().data!.settings[0].units).toEqual(beforeDefinitions);
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
  });

  it('propagates background and text colors to every matching shift type and linked row, then persists them', async () => {
    const state = useScheduleMatrixStore.getState();
    const sourceSettings = state.data!.settings[0];
    const sourceShift = sourceSettings.shiftDefinitions.find((definition) => definition.colorKey === 'morning')!;
    const matchingDefinitionIds = new Set(
      state.data!.settings
        .flatMap((settings) => settings.shiftDefinitions)
        .filter((definition) => definition.colorKey === sourceShift.colorKey)
        .map((definition) => definition.id),
    );
    expect(matchingDefinitionIds.size).toBeGreaterThan(1);

    state.updateShiftDefinition(sourceSettings.facilityId, sourceShift.id, {
      backgroundColor: '#7C3AED',
      textColor: '#FFFFFF',
    });

    const matchingDefinitions = useScheduleMatrixStore.getState().data!.settings
      .flatMap((settings) => settings.shiftDefinitions)
      .filter((definition) => matchingDefinitionIds.has(definition.id));
    expect(matchingDefinitions.every((definition) => definition.backgroundColor === '#7C3AED')).toBe(true);
    expect(matchingDefinitions.every((definition) => definition.textColor === '#FFFFFF')).toBe(true);

    const linkedRows = useScheduleMatrixStore.getState().data!.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .filter((row) => !!row.shiftDefinitionId && matchingDefinitionIds.has(row.shiftDefinitionId));
    expect(linkedRows.length).toBeGreaterThan(1);
    expect(linkedRows.every((row) => row.backgroundColor === '#7C3AED')).toBe(true);
    expect(linkedRows.every((row) => row.textColor === '#FFFFFF')).toBe(true);

    // A text-only edit must propagate without clearing or changing the shared background.
    useScheduleMatrixStore.getState().updateShiftDefinition(sourceSettings.facilityId, sourceShift.id, {
      textColor: '#FDE047',
    });
    const afterTextOnly = useScheduleMatrixStore.getState().data!;
    expect(afterTextOnly.settings
      .flatMap((settings) => settings.shiftDefinitions)
      .filter((definition) => matchingDefinitionIds.has(definition.id))
      .every((definition) => definition.backgroundColor === '#7C3AED' && definition.textColor === '#FDE047')).toBe(true);
    expect(afterTextOnly.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .filter((row) => !!row.shiftDefinitionId && matchingDefinitionIds.has(row.shiftDefinitionId))
      .every((row) => row.backgroundColor === '#7C3AED' && row.textColor === '#FDE047')).toBe(true);

    vi.resetModules();
    const reloadedModule = await import('./scheduleMatrixStore');
    reloadedModule.useScheduleMatrixStore.getState().loadMonth(6, 2026);
    const reloaded = reloadedModule.useScheduleMatrixStore.getState().data!;
    expect(reloaded.settings
      .flatMap((settings) => settings.shiftDefinitions)
      .filter((definition) => matchingDefinitionIds.has(definition.id))
      .every((definition) => definition.backgroundColor === '#7C3AED' && definition.textColor === '#FDE047')).toBe(true);
    expect(reloaded.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .filter((row) => !!row.shiftDefinitionId && matchingDefinitionIds.has(row.shiftDefinitionId))
      .every((row) => row.backgroundColor === '#7C3AED' && row.textColor === '#FDE047')).toBe(true);
  });

  it('makes new definitions inherit the shared type color and preserves the target type color when changing presets', () => {
    const state = useScheduleMatrixStore.getState();
    const sourceSettings = state.data!.settings[0];
    const targetSettings = state.data!.settings[state.data!.settings.length - 1];
    const morning = sourceSettings.shiftDefinitions.find((definition) => definition.colorKey === 'morning')!;
    const night = sourceSettings.shiftDefinitions.find((definition) => definition.colorKey === 'night')!;

    state.updateShiftDefinition(sourceSettings.facilityId, morning.id, {
      backgroundColor: '#14532D',
      textColor: '#F0FDF4',
    });
    useScheduleMatrixStore.getState().updateShiftDefinition(sourceSettings.facilityId, night.id, {
      backgroundColor: '#312E81',
      textColor: '#EEF2FF',
    });
    useScheduleMatrixStore.getState().addShiftDefinition(targetSettings.facilityId, {
      label: 'Extra Day Shift',
      englishName: 'Extra Day Shift',
      arabicName: 'شفت نهاري إضافي',
      timeRange: '09:00 - 18:00',
      startTime: '09:00',
      endTime: '18:00',
      colorKey: 'morning',
      effectiveFromDay: 1,
    });

    const added = useScheduleMatrixStore.getState().data!.settings
      .find((settings) => settings.facilityId === targetSettings.facilityId)!
      .shiftDefinitions.find((definition) => definition.label === 'Extra Day Shift')!;
    expect(added).toMatchObject({ backgroundColor: '#14532D', textColor: '#F0FDF4' });

    useScheduleMatrixStore.getState().updateShiftDefinition(targetSettings.facilityId, added.id, {
      colorKey: 'night',
      backgroundColor: undefined,
      textColor: undefined,
    });
    const nightDefinitions = useScheduleMatrixStore.getState().data!.settings
      .flatMap((settings) => settings.shiftDefinitions)
      .filter((definition) => definition.colorKey === 'night');
    expect(nightDefinitions.every((definition) => (
      definition.backgroundColor === '#312E81' && definition.textColor === '#EEF2FF'
    ))).toBe(true);
  });

  it('treats a legacy locked month as published and allows edits immediately', () => {
    const state = useScheduleMatrixStore.getState();
    const row = state.data!.facilities[0].units[0].rows[0];
    state.assignCell(row.id, 1, [{ employeeId: 'employee-1', employeeCode: 'E1' }]);
    expect(useScheduleMatrixStore.getState().publishDrafts().ok).toBe(true);
    useScheduleMatrixStore.setState({ monthStatuses: { '2026-07': 'locked' as never } });
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('published');
    useScheduleMatrixStore.getState().clearCell(row.id, 1);
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0].cellsByDay[1]).toHaveLength(0);
  });

  it('retains five recovery versions and publishes a reset month', () => {
    for (let index = 0; index < 5; index += 1) {
      expect(useScheduleMatrixStore.getState().resetCurrentMonth('Admin').ok).toBe(true);
    }
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07']).toHaveLength(5);
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('draft');

    const publish = useScheduleMatrixStore.getState().publishDrafts();
    expect(publish).toMatchObject({ ok: true });
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('published');
    expect(useScheduleMatrixStore.getState().matricesByMonth['2026-07']).toBeTruthy();
  });

  it('creates a recovery version before deleting and does not regenerate the deleted month', () => {
    const beforeFacilities = useScheduleMatrixStore.getState().data!.facilities.length;
    expect(beforeFacilities).toBeGreaterThan(0);
    expect(useScheduleMatrixStore.getState().deleteCurrentMonth('Admin').ok).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.facilities).toEqual([]);
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07']).toHaveLength(1);

    useScheduleMatrixStore.getState().loadMonth(6, 2026);
    expect(useScheduleMatrixStore.getState().data!.facilities).toEqual([]);
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07'][0].data.facilities).toHaveLength(beforeFacilities);
  });

  it('copies a schedule snapshot into another month with assignments, colors and manual order intact', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities.find((item) => item.units.length > 1)!;
    const sourceUnit = facility.units[0];
    const targetUnit = facility.units[1];
    const sourceRow = sourceUnit.rows.find((row) => !!row.shiftDefinitionId)!;

    state.updateShiftDefinition(facility.id, sourceRow.shiftDefinitionId!, {
      backgroundColor: '#2563EB',
      textColor: '#FEF08A',
    });
    state.reorderMatrixItem({
      kind: 'unit',
      facilityId: facility.id,
      sourceUnitId: sourceUnit.id,
      targetUnitId: targetUnit.id,
      position: 'after',
    });
    expect(state.assignCell(sourceRow.id, 1, [{ employeeId: 'employee-copy-1', employeeCode: 'CP1' }]).ok).toBe(true);
    expect(state.assignCell(sourceRow.id, 31, [
      { employeeId: 'employee-copy-31-a', employeeCode: 'CP31A' },
      { employeeId: 'employee-copy-31-b', employeeCode: 'CP31B' },
    ]).ok).toBe(true);

    const sourceAfterEdits = useScheduleMatrixStore.getState().data!;
    const expectedUnitOrder = sourceAfterEdits.facilities
      .find((item) => item.id === facility.id)!
      .units.map((unit) => unit.id);
    const expectedSettingsOrder = sourceAfterEdits.settings
      .find((settings) => settings.facilityId === facility.id)!
      .shiftDefinitions.map((definition) => definition.id);
    const copy = useScheduleMatrixStore.getState().copyCurrentTable('Admin');
    expect(copy.ok).toBe(true);
    expect(useScheduleMatrixStore.getState().tableClipboard?.sourceKey).toBe('2026-07');

    // The clipboard must remain a snapshot even if the source changes afterwards.
    useScheduleMatrixStore.getState().clearCell(sourceRow.id, 1);
    useScheduleMatrixStore.getState().loadMonth(1, 2027);
    const paste = useScheduleMatrixStore.getState().pasteCopiedTable('Admin');
    expect(paste.ok).toBe(true);

    const pasted = useScheduleMatrixStore.getState().data!;
    const pastedFacility = pasted.facilities.find((item) => item.id === facility.id)!;
    const pastedRow = pastedFacility.units
      .flatMap((unit) => unit.rows)
      .find((row) => row.id === sourceRow.id)!;
    expect(pasted.year).toBe(2027);
    expect(pasted.month).toBe(1);
    expect(pastedFacility.units.map((unit) => unit.id)).toEqual(expectedUnitOrder);
    expect(pasted.settings.find((settings) => settings.facilityId === facility.id)!
      .shiftDefinitions.map((definition) => definition.id)).toEqual(expectedSettingsOrder);
    expect(pastedRow.backgroundColor).toBe('#2563EB');
    expect(pastedRow.textColor).toBe('#FEF08A');
    expect(pastedRow.cellsByDay[1]).toEqual([expect.objectContaining({
      employeeId: 'employee-copy-1',
      employeeCode: 'CP1',
      status: 'draft',
    })]);
    expect(pastedRow.cellsByDay[31]).toBeUndefined();
    expect(useScheduleMatrixStore.getState().monthStatuses['2027-02']).toBe('draft');
    expect(useScheduleMatrixStore.getState().versionsByMonth['2027-02'][0].reason).toBe('paste');
    expect(useScheduleMatrixStore.getState().tableClipboard?.sourceKey).toBe('2026-07');

    const persistedDraft = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}')
      .draftsByMonth['2027-02'];
    expect(persistedDraft.facilities.find((item: { id: string }) => item.id === facility.id)
      .units.map((unit: { id: string }) => unit.id)).toEqual(expectedUnitOrder);

    expect(useScheduleMatrixStore.getState().publishDrafts().ok).toBe(true);
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('published');
    expect(useScheduleMatrixStore.getState().matricesByMonth['2027-02']).toBeTruthy();
  });

  it('rolls back a failed schedule table paste and keeps the copied table available', () => {
    expect(useScheduleMatrixStore.getState().copyCurrentTable('Admin').ok).toBe(true);
    useScheduleMatrixStore.getState().loadMonth(7, 2026);
    const before = {
      data: JSON.parse(JSON.stringify(useScheduleMatrixStore.getState().data)),
      draftCellKeys: [...useScheduleMatrixStore.getState().draftCellKeys],
      monthStatuses: { ...useScheduleMatrixStore.getState().monthStatuses },
      versionsByMonth: JSON.parse(JSON.stringify(useScheduleMatrixStore.getState().versionsByMonth)),
      deletedMonths: [...useScheduleMatrixStore.getState().deletedMonths],
    };
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = useScheduleMatrixStore.getState().pasteCopiedTable('Admin');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(useScheduleMatrixStore.getState().data).toEqual(before.data);
    expect(useScheduleMatrixStore.getState().draftCellKeys).toEqual(before.draftCellKeys);
    expect(useScheduleMatrixStore.getState().monthStatuses).toEqual(before.monthStatuses);
    expect(useScheduleMatrixStore.getState().versionsByMonth).toEqual(before.versionsByMonth);
    expect(useScheduleMatrixStore.getState().deletedMonths).toEqual(before.deletedMonths);
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
    expect(useScheduleMatrixStore.getState().tableClipboard?.sourceKey).toBe('2026-07');
  });

  it('persists manual unit ordering in the monthly draft schema', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities.find((item) => item.units.length > 1)!;
    const firstUnitId = facility.units[0].id;
    const result = state.reorderMatrixItem({
      kind: 'unit',
      facilityId: facility.id,
      sourceUnitId: firstUnitId,
      targetUnitId: facility.units[1].id,
      position: 'after',
    }, 'Admin');
    expect(result).toMatchObject({ ok: true, kind: 'unit' });
    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    expect(persisted.version).toBe(3);
    expect(persisted.draftsByMonth['2026-07'].facilities
      .find((item: { id: string }) => item.id === facility.id).units[1].id).toBe(firstUnitId);
  });

  it.each([1, 10, 50])('moves a row containing %i assignments without losing any employee', (assignmentCount) => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities.find((item) => {
      const unitsWithRows = item.units.filter((unit) => !unit.archived && unit.rows.some((row) => !row.archived));
      return unitsWithRows.length > 1;
    })!;
    const [sourceUnit, targetUnit] = facility.units
      .filter((unit) => !unit.archived && unit.rows.some((row) => !row.archived));
    const sourceRow = sourceUnit.rows.find((row) => !row.archived)!;
    const targetRow = targetUnit.rows.find((row) => !row.archived)!;
    const assignments = Array.from({ length: assignmentCount }, (_, index) => ({
      employeeId: `move-employee-${index + 1}`,
      employeeCode: `MV${index + 1}`,
    }));
    const prepared = JSON.parse(JSON.stringify(state.data));
    const preparedSourceRow = prepared.facilities
      .find((item: { id: string }) => item.id === facility.id).units
      .find((item: { id: string }) => item.id === sourceUnit.id).rows
      .find((item: { id: string }) => item.id === sourceRow.id);
    for (const day of Object.keys(preparedSourceRow.cellsByDay)) preparedSourceRow.cellsByDay[day] = [];
    preparedSourceRow.cellsByDay[1] = assignments;
    useScheduleMatrixStore.setState({
      data: prepared,
      draftCellKeys: [`test|row-move|${assignmentCount}`],
    });

    const result = useScheduleMatrixStore.getState().reorderMatrixItem({
      kind: 'row',
      facilityId: facility.id,
      sourceUnitId: sourceUnit.id,
      sourceRowId: sourceRow.id,
      targetUnitId: targetUnit.id,
      targetRowId: targetRow.id,
      position: 'before',
    }, 'Admin');

    expect(result).toMatchObject({ ok: true, kind: 'row', affectedAssignments: assignmentCount });
    const movedRow = useScheduleMatrixStore.getState().data!.facilities
      .find((item) => item.id === facility.id)!.units
      .find((item) => item.id === targetUnit.id)!.rows
      .find((item) => item.id === sourceRow.id)!;
    expect(movedRow.cellsByDay[1]).toEqual(assignments);
    expect(Object.values(movedRow.cellsByDay).reduce((total, values) => total + values.length, 0)).toBe(assignmentCount);
  });

  it('moves a shift between units without losing assignments and persists its position', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities.find((item) => item.units.filter((unit) => !unit.archived).length > 1)!;
    const [sourceUnit, targetUnit] = facility.units.filter((unit) => !unit.archived);
    const sourceRow = sourceUnit.rows.find((item) => !item.archived)!;
    const targetRow = targetUnit.rows.find((item) => !item.archived)!;
    const beforeAssignments = JSON.parse(JSON.stringify(sourceRow.cellsByDay));

    const result = state.reorderMatrixItem({
      kind: 'row',
      facilityId: facility.id,
      sourceUnitId: sourceUnit.id,
      sourceRowId: sourceRow.id,
      targetUnitId: targetUnit.id,
      targetRowId: targetRow.id,
      position: 'before',
    }, 'Admin');
    expect(result).toMatchObject({ ok: true, kind: 'row' });

    const updatedFacility = useScheduleMatrixStore.getState().data!.facilities.find((item) => item.id === facility.id)!;
    expect(updatedFacility.units.find((item) => item.id === sourceUnit.id)!.rows.some((item) => item.id === sourceRow.id)).toBe(false);
    const targetRows = updatedFacility.units.find((item) => item.id === targetUnit.id)!.rows;
    expect(targetRows.findIndex((item) => item.id === sourceRow.id)).toBe(targetRows.findIndex((item) => item.id === targetRow.id) - 1);
    expect(targetRows.find((item) => item.id === sourceRow.id)!.cellsByDay).toEqual(beforeAssignments);
    expect(targetRows.find((item) => item.id === sourceRow.id)).toMatchObject({
      unitLabel: targetUnit.name,
      blockType: targetUnit.blockType,
    });

    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    const persistedFacility = persisted.draftsByMonth['2026-07'].facilities.find((item: { id: string }) => item.id === facility.id);
    const persistedRows = persistedFacility.units.find((item: { id: string }) => item.id === targetUnit.id).rows;
    expect(persistedRows.findIndex((item: { id: string }) => item.id === sourceRow.id)).toBe(
      persistedRows.findIndex((item: { id: string }) => item.id === targetRow.id) - 1,
    );

    vi.resetModules();
    return import('./scheduleMatrixStore').then((reloadedModule) => {
      reloadedModule.useScheduleMatrixStore.getState().loadMonth(6, 2026);
      const reloadedFacility = reloadedModule.useScheduleMatrixStore.getState().data!.facilities
        .find((item) => item.id === facility.id)!;
      const reloadedRows = reloadedFacility.units.find((item) => item.id === targetUnit.id)!.rows;
      expect(reloadedRows.findIndex((item) => item.id === sourceRow.id)).toBe(
        reloadedRows.findIndex((item) => item.id === targetRow.id) - 1,
      );
    });
  });

  it('rolls back a reorder and returns storage_error when monthly persistence is full', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities.find((item) => item.units.length > 1)!;
    const beforeOrder = facility.units.map((unit) => unit.id);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = state.reorderMatrixItem({
      kind: 'unit',
      facilityId: facility.id,
      sourceUnitId: beforeOrder[0],
      targetUnitId: beforeOrder[1],
      position: 'after',
    }, 'Admin');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(useScheduleMatrixStore.getState().data!.facilities
      .find((item) => item.id === facility.id)!.units.map((unit) => unit.id)).toEqual(beforeOrder);
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
  });

  it('rolls back a schedule assignment and reports storage failure when persistence is full', () => {
    const state = useScheduleMatrixStore.getState();
    const row = state.data!.facilities[0].units[0].rows[0];
    const previousAssignments = row.cellsByDay[1].map((assignment) => assignment.employeeId);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const result = state.assignCell(row.id, 1, [{ employeeId: 'employee-1', employeeCode: 'E1' }]);
    setItem.mockRestore();
    expect(result.ok).toBe(false);
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0].cellsByDay[1]
      .map((assignment) => assignment.employeeId)).toEqual(previousAssignments);
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
  });

  it('migrates legacy published schedule and admin metadata into the monthly schema', async () => {
    const legacyMonth = JSON.parse(JSON.stringify(useScheduleMatrixStore.getState().data));
    localStorage.clear();
    localStorage.setItem(SCHEDULE_MATRIX_HISTORY_STORAGE_KEY, JSON.stringify({ '2026-07': legacyMonth }));
    localStorage.setItem(SCHEDULE_ADMIN_CONTROL_STORAGE_KEY, JSON.stringify({
      version: 1,
      monthStatuses: { '2026-07': 'published' },
      versionsByMonth: {},
      deletedMonths: [],
    }));
    vi.resetModules();
    const migratedModule = await import('./scheduleMatrixStore');
    migratedModule.useScheduleMatrixStore.getState().loadMonth(6, 2026);
    const migrated = JSON.parse(localStorage.getItem(migratedModule.SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    expect(migrated.version).toBe(3);
    expect(migrated.matricesByMonth['2026-07'].facilities).toHaveLength(legacyMonth.facilities.length);
    expect(migrated.matricesByMonth['2026-07'].legend).toEqual([]);
    expect(migrated.monthStatuses['2026-07']).toBe('published');
    expect(localStorage.getItem(SCHEDULE_MATRIX_HISTORY_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(SCHEDULE_ADMIN_CONTROL_STORAGE_KEY)).toBeTruthy();

    vi.resetModules();
    const reloadedModule = await import('./scheduleMatrixStore');
    reloadedModule.useScheduleMatrixStore.getState().loadMonth(6, 2026);
    const reloaded = reloadedModule.useScheduleMatrixStore.getState().data!;
    expect(reloaded.legend.length).toBeGreaterThan(0);
    expect(reloaded.facilities[0].units[0].rows[0].cellsByDay[1]).toBeDefined();
  });
});
