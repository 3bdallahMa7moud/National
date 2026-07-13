// ============================================================
// EmployeeLegendPanel — Employee Code/Initials Legend & Highlighter
// ============================================================
// Dark navy design matching the OT Schedule Legend panel.
// Allows searching by initials/name and clicking any employee to
// highlight their row in the ScheduleTable grid.

import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Check, X } from 'lucide-react';
import type { ScheduleEmployee } from '../types/schedule';

interface EmployeeLegendPanelProps {
  employees: ScheduleEmployee[];
  highlightedEmployeeId: string | null;
  onEmployeeClick: (employeeId: string | null) => void;
}

function EmployeeLegendPanel({
  employees,
  highlightedEmployeeId,
  onEmployeeClick,
}: EmployeeLegendPanelProps) {
  const { i18n } = useTranslation(['common']);
  const isRtl = i18n.language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(
      (emp) =>
        emp.initials.toLowerCase().includes(q) ||
        emp.name.toLowerCase().includes(q) ||
        emp.employeeNumber.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const highlightedEmp = employees.find((e) => e.id === highlightedEmployeeId);

  return (
    <div
      className="h-full flex flex-col rounded-xl overflow-hidden shadow-xl"
      style={{ background: '#0d1b2a', border: '1px solid #1e3a5f' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e3a5f' }}
      >
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4" style={{ color: '#2dd4bf' }} />
          <h3 className="font-bold text-sm" style={{ color: '#e2e8f0' }}>
            {isRtl ? 'رموز الموظفين (Legend)' : 'Employee Legend'}
          </h3>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold"
          style={{ background: '#1e3a5f', color: '#94a3b8' }}
        >
          {employees.length}
        </span>
      </div>

      {/* ── Highlighted Employee Banner ── */}
      {highlightedEmployeeId && highlightedEmp && (
        <div
          className="mx-3 mt-3 flex items-center justify-between rounded-lg px-3 py-2 flex-shrink-0"
          style={{
            background: 'rgba(45,212,191,0.12)',
            border: '1px solid rgba(45,212,191,0.25)',
          }}
        >
          <div className="truncate pe-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#2dd4bf' }}
            >
              {isRtl ? 'الموظف المحدد للتمييز' : 'Highlighted Employee'}
            </p>
            <p className="text-xs font-bold truncate" style={{ color: '#e2e8f0' }}>
              {highlightedEmp.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEmployeeClick(null)}
            className="rounded-lg p-1 flex-shrink-0 transition-colors"
            style={{ color: '#2dd4bf' }}
            title={isRtl ? 'إلغاء التمييز' : 'Clear Highlight'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="relative mx-3 mt-3 mb-2 flex-shrink-0">
        <Search
          className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
          style={{ color: '#64748b' }}
        />
        <input
          type="text"
          placeholder={isRtl ? 'بحث بالرمز أو الاسم...' : 'Search code or name...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg py-2 ps-9 pe-3 text-xs outline-none transition-all"
          style={{
            background: '#1a2d42',
            border: '1px solid #1e3a5f',
            color: '#e2e8f0',
          }}
        />
      </div>

      {/* ── Employee List ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {filteredEmployees.map((emp) => {
          const isSelected = highlightedEmployeeId === emp.id;
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onEmployeeClick(isSelected ? null : emp.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition-all"
              style={{
                background: isSelected ? 'rgba(45,212,191,0.12)' : '#132033',
                border: isSelected
                  ? '1px solid rgba(45,212,191,0.4)'
                  : '1px solid #1e3a5f',
                boxShadow: isSelected ? '0 0 0 1px rgba(45,212,191,0.15)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#1a2d42';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d4a6a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#132033';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e3a5f';
                }
              }}
            >
              {/* Teal Code Badge */}
              <span
                className="flex h-7 min-w-[32px] items-center justify-center rounded-lg font-mono text-[11px] font-bold flex-shrink-0 px-1.5"
                style={{
                  background: isSelected
                    ? '#2dd4bf'
                    : 'linear-gradient(135deg, #0d9488, #14b8a6)',
                  color: isSelected ? '#0f172a' : '#ffffff',
                  boxShadow: isSelected
                    ? '0 0 8px rgba(45,212,191,0.5)'
                    : '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {emp.initials}
              </span>

              {/* Name & Department */}
              <div className="min-w-0 flex-1">
                <p
                  className="font-medium text-xs truncate"
                  style={{ color: isSelected ? '#2dd4bf' : '#e2e8f0' }}
                >
                  {emp.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: '#64748b' }}>
                  {emp.departmentName}
                </p>
              </div>

              {/* Check indicator */}
              {isSelected && (
                <Check
                  className="h-3.5 w-3.5 flex-shrink-0 ms-1"
                  style={{ color: '#2dd4bf' }}
                />
              )}
            </button>
          );
        })}

        {filteredEmployees.length === 0 && (
          <p className="py-8 text-center text-xs" style={{ color: '#64748b' }}>
            {isRtl ? 'لا يوجد موظف مطابق للبحث' : 'No matching employee'}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(EmployeeLegendPanel);
