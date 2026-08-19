import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const putMock = vi.fn();

vi.mock('./axios', () => ({
  default: {
    put: putMock,
  },
  setUnauthorizedHandler: vi.fn(),
}));

describe('backendStateSync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    putMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(async () => {
    const { stopBackendStateSync } = await import('./backendStateSync');
    stopBackendStateSync();
    vi.useRealTimers();
  });

  it('keeps a newly added schedule unit in local draft state when backend sync fails', async () => {
    putMock.mockRejectedValue(new Error('Schedule month 2026-07 has been updated by another session.'));

    const [
      { startBackendStateSync },
      { useAuthStore },
      { useScheduleMatrixStore },
      { createScheduleMatrixFixture },
    ] = await Promise.all([
      import('./backendStateSync'),
      import('@/stores/authStore'),
      import('@/stores/scheduleMatrixStore'),
      import('@/test/fixtures/scheduleMatrix'),
    ]);

    useAuthStore.getState().login({
      id: 'admin-user',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      departmentId: 'dept-1',
      departmentName: 'CT Scan Department',
      code: 'ADM',
    });

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

    startBackendStateSync();

    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const created = state.addUnit(facility.id, 'Unsynced Local Unit');

    expect(created).not.toBeNull();

    await vi.advanceTimersByTimeAsync(700);

    const nextState = useScheduleMatrixStore.getState();
    expect(nextState.storageError).toContain('another session');
    expect(nextState.data!.facilities[0].units.some((unit) => unit.id === created!.id)).toBe(true);
    expect(nextState.data!.settings[0].units.some((unit) => unit.id === created!.id)).toBe(true);
  });

  it('keeps generated assignments visible when backend sync returns a conflict', async () => {
    putMock.mockRejectedValue(new Error('Schedule month 2026-08 has been updated by another session.'));

    const [
      { startBackendStateSync },
      { useAuthStore },
      { useScheduleMatrixStore },
      { createStructuredScheduleMatrixFixture },
    ] = await Promise.all([
      import('./backendStateSync'),
      import('@/stores/authStore'),
      import('@/stores/scheduleMatrixStore'),
      import('@/test/fixtures/scheduleMatrix'),
    ]);

    useAuthStore.getState().login({
      id: 'admin-user',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      departmentId: 'dept-1',
      departmentName: 'CT Scan Department',
      code: 'ADM',
    });

    const matrix = createStructuredScheduleMatrixFixture(2026, 7);
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
      month: 7,
      year: 2026,
    });

    startBackendStateSync();

    const result = useScheduleMatrixStore.getState().generateConflictFreeMonth('Admin User');
    expect(result.ok).toBe(true);

    const countAssignments = (data: NonNullable<ReturnType<typeof useScheduleMatrixStore.getState>['data']>) =>
      data.facilities
        .flatMap((facility) => facility.units)
        .flatMap((unit) => unit.rows)
        .reduce((sum, row) => sum + Object.values(row.cellsByDay).reduce((rowSum, assignments) => rowSum + assignments.length, 0), 0);

    const generatedCount = countAssignments(useScheduleMatrixStore.getState().data!);
    expect(generatedCount).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(700);

    const nextState = useScheduleMatrixStore.getState();
    expect(nextState.storageError).toContain('another session');
    expect(countAssignments(nextState.data!)).toBe(generatedCount);
  });

  it('shows a friendly storage error when an older backend returns raw Prisma read-only details', async () => {
    putMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'SCHEDULE_SYNC_FAILED',
            message: `Invalid db.scheduleMonth.upsert() invocation: ConnectorError(QueryError(SqliteError { message: Some("attempt to write a readonly database") }))`,
          },
        },
      },
    });

    const [
      { startBackendStateSync },
      { useAuthStore },
      { useScheduleMatrixStore },
      { createScheduleMatrixFixture },
    ] = await Promise.all([
      import('./backendStateSync'),
      import('@/stores/authStore'),
      import('@/stores/scheduleMatrixStore'),
      import('@/test/fixtures/scheduleMatrix'),
    ]);

    useAuthStore.getState().login({
      id: 'admin-user',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      departmentId: 'dept-1',
      departmentName: 'CT Scan Department',
      code: 'ADM',
    });

    const matrix = createScheduleMatrixFixture(2026, 7);
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
      month: 7,
      year: 2026,
    });

    startBackendStateSync();

    const created = useScheduleMatrixStore.getState().addUnit(matrix.facilities[0].id, 'Local Unit');
    expect(created).not.toBeNull();

    await vi.advanceTimersByTimeAsync(700);

    const storageError = useScheduleMatrixStore.getState().storageError;
    expect(storageError).toContain('Database is read-only');
    expect(storageError).toContain('kept locally');
    expect(storageError).not.toContain('Prisma');
    expect(storageError).not.toContain('upsert');
  });
});
