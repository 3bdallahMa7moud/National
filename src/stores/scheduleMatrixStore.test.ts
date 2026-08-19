import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeScheduleMatrixData,
  SCHEDULE_ADMIN_CONTROL_STORAGE_KEY,
  SCHEDULE_MATRIX_HISTORY_STORAGE_KEY,
  SCHEDULE_MONTHLY_STORAGE_KEY,
  useScheduleMatrixStore,
} from './scheduleMatrixStore';
import { mergeBrushAssignments } from '@/lib/scheduleAssignments';
import { createOfficialEmployeeDirectoryRecordsFixture, writeEmployeeDirectoryFixtureToStorage } from '@/test/fixtures/employeeDirectory';
import { createScheduleMatrixFixture, createStructuredScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import { useEmployeeDirectoryStore } from './employeeDirectoryStore';

async function reloadPersistedMonth(month = 6, year = 2026) {
  vi.resetModules();
  const [{ useScheduleMatrixStore: reloadedScheduleStore }, { useEmployeeDirectoryStore: reloadedDirectoryStore }] = await Promise.all([
    import('./scheduleMatrixStore'),
    import('./employeeDirectoryStore'),
  ]);
  reloadedDirectoryStore.getState().replaceRecords(
    createOfficialEmployeeDirectoryRecordsFixture(),
    ['test-fixture-reload'],
  );
  reloadedScheduleStore.getState().loadMonth(month, year);
  return reloadedScheduleStore.getState().data!;
}

describe('scheduleMatrixStore administration', () => {
  beforeEach(() => {
    localStorage.clear();
    const employeeRecords = createOfficialEmployeeDirectoryRecordsFixture();
    useEmployeeDirectoryStore.getState().replaceRecords(employeeRecords, ['test-fixture']);
    const matrix = createScheduleMatrixFixture(2026, 6);
    useScheduleMatrixStore.setState({
      data: matrix,
      matricesByMonth: {},
      draftsByMonth: {},
      snapshot: JSON.stringify(matrix),
      monthStatuses: {},
      versionsByMonth: {},
      tableClipboard: null,
      deletedMonths: [],
      storageError: null,
      draftCellKeys: [],
      undoStack: [],
      selectedCells: [],
      brushEmployeeCodes: [],
      month: 6,
      year: 2026,
    });
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

  it('refuses to assign an employee on an approved vacation day', () => {
    const data = structuredClone(useScheduleMatrixStore.getState().data!);
    const employee = data.legend[0];
    const row = data.facilities[0].units[0].rows[0];
    const day = 15;
    row.cellsByDay[day] = [];
    data.vacations = data.vacations.filter((vacation) => vacation.employeeId !== employee.employeeId);
    data.vacations.push({
      employeeId: employee.employeeId,
      employeeCode: employee.code,
      fullName: employee.fullName,
      daysOff: [day],
    });
    useScheduleMatrixStore.setState({ data });

    const result = useScheduleMatrixStore.getState().assignCell(row.id, day, [{
      employeeId: employee.employeeId,
      employeeCode: employee.code,
    }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict.type).toBe('vacation');
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0].cellsByDay[day]).toEqual([]);
  });

  it('allows a shift conflict and records its warning flags', () => {
    const data = structuredClone(useScheduleMatrixStore.getState().data!);
    const rows = data.facilities.flatMap((facility) =>
      facility.units.flatMap((unit) => unit.rows.map((row) => ({ facility, unit, row }))),
    );
    const source = rows[0];
    const target = rows[1];
    const day = 16;
    const employee = { employeeId: 'conflict-employee', employeeCode: 'CF1' };
    source.row.cellsByDay[day] = [employee];
    target.row.cellsByDay[day] = [];
    target.row.timeRange = source.row.timeRange;
    data.vacations = data.vacations.filter((vacation) => vacation.employeeId !== employee.employeeId);
    useScheduleMatrixStore.setState({ data });

    const result = useScheduleMatrixStore.getState().assignCell(target.row.id, day, [employee]);

    expect(result).toEqual({ ok: true });
    const updated = useScheduleMatrixStore.getState().data!;
    const updatedSource = updated.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .find((row) => row.id === source.row.id)!;
    const updatedTarget = updated.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .find((row) => row.id === target.row.id)!;
    expect(updatedSource.cellsByDay[day][0].hasConflict).toBe(true);
    expect(updatedTarget.cellsByDay[day][0].hasConflict).toBe(true);
  });

  it('refuses to copy an assignment onto an approved vacation day', () => {
    const data = structuredClone(useScheduleMatrixStore.getState().data!);
    const employee = data.legend[0];
    const row = data.facilities[0].units[0].rows[0];
    row.cellsByDay[1] = [{ employeeId: employee.employeeId, employeeCode: employee.code }];
    row.cellsByDay[2] = [];
    data.vacations = data.vacations.filter((vacation) => vacation.employeeId !== employee.employeeId);
    data.vacations.push({
      employeeId: employee.employeeId,
      employeeCode: employee.code,
      fullName: employee.fullName,
      daysOff: [2],
    });
    useScheduleMatrixStore.setState({ data });

    useScheduleMatrixStore.getState().duplicateToNextDay(row.id, 1);

    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0].cellsByDay[2]).toEqual([]);
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

  it('adds a unit and a shift row under it, persists the structure, and exposes it through the matrix data', async () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const definition = state.data!.settings.find((entry) => entry.facilityId === facility.id)!.shiftDefinitions
      .find((candidate) => !candidate.archived)!;

    state.addUnit(facility.id, 'Advanced CT Unit');
    const addedUnit = useScheduleMatrixStore.getState().data!.facilities[0].units
      .find((candidate) => candidate.name === 'Advanced CT Unit')!;
    expect(useScheduleMatrixStore.getState().data!.settings[0].units.some((candidate) => candidate.id === addedUnit.id)).toBe(true);

    useScheduleMatrixStore.getState().addMatrixRow(
      facility.id,
      addedUnit.id,
      definition.id,
      'Advanced CT Morning',
    );

    const createdRow = useScheduleMatrixStore.getState().data!.facilities[0].units
      .find((candidate) => candidate.id === addedUnit.id)!.rows[0];
    expect(createdRow).toMatchObject({
      rowLabel: 'Advanced CT Morning',
      shiftDefinitionId: definition.id,
      shiftLabel: definition.englishName || definition.label,
      timeRange: definition.timeRange,
    });

    const reloaded = await reloadPersistedMonth();
    const reloadedUnit = reloaded.facilities[0].units.find((candidate) => candidate.id === addedUnit.id)!;
    expect(reloadedUnit.name).toBe('Advanced CT Unit');
    expect(reloaded.settings[0].units.some((candidate) => candidate.id === addedUnit.id)).toBe(true);
    expect(reloadedUnit.rows[0]).toMatchObject({
      rowLabel: 'Advanced CT Morning',
      shiftDefinitionId: definition.id,
      shiftLabel: definition.englishName || definition.label,
      timeRange: definition.timeRange,
    });
  });

  it('creates distinct ids for rapid shift and unit additions in the same millisecond', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1786924800000);

    try {
      const state = useScheduleMatrixStore.getState();
      const facility = state.data!.facilities[0];

      state.addShiftDefinition(facility.id, {
        label: 'Rapid Shift A',
        englishName: 'Rapid Shift A',
        startTime: '08:00',
        endTime: '17:00',
        timeRange: '08:00 - 17:00',
        colorKey: 'morning',
        icon: '',
        effectiveFromDay: 1,
      });
      state.addShiftDefinition(facility.id, {
        label: 'Rapid Shift B',
        englishName: 'Rapid Shift B',
        startTime: '09:00',
        endTime: '18:00',
        timeRange: '09:00 - 18:00',
        colorKey: 'evening',
        icon: '',
        effectiveFromDay: 1,
      });
      state.addUnit(facility.id, 'Rapid Unit A');
      state.addUnit(facility.id, 'Rapid Unit B');

      const settings = useScheduleMatrixStore.getState().data!.settings.find((entry) => entry.facilityId === facility.id)!;
      const rapidShiftIds = settings.shiftDefinitions
        .filter((candidate) => candidate.englishName?.startsWith('Rapid Shift '))
        .map((candidate) => candidate.id);
      const rapidUnitIds = useScheduleMatrixStore.getState().data!.facilities[0].units
        .filter((candidate) => candidate.name.startsWith('Rapid Unit '))
        .map((candidate) => candidate.id);

      expect(new Set(rapidShiftIds).size).toBe(rapidShiftIds.length);
      expect(new Set(rapidUnitIds).size).toBe(rapidUnitIds.length);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('edits unit and shift structure details, persists them, and updates the matrix rows', async () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const settings = state.data!.settings.find((entry) => entry.facilityId === facility.id)!;
    const unit = facility.units.find((candidate) => candidate.rows.length > 0)!;
    const row = unit.rows[0];
    const definition = settings.shiftDefinitions.find((candidate) => candidate.id === row.shiftDefinitionId)!;

    state.renameUnit(facility.id, unit.id, 'Renamed CT Unit');
    state.updateShiftDefinition(facility.id, definition.id, {
      englishName: 'Renamed Day Shift',
      label: 'Renamed Day Shift',
      startTime: '07:30',
      endTime: '15:30',
    });
    state.updateMatrixRow(row.id, {
      rowLabel: 'Renamed Day Coverage',
      shiftDefinitionId: definition.id,
    });

    const updatedUnit = useScheduleMatrixStore.getState().data!.facilities[0].units.find((candidate) => candidate.id === unit.id)!;
    const updatedRow = updatedUnit.rows.find((candidate) => candidate.id === row.id)!;
    expect(updatedUnit.name).toBe('Renamed CT Unit');
    expect(updatedRow).toMatchObject({
      unitLabel: 'Renamed CT Unit',
      rowLabel: 'Renamed Day Coverage',
      shiftLabel: 'Renamed Day Shift',
      timeRange: '07:30 - 15:30',
    });

    const reloaded = await reloadPersistedMonth();
    const reloadedUnit = reloaded.facilities[0].units.find((candidate) => candidate.id === unit.id)!;
    const reloadedRow = reloadedUnit.rows.find((candidate) => candidate.id === row.id)!;
    expect(reloadedUnit.name).toBe('Renamed CT Unit');
    expect(reloadedRow).toMatchObject({
      unitLabel: 'Renamed CT Unit',
      rowLabel: 'Renamed Day Coverage',
      shiftLabel: 'Renamed Day Shift',
      timeRange: '07:30 - 15:30',
    });
  });

  it('deletes a shift row and its unit, then keeps both removed after a refresh', async () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const definition = state.data!.settings.find((entry) => entry.facilityId === facility.id)!.shiftDefinitions
      .find((candidate) => !candidate.archived)!;

    state.addUnit(facility.id, 'Disposable Unit');
    const createdUnit = useScheduleMatrixStore.getState().data!.facilities[0].units
      .find((candidate) => candidate.name === 'Disposable Unit')!;
    state.addMatrixRow(facility.id, createdUnit.id, definition.id, 'Disposable Shift');
    const createdRowId = useScheduleMatrixStore.getState().data!.facilities[0].units
      .find((candidate) => candidate.id === createdUnit.id)!.rows[0].id;

    state.deleteMatrixRow(createdRowId, true);
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units.find((candidate) => candidate.id === createdUnit.id)!.rows)
      .toHaveLength(0);

    expect(useScheduleMatrixStore.getState().deleteUnit(facility.id, createdUnit.id, true, 'Admin')).toMatchObject({ ok: true });
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units.some((candidate) => candidate.id === createdUnit.id)).toBe(false);

    const reloaded = await reloadPersistedMonth();
    expect(reloaded.facilities[0].units.some((candidate) => candidate.id === createdUnit.id)).toBe(false);
    expect(reloaded.settings[0].units.some((candidate) => candidate.id === createdUnit.id)).toBe(false);
  });

  it('reorders units and shift rows, persists the new structure order, and keeps the matrix aligned', async () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const definition = state.data!.settings.find((entry) => entry.facilityId === facility.id)!.shiftDefinitions
      .find((candidate) => !candidate.archived)!;

    state.addUnit(facility.id, 'Reorder Unit A');
    state.addUnit(facility.id, 'Reorder Unit B');

    const currentUnits = useScheduleMatrixStore.getState().data!.facilities[0].units;
    const unitA = currentUnits.find((candidate) => candidate.name === 'Reorder Unit A')!;
    const unitB = currentUnits.find((candidate) => candidate.name === 'Reorder Unit B')!;

    state.addMatrixRow(facility.id, unitA.id, definition.id, 'Row A1');
    state.addMatrixRow(facility.id, unitA.id, definition.id, 'Row A2');

    expect(useScheduleMatrixStore.getState().reorderMatrixItem({
      kind: 'unit',
      facilityId: facility.id,
      sourceUnitId: unitA.id,
      targetUnitId: unitB.id,
      position: 'before',
    }, 'Admin')).toMatchObject({ ok: true, kind: 'unit' });

    const unitARows = useScheduleMatrixStore.getState().data!.facilities[0].units.find((candidate) => candidate.id === unitA.id)!.rows;
    expect(useScheduleMatrixStore.getState().reorderMatrixItem({
      kind: 'row',
      facilityId: facility.id,
      sourceUnitId: unitA.id,
      sourceRowId: unitARows[1].id,
      targetUnitId: unitA.id,
      targetRowId: unitARows[0].id,
      position: 'before',
    }, 'Admin')).toMatchObject({ ok: true, kind: 'row' });

    const reorderedFacility = useScheduleMatrixStore.getState().data!.facilities[0];
    expect(reorderedFacility.units.findIndex((candidate) => candidate.id === unitA.id))
      .toBeLessThan(reorderedFacility.units.findIndex((candidate) => candidate.id === unitB.id));
    expect(reorderedFacility.units.find((candidate) => candidate.id === unitA.id)!.rows.map((candidate) => candidate.rowLabel).slice(0, 2))
      .toEqual(['Row A2', 'Row A1']);

    const reloaded = await reloadPersistedMonth();
    const reloadedFacility = reloaded.facilities[0];
    expect(reloadedFacility.units.findIndex((candidate) => candidate.id === unitA.id))
      .toBeLessThan(reloadedFacility.units.findIndex((candidate) => candidate.id === unitB.id));
    expect(reloadedFacility.units.find((candidate) => candidate.id === unitA.id)!.rows.map((candidate) => candidate.rowLabel).slice(0, 2))
      .toEqual(['Row A2', 'Row A1']);
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

  it('updates a row to the selected local shift type and preserves the current colors through draft reload and publish', () => {
    const state = useScheduleMatrixStore.getState();
    const sourceData = state.data!;
    const facility = sourceData.facilities.find((candidate) => {
      const definitions = sourceData.settings.find((entry) => entry.facilityId === candidate.id)?.shiftDefinitions ?? [];
      return definitions.length > 1 && candidate.units.some((unit) =>
        unit.rows.some((row) => definitions.some((definition) => definition.id !== row.shiftDefinitionId)),
      );
    })!;
    const definitions = sourceData.settings.find((entry) => entry.facilityId === facility.id)!.shiftDefinitions;
    const row = facility.units.flatMap((unit) => unit.rows)
      .find((candidate) => definitions.some((definition) => definition.id !== candidate.shiftDefinitionId))!;
    const targetDefinition = definitions.find((definition) => definition.id !== row.shiftDefinitionId)!;
    const expectedLabel = targetDefinition.englishName?.trim() || targetDefinition.label;
    const expectedTimeRange = targetDefinition.startTime && targetDefinition.endTime
      ? `${targetDefinition.startTime} - ${targetDefinition.endTime}`
      : targetDefinition.timeRange;
    const expectedWeekendOnly = !row.weekendOnly;
    const monthKey = `${sourceData.year}-${String(sourceData.month + 1).padStart(2, '0')}`;
    const findRow = (monthData = useScheduleMatrixStore.getState().data!) =>
      monthData.facilities
        .flatMap((candidateFacility) => candidateFacility.units)
        .flatMap((unit) => unit.rows)
        .find((candidate) => candidate.id === row.id)!;

    state.updateMatrixRow(row.id, {
      shiftDefinitionId: targetDefinition.id,
      rowLabel: 'Updated CT Coverage',
      weekendOnly: expectedWeekendOnly,
    });

    const editedRow = findRow();
    expect(editedRow).toMatchObject({
      shiftDefinitionId: targetDefinition.id,
      shiftLabel: expectedLabel,
      timeRange: expectedTimeRange,
      colorKey: targetDefinition.colorKey,
      rowLabel: 'Updated CT Coverage',
      weekendOnly: expectedWeekendOnly,
    });

    useScheduleMatrixStore.getState().loadMonth(7, 2026);
    useScheduleMatrixStore.getState().loadMonth(sourceData.month, sourceData.year);
    expect(findRow()).toMatchObject({
      shiftDefinitionId: editedRow.shiftDefinitionId,
      shiftLabel: editedRow.shiftLabel,
      timeRange: editedRow.timeRange,
      colorKey: editedRow.colorKey,
      backgroundColor: editedRow.backgroundColor,
      textColor: editedRow.textColor,
      rowLabel: editedRow.rowLabel,
      weekendOnly: editedRow.weekendOnly,
    });

    expect(useScheduleMatrixStore.getState().publishDrafts('Shift Publisher')).toMatchObject({ ok: true });
    const publishedRow = useScheduleMatrixStore.getState().matricesByMonth[monthKey].facilities
      .flatMap((candidateFacility) => candidateFacility.units)
      .flatMap((unit) => unit.rows)
      .find((candidate) => candidate.id === row.id)!;
    expect(publishedRow.shiftDefinitionId).toBe(editedRow.shiftDefinitionId);
    expect(publishedRow.shiftLabel).toBe(editedRow.shiftLabel);
    expect(publishedRow.timeRange).toBe(editedRow.timeRange);
    expect(publishedRow.colorKey).toBe(editedRow.colorKey);
    expect(publishedRow.backgroundColor).toBe(editedRow.backgroundColor);
    expect(publishedRow.textColor).toBe(editedRow.textColor);
    expect(publishedRow.rowLabel).toBe(editedRow.rowLabel);
    expect(publishedRow.weekendOnly).toBe(editedRow.weekendOnly);

    useScheduleMatrixStore.getState().loadMonth(8, 2026);
    useScheduleMatrixStore.getState().loadMonth(sourceData.month, sourceData.year);
    expect(findRow()).toMatchObject({
      shiftDefinitionId: editedRow.shiftDefinitionId,
      shiftLabel: editedRow.shiftLabel,
      timeRange: editedRow.timeRange,
      colorKey: editedRow.colorKey,
      backgroundColor: editedRow.backgroundColor,
      textColor: editedRow.textColor,
      rowLabel: editedRow.rowLabel,
      weekendOnly: editedRow.weekendOnly,
    });
  });

  it('repairs stale foreign shift-definition ids when a persisted month is loaded again', () => {
    const state = useScheduleMatrixStore.getState();
    const monthData = structuredClone(state.data!);
    const facility = monthData.facilities.find((candidate) => candidate.units.some((unit) => unit.rows.length > 0))!;
    const localDefinitions = monthData.settings.find((entry) => entry.facilityId === facility.id)!.shiftDefinitions;
    const foreignDefinitions = monthData.settings.find((entry) => entry.facilityId !== facility.id && entry.shiftDefinitions.length > 0)!.shiftDefinitions;
    const row = facility.units.find((unit) => unit.rows.length > 0)!.rows[0];
    const localDefinition = localDefinitions.find((definition) => definition.id === row.shiftDefinitionId) ?? localDefinitions[0];
    const expectedLabel = localDefinition.englishName?.trim() || localDefinition.label;
    const expectedTimeRange = localDefinition.startTime && localDefinition.endTime
      ? `${localDefinition.startTime} - ${localDefinition.endTime}`
      : localDefinition.timeRange;
    const monthKey = `${monthData.year}-${String(monthData.month + 1).padStart(2, '0')}`;

    row.shiftDefinitionId = foreignDefinitions[0].id;
    row.shiftLabel = expectedLabel;
    row.timeRange = expectedTimeRange;
    row.colorKey = localDefinition.colorKey;
    row.backgroundColor = localDefinition.backgroundColor;
    row.textColor = localDefinition.textColor;

    useScheduleMatrixStore.setState({
      data: null,
      draftsByMonth: { [monthKey]: monthData },
      matricesByMonth: {},
      month: monthData.month,
      year: monthData.year,
      draftCellKeys: [],
    });

    useScheduleMatrixStore.getState().loadMonth(monthData.month, monthData.year);

    const repairedRow = useScheduleMatrixStore.getState().data!.facilities
      .flatMap((candidateFacility) => candidateFacility.units)
      .flatMap((unit) => unit.rows)
      .find((candidate) => candidate.id === row.id)!;
    expect(repairedRow).toMatchObject({
      shiftDefinitionId: localDefinition.id,
      shiftLabel: expectedLabel,
      timeRange: expectedTimeRange,
      colorKey: localDefinition.colorKey,
      backgroundColor: localDefinition.backgroundColor,
      textColor: localDefinition.textColor,
    });
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

  it('reconstructs missing facility settings from legacy schedule rows so settings remain editable', () => {
    const legacyMonth = structuredClone(createScheduleMatrixFixture(2026, 7));
    legacyMonth.settings = [];
    const normalized = normalizeScheduleMatrixData(legacyMonth);

    expect(normalized.settings).toHaveLength(normalized.facilities.length);

    for (const facility of normalized.facilities) {
      const facilitySettings = normalized.settings.find((entry) => entry.facilityId === facility.id);
      expect(facilitySettings).toBeDefined();
      expect(facilitySettings!.units.map((unit) => unit.id)).toEqual(facility.units.map((unit) => unit.id));
      expect(facilitySettings!.shiftDefinitions.length).toBeGreaterThan(0);

      for (const row of facility.units.flatMap((unit) => unit.rows)) {
        expect(row.shiftDefinitionId).toBeTruthy();
        const linkedDefinition = facilitySettings!.shiftDefinitions.find((definition) => definition.id === row.shiftDefinitionId);
        expect(linkedDefinition).toBeDefined();
        expect(row.shiftLabel).toBe(linkedDefinition!.englishName || linkedDefinition!.label);
      }
    }
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

  it('generates a conflict-free draft month with vacations and a recovery version', () => {
    const result = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin');

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.affected).toBeGreaterThan(0);
    expect(result.ok && result.vacations).toBeGreaterThan(0);
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('draft');
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07'][0].reason).toBe('generate');
    expect(useScheduleMatrixStore.getState().conflictCount()).toBe(0);
  });

  it('keeps a generated draft when quota pressure requires pruning old recovery versions', () => {
    for (let index = 0; index < 3; index += 1) {
      expect(useScheduleMatrixStore.getState().resetCurrentMonth('Admin').ok).toBe(true);
    }
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07']).toHaveLength(3);

    const originalSetItem = Storage.prototype.setItem;
    let monthlyWriteAttempts = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function mockSetItem(
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === SCHEDULE_MONTHLY_STORAGE_KEY) {
        monthlyWriteAttempts += 1;
        if (monthlyWriteAttempts <= 2) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }
      }
      originalSetItem.call(this, key, value);
    });

    const result = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: true });
    expect(monthlyWriteAttempts).toBe(3);
    expect(useScheduleMatrixStore.getState().storageError).toBeNull();
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07']).toHaveLength(1);
    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    expect(persisted.draftsByMonth['2026-07']).toBeTruthy();
    expect(persisted.versionsByMonth['2026-07']).toHaveLength(1);
  });

  it('preserves schedule structure, styles, roster, settings, and existing vacations while generating', () => {
    const before = JSON.parse(JSON.stringify(useScheduleMatrixStore.getState().data));
    const targetRow = before.facilities[0].units[0].rows[0];
    const existingVacationEmployeeId = before.vacations[0].employeeId;
    const existingVacationDays = [...before.vacations[0].daysOff];
    targetRow.rowLabel = 'Custom Generator Row';
    targetRow.backgroundColor = '#123456';
    targetRow.textColor = '#F8FAFC';
    useScheduleMatrixStore.setState({ data: before });

    const result = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin');

    expect(result.ok).toBe(true);
    const after = useScheduleMatrixStore.getState().data!;
    const generatedRow = after.facilities[0].units[0].rows[0];
    expect(generatedRow).toMatchObject({
      id: targetRow.id,
      rowLabel: 'Custom Generator Row',
      backgroundColor: '#123456',
      textColor: '#F8FAFC',
    });
    expect(after.legend).toEqual(before.legend);
    expect(after.settings).toEqual(before.settings);
    expect(after.vacations.find((vacation) => vacation.employeeId === existingVacationEmployeeId)?.daysOff)
      .toEqual(existingVacationDays);
    expect(after.vacations.reduce((total, vacation) => total + vacation.daysOff.length, 0))
      .toBeGreaterThan(before.vacations.reduce((total: number, vacation: { daysOff: number[] }) => total + vacation.daysOff.length, 0));
  });

  it('rolls back a generated month and returns storage_error when persistence fails', () => {
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

    const result = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(useScheduleMatrixStore.getState().data).toEqual(before.data);
    expect(useScheduleMatrixStore.getState().draftCellKeys).toEqual(before.draftCellKeys);
    expect(useScheduleMatrixStore.getState().monthStatuses).toEqual(before.monthStatuses);
    expect(useScheduleMatrixStore.getState().versionsByMonth).toEqual(before.versionsByMonth);
    expect(useScheduleMatrixStore.getState().deletedMonths).toEqual(before.deletedMonths);
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
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

  it('compacts persisted drafts and rehydrates omitted cells and roster data on reload', async () => {
    const state = useScheduleMatrixStore.getState();
    const row = state.data!.facilities[0].units[0].rows[0];

    expect(state.clearAllAssignments('Admin')).toBeGreaterThan(0);
    expect(useScheduleMatrixStore.getState().assignCell(row.id, 1, [{
      employeeId: 'storage-characterization',
      employeeCode: 'SC1',
    }]).ok).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    const persistedDraft = persisted.draftsByMonth['2026-07'];
    const persistedRow = persistedDraft.facilities
      .flatMap((facility: { units: Array<{ rows: Array<{ id: string }> }> }) => facility.units)
      .flatMap((unit: { rows: Array<{ id: string }> }) => unit.rows)
      .find((candidate: { id: string }) => candidate.id === row.id);

    expect(persistedDraft.legend).toEqual([]);
    expect(persistedDraft.auditLog).toEqual([]);
    expect(persistedRow.cellsByDay).toEqual({
      1: [expect.objectContaining({
        employeeId: 'storage-characterization',
        employeeCode: 'SC1',
      })],
    });

    vi.resetModules();
    const reloadedModule = await import('./scheduleMatrixStore');
    reloadedModule.useScheduleMatrixStore.getState().loadMonth(6, 2026);
    const reloaded = reloadedModule.useScheduleMatrixStore.getState().data!;
    const reloadedRow = reloaded.facilities
      .flatMap((facility) => facility.units)
      .flatMap((unit) => unit.rows)
      .find((candidate) => candidate.id === row.id)!;

    expect(reloaded.legend.length).toBeGreaterThan(0);
    expect(reloadedRow.cellsByDay[1]).toEqual([expect.objectContaining({
      employeeId: 'storage-characterization',
      employeeCode: 'SC1',
    })]);
    expect(reloadedRow.cellsByDay[2]).toEqual([]);
  });

  it('applies and removes one marker operation across multiple selected cells without changing assignments or conflicts', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    const selectedCells = [1, 2].map((day) => ({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day,
    }));
    const assignmentCount = state.data!.facilities
      .flatMap((entry) => entry.units)
      .flatMap((entry) => entry.rows)
      .flatMap((entry) => Object.values(entry.cellsByDay))
      .reduce((total, assignments) => total + assignments.length, 0);
    const conflictCount = state.conflictCount();
    selectedCells.forEach((cell) => state.toggleCellSelection(cell));

    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('purple'))
      .toEqual({ ok: true, affected: 2 });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toMatchObject({
      [`cell|${row.id}|1`]: 'purple',
      [`cell|${row.id}|2`]: 'purple',
    });
    expect(useScheduleMatrixStore.getState().selectedCells).toEqual(selectedCells);
    expect(useScheduleMatrixStore.getState().conflictCount()).toBe(conflictCount);
    expect(useScheduleMatrixStore.getState().data!.facilities
      .flatMap((entry) => entry.units)
      .flatMap((entry) => entry.rows)
      .flatMap((entry) => Object.values(entry.cellsByDay))
      .reduce((total, assignments) => total + assignments.length, 0)).toBe(assignmentCount);
    useScheduleMatrixStore.getState().archiveMatrixRow(row.id);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers[`cell|${row.id}|1`]).toBe('purple');
    useScheduleMatrixStore.getState().restoreMatrixRow(row.id);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers[`cell|${row.id}|2`]).toBe('purple');

    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers(null))
      .toEqual({ ok: true, affected: 2 });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});
  });

  it('returns no_selection and treats an unchanged marker color as a no-op', () => {
    const state = useScheduleMatrixStore.getState();
    expect(state.setSelectedCellMarkers('yellow')).toEqual({
      ok: false,
      reason: 'no_selection',
    });

    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 1,
    });
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('yellow'))
      .toEqual({ ok: true, affected: 1 });
    const undoCount = useScheduleMatrixStore.getState().undoStack.length;
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('yellow'))
      .toEqual({ ok: true, affected: 0 });
    expect(useScheduleMatrixStore.getState().undoStack).toHaveLength(undoCount);
  });

  it('marks a supplied cell directly without requiring selection state', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    const cell = {
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 3,
    };

    expect(state.selectedCells).toEqual([]);
    expect(state.setCellMarkers([cell], 'blue')).toEqual({ ok: true, affected: 1 });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers[`cell|${row.id}|3`]).toBe('blue');
    expect(useScheduleMatrixStore.getState().selectedCells).toEqual([]);
    expect(useScheduleMatrixStore.getState().setCellMarkers([cell], null))
      .toEqual({ ok: true, affected: 1 });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});
  });

  it('undoes a multi-cell marker change in one step and discard restores the unpublished baseline', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    [1, 2, 3].forEach((day) => state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day,
    }));
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('orange'))
      .toEqual({ ok: true, affected: 3 });
    expect(useScheduleMatrixStore.getState().undoLastEdit()).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});

    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('orange'))
      .toEqual({ ok: true, affected: 3 });
    useScheduleMatrixStore.getState().discardDraft();
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});
  });

  it('keeps marker drafts private until explicit publication and never auto-publishes a generated month', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 1,
    });

    expect(state.matricesByMonth['2026-07']).toBeUndefined();
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('green'))
      .toEqual({ ok: true, affected: 1 });
    expect(useScheduleMatrixStore.getState().matricesByMonth['2026-07']).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}')
      .draftsByMonth['2026-07'].cellMarkers[`cell|${row.id}|1`]).toBe('green');
    useScheduleMatrixStore.getState().loadMonth(6, 2026);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers[`cell|${row.id}|1`]).toBe('green');

    const published = useScheduleMatrixStore.getState().publishDrafts('Publisher Name');
    expect(published).toMatchObject({ ok: true, markerCount: 1 });
    expect(useScheduleMatrixStore.getState().matricesByMonth['2026-07']
      .cellMarkers[`cell|${row.id}|1`]).toBe('green');
    expect(JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}')
      .draftsByMonth['2026-07']).toBeUndefined();

    useScheduleMatrixStore.getState().loadMonth(10, 2031);
    expect(useScheduleMatrixStore.getState().matricesByMonth['2031-11']).toBeUndefined();
    expect(useScheduleMatrixStore.getState().currentMonthStatus()).toBe('draft');
  });

  it('preserves markers while generating assignments without consulting marker metadata', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 4,
    });
    expect(state.setSelectedCellMarkers('orange')).toEqual({ ok: true, affected: 1 });

    expect(useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin').ok).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({
      [`cell|${row.id}|4`]: 'orange',
    });
  });

  it('clears markers on reset, prunes out-of-month paste markers, and removes permanent row or unit markers', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    [1, 31].forEach((day) => state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day,
    }));
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('blue'))
      .toEqual({ ok: true, affected: 2 });
    expect(useScheduleMatrixStore.getState().copyCurrentTable('Admin').ok).toBe(true);
    useScheduleMatrixStore.getState().loadMonth(1, 2027);
    expect(useScheduleMatrixStore.getState().pasteCopiedTable('Admin').ok).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({
      [`cell|${row.id}|1`]: 'blue',
    });

    expect(useScheduleMatrixStore.getState().resetCurrentMonth('Admin').ok).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});

    const resetState = useScheduleMatrixStore.getState();
    const resetFacility = resetState.data!.facilities[0];
    const resetUnit = resetFacility.units[0];
    const resetRow = resetUnit.rows[0];
    resetState.toggleCellSelection({
      facilityId: resetFacility.id,
      unitId: resetUnit.id,
      rowId: resetRow.id,
      day: 1,
    });
    expect(useScheduleMatrixStore.getState().setSelectedCellMarkers('red'))
      .toEqual({ ok: true, affected: 1 });
    expect(useScheduleMatrixStore.getState().deleteUnit(
      resetFacility.id,
      resetUnit.id,
      true,
      'Admin',
    ).ok).toBe(true);
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});
  });

  it('rolls a marker operation back when monthly storage cannot be written', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 1,
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = useScheduleMatrixStore.getState().setSelectedCellMarkers('red');
    setItem.mockRestore();

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers).toEqual({});
    expect(useScheduleMatrixStore.getState().storageError).toBeTruthy();
  });

  it('publishes with conflicts, reports marker counts, audits the publisher, and preserves complete versions', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 1,
    });
    expect(state.setSelectedCellMarkers('yellow')).toEqual({ ok: true, affected: 1 });
    expect(useScheduleMatrixStore.getState().resetCurrentMonth('Version Admin').ok).toBe(true);
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07'][0]
      .data.cellMarkers[`cell|${row.id}|1`]).toBe('yellow');

    const reset = useScheduleMatrixStore.getState();
    const targetFacility = reset.data!.facilities[0];
    const targetUnit = targetFacility.units[0];
    const targetRow = targetUnit.rows[0];
    const day = 1;
    const conflictEmployee = {
      employeeId: 'conflict-employee',
      employeeCode: 'CF',
    };
    const conflicted = JSON.parse(JSON.stringify(reset.data));
    const conflictedRow = conflicted.facilities[0].units[0].rows[0];
    conflictedRow.cellsByDay[day] = [{
      ...conflictEmployee,
      status: 'draft',
    }];
    conflicted.vacations = [{
      ...conflictEmployee,
      fullName: 'Conflict Employee',
      daysOff: [day],
      type: 'annual',
      ranges: [{
        id: 'conflict-vacation',
        employeeId: conflictEmployee.employeeId,
        startDay: day,
        endDay: day,
        type: 'annual',
        status: 'draft',
      }],
    }];
    conflicted.cellMarkers[`cell|${targetRow.id}|${day}`] = 'purple';
    useScheduleMatrixStore.setState({
      data: conflicted,
      draftCellKeys: [`cell|${targetRow.id}|${day}`],
    });

    const result = useScheduleMatrixStore.getState().publishDrafts('Conflict Publisher');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.conflictCount).toBeGreaterThan(0);
    expect(result.markerCount).toBe(1);
    const published = useScheduleMatrixStore.getState().matricesByMonth['2026-07'];
    const publishAudit = published.auditLog.find((entry) => entry.action === 'publish')!;
    expect(publishAudit.actorName).toBe('Conflict Publisher');
    expect(publishAudit.oldValue).toContain('Publisher: Conflict Publisher');
    expect(publishAudit.newValue).toContain(`${result.conflictCount} conflicts`);
    expect(publishAudit.newValue).toContain('1 markers');
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07'][0]
      .data.cellMarkers[`cell|${targetRow.id}|${day}`]).toBe('purple');
    expect(useScheduleMatrixStore.getState().versionsByMonth['2026-07'][1]
      .data.cellMarkers[`cell|${row.id}|1`]).toBe('yellow');
  });

  it('reloads published matrices from storage without promoting a private draft', () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const unit = facility.units[0];
    const row = unit.rows[0];
    state.toggleCellSelection({
      facilityId: facility.id,
      unitId: unit.id,
      rowId: row.id,
      day: 1,
    });
    state.setSelectedCellMarkers('blue');
    state.publishDrafts('Admin');

    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    persisted.matricesByMonth['2026-07'].cellMarkers = {
      [`cell|${row.id}|1`]: 'yellow',
    };
    persisted.draftsByMonth['2026-07'] = JSON.parse(JSON.stringify(
      persisted.matricesByMonth['2026-07'],
    ));
    persisted.draftsByMonth['2026-07'].cellMarkers = {
      [`cell|${row.id}|1`]: 'red',
    };
    localStorage.setItem(SCHEDULE_MONTHLY_STORAGE_KEY, JSON.stringify(persisted));

    useScheduleMatrixStore.getState().reloadFromStorage();

    expect(useScheduleMatrixStore.getState().matricesByMonth['2026-07'].cellMarkers)
      .toEqual({ [`cell|${row.id}|1`]: 'yellow' });
    expect(useScheduleMatrixStore.getState().data!.cellMarkers)
      .toEqual({ [`cell|${row.id}|1`]: 'yellow' });
  });

  it('migrates legacy published schedule and admin metadata into the monthly schema', async () => {
    const legacyMonth = JSON.parse(JSON.stringify(useScheduleMatrixStore.getState().data));
    delete legacyMonth.cellMarkers;
    localStorage.clear();
    writeEmployeeDirectoryFixtureToStorage(localStorage);
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
    expect(reloaded.cellMarkers).toEqual({});
    expect(reloaded.facilities[0].units[0].rows[0].cellsByDay[1]).toBeDefined();
  });

  it('loads existing persisted rows for a populated month without altering assignments', () => {
    const populated = createScheduleMatrixFixture(2026, 7);
    const monthKey = '2026-08';
    const populatedRow = populated.facilities[0].units[0].rows[0];
    const expectedAssignments = JSON.parse(JSON.stringify(populatedRow.cellsByDay[1]));

    useScheduleMatrixStore.setState({
      data: null,
      month: 7,
      year: 2026,
      draftsByMonth: {},
      matricesByMonth: { [monthKey]: populated },
      deletedMonths: [],
      draftCellKeys: [],
    });

    useScheduleMatrixStore.getState().loadMonth(7, 2026);

    const loadedRow = useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows[0];
    expect(loadedRow.cellsByDay[1]).toEqual(expectedAssignments);
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows.length).toBeGreaterThan(0);
  });

  it('reconstructs an empty month from the nearest configured month and keeps rows visible after refresh and navigation', async () => {
    const template = createStructuredScheduleMatrixFixture(2026, 6);
    const templateKey = '2026-07';
    const targetKey = '2026-08';

    useScheduleMatrixStore.setState({
      data: template,
      month: 6,
      year: 2026,
      draftsByMonth: { [templateKey]: template },
      matricesByMonth: {},
      deletedMonths: [],
      draftCellKeys: [],
    });

    useScheduleMatrixStore.getState().loadMonth(7, 2026);
    const august = useScheduleMatrixStore.getState().data!;
    expect(august.year).toBe(2026);
    expect(august.month).toBe(7);
    expect(august.facilities.some((facility) => facility.units.some((unit) => unit.rows.length > 0))).toBe(true);
    expect(august.facilities[0].units[0].rows[0].cellsByDay[1]).toEqual([]);

    useScheduleMatrixStore.getState().reloadFromStorage();
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows.length)
      .toBe(august.facilities[0].units[0].rows.length);

    useScheduleMatrixStore.getState().loadMonth(8, 2026);
    useScheduleMatrixStore.getState().loadMonth(7, 2026);
    expect(useScheduleMatrixStore.getState().data!.facilities[0].units[0].rows.length)
      .toBe(august.facilities[0].units[0].rows.length);

    vi.resetModules();
    const reloadedModule = await import('./scheduleMatrixStore');
    reloadedModule.useScheduleMatrixStore.getState().loadMonth(7, 2026);
    const reloaded = reloadedModule.useScheduleMatrixStore.getState().data!;
    expect(reloaded.facilities.some((facility) => facility.units.some((unit) => unit.rows.length > 0))).toBe(true);
    expect(reloadedModule.useScheduleMatrixStore.getState().monthStatuses[targetKey]).toBe('draft');
  });

  it('persists settings changes into the reconstructed next month and allows assigning employees there', () => {
    const template = createStructuredScheduleMatrixFixture(2026, 6);
    const templateKey = '2026-07';
    useScheduleMatrixStore.setState({
      data: template,
      month: 6,
      year: 2026,
      draftsByMonth: { [templateKey]: template },
      matricesByMonth: {},
      deletedMonths: [],
      draftCellKeys: [],
    });

    const sourceFacility = template.facilities[0];
    const sourceUnit = sourceFacility.units[0];
    const sourceRow = sourceUnit.rows[0];
    useScheduleMatrixStore.getState().updateMatrixRow(sourceRow.id, { rowLabel: 'CT Coverage Alpha' });
    useScheduleMatrixStore.getState().loadMonth(7, 2026);

    const august = useScheduleMatrixStore.getState().data!;
    const updatedRow = august.facilities
      .find((facility) => facility.id === sourceFacility.id)!.units
      .find((unit) => unit.id === sourceUnit.id)!.rows
      .find((row) => row.id === sourceRow.id)!;

    expect(updatedRow.rowLabel).toBe('CT Coverage Alpha');
    expect(useScheduleMatrixStore.getState().assignCell(updatedRow.id, 2, [{
      employeeId: august.legend[0].employeeId,
      employeeCode: august.legend[0].code,
    }])).toEqual({ ok: true });
    expect(useScheduleMatrixStore.getState().data!.facilities
      .find((facility) => facility.id === sourceFacility.id)!.units
      .find((unit) => unit.id === sourceUnit.id)!.rows
      .find((row) => row.id === sourceRow.id)!.cellsByDay[2]).toEqual([
        expect.objectContaining({
          employeeId: august.legend[0].employeeId,
          employeeCode: august.legend[0].code,
          status: 'draft',
        }),
      ]);

    const persisted = JSON.parse(localStorage.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || '{}');
    expect(persisted.draftsByMonth['2026-08'].facilities
      .find((facility: { id: string }) => facility.id === sourceFacility.id).units
      .find((unit: { id: string }) => unit.id === sourceUnit.id).rows
      .find((row: { id: string }) => row.id === sourceRow.id).rowLabel).toBe('CT Coverage Alpha');
  });

  it('can generate a schedule from a reconstructed empty month', () => {
    const template = createStructuredScheduleMatrixFixture(2026, 6);
    useScheduleMatrixStore.setState({
      data: template,
      month: 6,
      year: 2026,
      draftsByMonth: { '2026-07': template },
      matricesByMonth: {},
      deletedMonths: [],
      draftCellKeys: [],
    });

    useScheduleMatrixStore.getState().loadMonth(7, 2026);
    const generated = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin');

    expect(generated).toMatchObject({ ok: true });
    expect(useScheduleMatrixStore.getState().data!.facilities.some((facility) =>
      facility.units.some((unit) =>
        unit.rows.some((row) =>
          Object.values(row.cellsByDay).some((assignments) => assignments.length > 0),
        ),
      ),
    )).toBe(true);
  });
});
