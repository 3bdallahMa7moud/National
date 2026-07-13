// ============================================================
// FacilityBand — Vertical facility label (frozen col 1)
// ============================================================

import { memo } from 'react';

interface FacilityBandProps {
  name: string;
  accentColorToken: string;
  /** Number of rows this band spans */
  rowCount: number;
}

function FacilityBand({ name, accentColorToken, rowCount }: FacilityBandProps) {
  return (
    <div
      className="facility-vertical-label relative flex justify-center text-white"
      style={{
        backgroundColor: `var(--${accentColorToken})`,
        width: 'var(--matrix-facility-col)',
        minWidth: 'var(--matrix-facility-col)',
        height: `calc(var(--matrix-row-height) * ${rowCount})`,
        gridRow: `span ${rowCount}`,
      }}
    >
      <span
        data-testid={`facility-label-${name.toLowerCase()}`}
        className="facility-vertical-text sticky top-[calc(var(--matrix-header-height)+8px)] flex h-24 items-center justify-center"
      >
        {name}
      </span>
    </div>
  );
}

export default memo(FacilityBand);
