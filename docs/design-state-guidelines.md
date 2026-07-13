# UI state and accessibility guidelines

These rules apply to every scheduling, employee, department, and reporting screen.

## Required states

- Loading: use `LoadingSkeleton` with `role="status"`; preserve the final layout dimensions to avoid jumps.
- Empty: use `EmptyState` with a clear explanation and one recovery action when available.
- Error: use `ErrorState`; include retry only when the operation is safe to repeat.
- Offline: keep the last readable data visible, disable write actions, and show a persistent connection banner.
- Permission denied: explain which role is required and provide a safe route back.
- Unsaved changes: keep the schedule draft banner visible until publish or discard completes.
- Save/publish success: announce the result through the toast live region and keep the changed item in context.
- Export: show a progress state, prevent duplicate exports, and announce success or failure.

## Interaction rules

- Interactive targets are at least 44 × 44 CSS pixels.
- Icon-only controls require a localized accessible name and a visible tooltip where the icon is ambiguous.
- Keyboard focus must remain visible in light and dark modes.
- Status is never communicated by color alone; pair color with text, an icon, or a pattern.
- Dialogs receive focus on open, close with Escape, and return focus to the launching control.

## Responsive schedule

- Below 768px, use the weekly schedule and day details instead of compressing the monthly matrix.
- The page itself must not scroll horizontally. Horizontal scrolling is limited to clearly labelled day strips.
- KAMC, KASCH, WHH, employee codes, and official equipment names remain Latin. Operational labels, weekdays, filters, dates, and messages follow the selected locale.

## Acceptance matrix

Review 390, 768, 1024, and 1440px widths in Arabic and English, light and dark modes, keyboard-only navigation, and 200% browser zoom.
