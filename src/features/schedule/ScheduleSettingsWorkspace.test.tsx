import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleSettingsWorkspace from './ScheduleSettingsWorkspace';

const resources = {
  en: {
    schedule: {
      settingsPanel: {
        workspace: {
          ariaLabel: 'Schedule settings sections',
          shiftTypes: 'Shift Types & Schedule Codes',
          unitStructure: 'Unit / Shift Structure',
          tableOrder: 'Table Order',
        },
      },
    },
  },
  ar: {
    schedule: {
      settingsPanel: {
        workspace: {
          ariaLabel: 'أقسام إعدادات الجدول',
          shiftTypes: 'أنواع الشفتات وأكواد الجدول',
          unitStructure: 'هيكل الوحدات والشفتات',
          tableOrder: 'ترتيب الجدول',
        },
      },
    },
  },
};

async function renderWorkspace(
  language: 'en' | 'ar',
  onShiftMount = vi.fn(),
  onStructureMount = vi.fn(),
  onOrderMount = vi.fn(),
) {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'schedule',
    ns: ['schedule'],
    resources,
    interpolation: { escapeValue: false },
  });

  function Panel({ label, onMount }: { label: string; onMount: () => void }) {
    useEffect(() => {
      onMount();
    }, [onMount]);
    return <div>{label}</div>;
  }

  return render(
    <I18nextProvider i18n={i18n}>
      <ScheduleSettingsWorkspace
        shiftTypesPanel={<Panel label="shift-types-content" onMount={onShiftMount} />}
        unitStructurePanel={<Panel label="unit-structure-content" onMount={onStructureMount} />}
        tableOrderPanel={<Panel label="table-order-content" onMount={onOrderMount} />}
      />
    </I18nextProvider>,
  );
}

afterEach(cleanup);

describe('ScheduleSettingsWorkspace', () => {
  it('mounts only the selected panel and switches between the three settings views', async () => {
    const onShiftMount = vi.fn();
    const onStructureMount = vi.fn();
    const onOrderMount = vi.fn();
    await renderWorkspace('en', onShiftMount, onStructureMount, onOrderMount);

    const shiftTab = screen.getByRole('tab', { name: 'Shift Types & Schedule Codes' });
    const structureTab = screen.getByRole('tab', { name: 'Unit / Shift Structure' });
    const orderTab = screen.getByRole('tab', { name: 'Table Order' });

    expect(screen.getByRole('tablist', { name: 'Schedule settings sections' })).toBeInTheDocument();
    expect(shiftTab).toHaveAttribute('aria-selected', 'true');
    expect(structureTab).toHaveAttribute('aria-selected', 'false');
    expect(orderTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('shift-types-content')).toBeInTheDocument();
    expect(screen.queryByText('unit-structure-content')).not.toBeInTheDocument();
    expect(screen.queryByText('table-order-content')).not.toBeInTheDocument();
    expect(onShiftMount).toHaveBeenCalledTimes(1);
    expect(onStructureMount).not.toHaveBeenCalled();
    expect(onOrderMount).not.toHaveBeenCalled();

    fireEvent.click(structureTab);

    expect(shiftTab).toHaveAttribute('aria-selected', 'false');
    expect(structureTab).toHaveAttribute('aria-selected', 'true');
    expect(orderTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('shift-types-content')).not.toBeInTheDocument();
    expect(screen.getByText('unit-structure-content')).toBeInTheDocument();
    expect(screen.queryByText('table-order-content')).not.toBeInTheDocument();
    expect(onStructureMount).toHaveBeenCalledTimes(1);

    fireEvent.click(orderTab);

    expect(shiftTab).toHaveAttribute('aria-selected', 'false');
    expect(structureTab).toHaveAttribute('aria-selected', 'false');
    expect(orderTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('shift-types-content')).not.toBeInTheDocument();
    expect(screen.queryByText('unit-structure-content')).not.toBeInTheDocument();
    expect(screen.getByText('table-order-content')).toBeInTheDocument();
    expect(onOrderMount).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard tab navigation and exposes the Arabic labels', async () => {
    await renderWorkspace('ar');

    const shiftTab = screen.getByRole('tab', { name: 'أنواع الشفتات وأكواد الجدول' });
    const structureTab = screen.getByRole('tab', { name: 'هيكل الوحدات والشفتات' });
    const orderTab = screen.getByRole('tab', { name: 'ترتيب الجدول' });
    expect(screen.getByRole('tablist', { name: 'أقسام إعدادات الجدول' })).toBeInTheDocument();

    shiftTab.focus();
    fireEvent.keyDown(shiftTab, { key: 'ArrowLeft' });

    expect(structureTab).toHaveFocus();
    expect(structureTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('unit-structure-content')).toBeInTheDocument();

    fireEvent.keyDown(structureTab, { key: 'ArrowLeft' });

    expect(orderTab).toHaveFocus();
    expect(orderTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('table-order-content')).toBeInTheDocument();
  });
});
