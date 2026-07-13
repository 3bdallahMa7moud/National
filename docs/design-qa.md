# Schedule and OT design QA

## References and implemented state

- Schedule reference: `CT schdule MAY 2026.xlsx`.
- OT reference: `OT FORM - 9 july 26.xlsx`, sheet `JULY 2026`, rendered locally as `tmp/ot-form-july-2026-reference.png`.
- Implemented routes: `/admin/schedule`, `/admin/late-schedule`, and `/admin/reports`.
- The shared operational roster contains the approved 29 employees; account-management identities remain separate.

## Verified checks

- Schedule Management retains Comfortable/Edit only; no alternate compact-mode control remains.
- OT desktop, Excel, and PDF use the July source structure, palette, row labels, notice, 1–31 day columns, weekend shading, and the 29-person legend.
- OT mobile uses a seven-day weekly editor rather than compressing the monthly table.
- OT cells accept zero, one, or two employees; unresolved retired codes are visibly suffixed with `?` in both exports.
- Schedule and OT feed Employee Analysis through the same stable employee IDs and active period.
- Analysis day/week/month/year filters and both exports use the same filtered rows. Generated and draft Schedule months are excluded until publication.
- Auth recovery steps use the same 460px split-layout geometry as Sign In.
- Automated verification: 41 test files / 120 tests passed, targeted task ESLint passed, and the production build passed.

## Visual verification status

The source workbook was captured and inspected. A final same-viewport reference-versus-browser screenshot comparison still requires an open in-app Browser tab; no Browser target was available during this run, so no unsupported visual-pass claim is recorded here.

final result: automated checks passed; interactive visual comparison pending
