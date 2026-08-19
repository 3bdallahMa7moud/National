import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { createStructuredScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import ScheduleSettingsPanel from './ScheduleSettingsPanel';
import ScheduleSettingsWorkspace from './ScheduleSettingsWorkspace';

const resources = {
  en: {
    schedule: {
      settingsPanel: {
        title: 'Schedule Settings',
        workspace: {
          ariaLabel: 'Schedule settings sections',
          shiftTypes: 'Shift Types & Schedule Codes',
          unitStructure: 'Unit / Shift Structure',
          tableOrder: 'Table Order',
        },
        shiftVisibleCountBadge: '{{count}} shown',
        shiftScrollHintActive: 'Showing {{count}} active shift definitions. Scroll down to view every card.',
        shiftScrollHintArchived: 'Showing {{count}} archived shift definitions. Scroll down to view every card.',
        unitVisibleCountBadge: '{{count}} shown',
      },
      shiftColors: {
        morning: 'Day Shift',
        evening: 'Late Shift',
        night: 'Night Shift',
        onCall: 'On-call Day',
        onCallNight: 'On-call Night',
        overtime: 'Overtime',
      },
    },
    common: {
      actions: {
        cancel: 'Cancel',
      },
    },
  },
};

function StoreWorkspaceHarness() {
  const data = useScheduleMatrixStore((state) => state.data);
  const addShiftDefinition = useScheduleMatrixStore((state) => state.addShiftDefinition);
  const updateShiftDefinition = useScheduleMatrixStore((state) => state.updateShiftDefinition);
  const deleteShiftDefinition = useScheduleMatrixStore((state) => state.deleteShiftDefinition);
  const archiveShiftDefinition = useScheduleMatrixStore((state) => state.archiveShiftDefinition);
  const restoreShiftDefinition = useScheduleMatrixStore((state) => state.restoreShiftDefinition);
  const addUnit = useScheduleMatrixStore((state) => state.addUnit);
  const renameUnit = useScheduleMatrixStore((state) => state.renameUnit);
  const archiveUnit = useScheduleMatrixStore((state) => state.archiveUnit);
  const restoreUnit = useScheduleMatrixStore((state) => state.restoreUnit);
  const deleteUnit = useScheduleMatrixStore((state) => state.deleteUnit);
  const addMatrixRow = useScheduleMatrixStore((state) => state.addMatrixRow);
  const updateMatrixRow = useScheduleMatrixStore((state) => state.updateMatrixRow);
  const archiveMatrixRow = useScheduleMatrixStore((state) => state.archiveMatrixRow);
  const restoreMatrixRow = useScheduleMatrixStore((state) => state.restoreMatrixRow);
  const deleteMatrixRow = useScheduleMatrixStore((state) => state.deleteMatrixRow);

  if (!data) return null;

  return (
    <ScheduleSettingsWorkspace
      shiftTypesPanel={(
        <ScheduleSettingsPanel
          key="shift-types-panel"
          data={data}
          availableTabs={['shifts']}
          defaultTab="shifts"
          onAddShift={addShiftDefinition}
          onUpdateShift={updateShiftDefinition}
          onDeleteShift={deleteShiftDefinition}
          onArchiveShift={archiveShiftDefinition}
          onRestoreShift={restoreShiftDefinition}
          onAddUnit={addUnit}
          onRenameUnit={renameUnit}
          onArchiveUnit={archiveUnit}
          onRestoreUnit={restoreUnit}
          onDeleteUnit={(facilityId, unitId) => {
            deleteUnit(facilityId, unitId, true, 'Test Admin');
          }}
          onAddRow={addMatrixRow}
          onUpdateRow={updateMatrixRow}
          onArchiveRow={archiveMatrixRow}
          onRestoreRow={restoreMatrixRow}
          onDeleteRow={(rowId) => deleteMatrixRow(rowId, true)}
        />
      )}
      unitStructurePanel={(
        <ScheduleSettingsPanel
          key="unit-structure-panel"
          data={data}
          availableTabs={['units']}
          defaultTab="units"
          onAddShift={addShiftDefinition}
          onUpdateShift={updateShiftDefinition}
          onDeleteShift={deleteShiftDefinition}
          onArchiveShift={archiveShiftDefinition}
          onRestoreShift={restoreShiftDefinition}
          onAddUnit={addUnit}
          onRenameUnit={renameUnit}
          onArchiveUnit={archiveUnit}
          onRestoreUnit={restoreUnit}
          onDeleteUnit={(facilityId, unitId) => {
            deleteUnit(facilityId, unitId, true, 'Test Admin');
          }}
          onAddRow={addMatrixRow}
          onUpdateRow={updateMatrixRow}
          onArchiveRow={archiveMatrixRow}
          onRestoreRow={restoreMatrixRow}
          onDeleteRow={(rowId) => deleteMatrixRow(rowId, true)}
        />
      )}
      tableOrderPanel={<div>table-order-panel</div>}
    />
  );
}

async function renderHarness() {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'schedule',
    ns: ['schedule', 'common'],
    resources,
    interpolation: { escapeValue: false },
  });

  return render(
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>
        <StoreWorkspaceHarness />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('ScheduleSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    const data = createStructuredScheduleMatrixFixture(2026, 7);
    useScheduleMatrixStore.setState({
      data,
      matricesByMonth: {},
      draftsByMonth: {},
      snapshot: JSON.stringify(data),
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
      locale: 'en',
    });
  });

  afterEach(cleanup);

  it('adds shift definitions, units, and rows after switching between the restored settings workspace tabs', async () => {
    await renderHarness();

    fireEvent.change(screen.getByPlaceholderText('e.g. Morning / Evening'), {
      target: { value: 'Weekend Relief' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Shift Definition' }));

    expect(screen.getByDisplayValue('Weekend Relief')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Unit / Shift Structure' }));

    fireEvent.change(screen.getByPlaceholderText('e.g. ICU - Ward A / Emergency Department'), {
      target: { value: 'Test Unit Alpha' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Unit' }));

    expect(screen.getByDisplayValue('Test Unit Alpha')).toBeInTheDocument();

    const rowInputs = screen.getAllByPlaceholderText('New Row / Bed Name (e.g. Bed 1 - Morning)');
    fireEvent.change(rowInputs[rowInputs.length - 1], {
      target: { value: 'Test Row Coverage' },
    });

    const addRowButtons = screen.getAllByRole('button', { name: 'Add Row' });
    fireEvent.click(addRowButtons[addRowButtons.length - 1]);

    expect(screen.getByDisplayValue('Test Row Coverage')).toBeInTheDocument();
  });

  it('shows the active shift count and scroll hint once more than six shift cards exist', async () => {
    const state = useScheduleMatrixStore.getState();
    const facility = state.data!.facilities[0];
    const activeCount = state.data!.settings
      .find((entry) => entry.facilityId === facility.id)!
      .shiftDefinitions.filter((candidate) => !candidate.archived).length;
    const additionsNeeded = Math.max(0, 7 - activeCount);

    for (let index = 0; index < additionsNeeded; index += 1) {
      state.addShiftDefinition(facility.id, {
        label: `Overflow Shift ${index + 1}`,
        englishName: `Overflow Shift ${index + 1}`,
        startTime: '08:00',
        endTime: '17:00',
        timeRange: '08:00 - 17:00',
        colorKey: 'morning',
        icon: '',
        effectiveFromDay: 1,
      });
    }

    await renderHarness();

    expect(screen.getByText('7 shown')).toBeInTheDocument();
    expect(screen.getByText('Showing 7 active shift definitions. Scroll down to view every card.')).toBeInTheDocument();
  });

  it('scrolls and focuses the newly added unit so it becomes visible immediately', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    await renderHarness();

    fireEvent.click(screen.getByRole('tab', { name: 'Unit / Shift Structure' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. ICU - Ward A / Emergency Department'), {
      target: { value: 'Focused Unit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Unit' }));

    const createdInput = screen.getByDisplayValue('Focused Unit');
    expect(screen.getByText(/\d+ shown/)).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    await waitFor(() => expect(createdInput).toHaveFocus());
    expect(createdInput.closest('[data-highlighted="true"]')).toBeTruthy();
  });
});
