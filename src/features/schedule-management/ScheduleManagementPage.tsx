// ============================================================
// ScheduleManagementPage — The Main Assembled Page
// ============================================================

import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useScheduleManagementStore } from './hooks/useScheduleManagementStore';
import { useScheduleData } from './hooks/useScheduleData';

// Components
import ScheduleToolbar from './components/ScheduleToolbar';
import StatisticsCards from './components/StatisticsCards';
import Filters from './components/Filters';
import Legend from './components/Legend';
import ScheduleTable from './components/grid/ScheduleTable';
import SideDrawer from './components/SideDrawer';
import ContextMenu from './components/ContextMenu';

export default function ScheduleManagementPage() {
  const { t } = useTranslation(['schedule', 'common']);

  // Store state
  const {
    year, month, setYear, setMonth, goToPrevMonth, goToNextMonth, goToToday,
    filters, setFilter, resetFilters,
    searchQuery, setSearchQuery, highlightedEmployeeId,
    collapsedDepartments, toggleDepartment,
    drawer, openDrawer, closeDrawer,
    contextMenu, openContextMenu, closeContextMenu,
    clipboard, copyToClipboard, clearClipboard,
  } = useScheduleManagementStore();

  // Data fetching & prep
  const {
    departments,
    gridRows,
    stats,
    monthDays,
  } = useScheduleData(year, month, filters, collapsedDepartments, searchQuery);

  // Handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: any, employee: any, date: string) => {
      // Keep menu within screen bounds
      const x = Math.min(e.clientX, window.innerWidth - 200);
      const y = Math.min(e.clientY, window.innerHeight - 200);
      openContextMenu({ x, y, entry, employee, date });
    },
    [openContextMenu]
  );

  return (
    <div className="flex flex-col space-y-5 pb-10">
      {/* 1. Toolbar */}
      <ScheduleToolbar
        year={year}
        month={month}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 2. Statistics */}
      <StatisticsCards stats={stats} />

      {/* 3. Filters & Legend Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <div className="flex-1">
          <Filters
            filters={filters}
            departments={departments}
            onFilterChange={setFilter}
            onReset={resetFilters}
          />
        </div>
        <div>
          <Legend />
        </div>
      </div>

      {/* 4. The Grid */}
      <ScheduleTable
        rows={gridRows}
        monthDays={monthDays}
        highlightedEmployeeId={highlightedEmployeeId}
        onToggleDepartment={toggleDepartment}
        collapsedDepartments={collapsedDepartments}
        onCellClick={openDrawer}
        onContextMenu={handleContextMenu}
      />

      {/* Overlays */}
      <SideDrawer drawer={drawer} onClose={closeDrawer} />
      <ContextMenu
        contextMenu={contextMenu}
        onClose={closeContextMenu}
        clipboardCategory={clipboard?.category}
        onCopy={(cat) => contextMenu?.entry && copyToClipboard(contextMenu.entry.id, cat)}
        onPaste={() => {
          // Toast or dispatch update here
        }}
        onDelete={() => {
          // Toast or dispatch delete here
        }}
      />
    </div>
  );
}
