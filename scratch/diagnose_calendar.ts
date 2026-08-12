/**
 * Diagnostic script: Inspect database state for Calendar Sync investigation.
 * Run with: npx tsx scratch/diagnose_calendar.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== CALENDAR SYNC DIAGNOSTIC ===\n');

  // 1. Check CalendarFeedTokens
  const tokens = await prisma.calendarFeedToken.findMany({
    include: { user: { select: { id: true, nameEn: true, scheduleEmployeeId: true, role: true } } },
  });
  console.log(`--- CalendarFeedTokens: ${tokens.length} ---`);
  for (const t of tokens) {
    console.log(`  Token ID: ${t.id}`);
    console.log(`  Token (first 8 chars): ${t.token.substring(0, 8)}...`);
    console.log(`  User: ${t.user.nameEn} (id=${t.user.id}, role=${t.user.role})`);
    console.log(`  scheduleEmployeeId: ${t.user.scheduleEmployeeId ?? '(NULL)'}`);
    console.log(`  revokedAt: ${t.revokedAt?.toISOString() ?? '(not revoked - ACTIVE)'}`);
    console.log(`  lastUsedAt: ${t.lastUsedAt?.toISOString() ?? '(never used)'}`);
    console.log();
  }

  // 2. Check ScheduleMonths
  const scheduleMonths = await prisma.scheduleMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  console.log(`--- ScheduleMonths: ${scheduleMonths.length} ---`);
  for (const sm of scheduleMonths) {
    console.log(`  monthKey: ${sm.monthKey}, year: ${sm.year}, month: ${sm.month}, status: ${sm.status}, deleted: ${sm.deleted}`);
    console.log(`  publishedJson is null: ${sm.publishedJson === null}`);
    console.log(`  draftJson is null: ${sm.draftJson === null}`);
    if (sm.publishedJson) {
      try {
        const parsed = JSON.parse(sm.publishedJson);
        console.log(`  publishedJson keys: ${Object.keys(parsed).join(', ')}`);
        console.log(`  publishedJson.year: ${parsed.year}`);
        console.log(`  publishedJson.month: ${parsed.month}`);
        if (parsed.facilities) {
          console.log(`  facilities count: ${parsed.facilities.length}`);
          for (const fac of parsed.facilities) {
            console.log(`    facility: ${fac.name}, units: ${fac.units?.length ?? 0}`);
            for (const unit of fac.units ?? []) {
              console.log(`      unit: ${unit.name}, rows: ${unit.rows?.length ?? 0}`);
              for (const row of unit.rows ?? []) {
                console.log(`        row: shiftLabel=${row.shiftLabel}, timeRange=${row.timeRange}`);
                const cellsByDay = row.cellsByDay ?? {};
                const days = Object.keys(cellsByDay);
                console.log(`        cellsByDay days count: ${days.length}`);
                // Show first 3 days with assignments
                let shown = 0;
                for (const [day, assignments] of Object.entries(cellsByDay)) {
                  if (Array.isArray(assignments) && assignments.length > 0 && shown < 3) {
                    console.log(`          day ${day}: ${JSON.stringify(assignments)}`);
                    shown++;
                  }
                }
                if (days.length > 3) console.log(`          ... and ${days.length - 3} more days`);
              }
            }
          }
        } else {
          console.log(`  publishedJson does NOT have 'facilities' key`);
          console.log(`  Full publishedJson (first 500 chars): ${sm.publishedJson.substring(0, 500)}`);
        }
      } catch (e) {
        console.log(`  publishedJson parse error: ${e}`);
      }
    }
    console.log();
  }

  // 3. Check OvertimeMonths
  const overtimeMonths = await prisma.overtimeMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  console.log(`--- OvertimeMonths: ${overtimeMonths.length} ---`);
  for (const om of overtimeMonths) {
    console.log(`  monthKey: ${om.monthKey}, status: ${om.status}, deleted: ${om.deleted}`);
    console.log(`  publishedRowsJson (first 200 chars): ${om.publishedRowsJson.substring(0, 200)}`);
    try {
      const rows = JSON.parse(om.publishedRowsJson);
      console.log(`  publishedRows count: ${Array.isArray(rows) ? rows.length : 'not an array'}`);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          console.log(`    row: title=${row.title}, location=${row.location}, timeRange=${row.timeRange}`);
          const assignments = row.assignments ?? {};
          const days = Object.keys(assignments);
          console.log(`    assignment days: [${days.join(', ')}]`);
        }
      }
    } catch (e) {
      console.log(`  publishedRowsJson parse error: ${e}`);
    }
    console.log();
  }

  // 4. Check all users with scheduleEmployeeId
  const users = await prisma.user.findMany({
    select: { id: true, nameEn: true, role: true, scheduleEmployeeId: true },
  });
  console.log(`--- Users ---`);
  for (const u of users) {
    console.log(`  ${u.nameEn} (id=${u.id}): scheduleEmployeeId=${u.scheduleEmployeeId ?? '(NULL)'}, role=${u.role}`);
  }

  // 5. Simulate ICS generation for each active token
  console.log('\n--- ICS Event Count Simulation ---');
  for (const t of tokens.filter(tok => !tok.revokedAt)) {
    const user = t.user;
    console.log(`\nUser: ${user.nameEn} (scheduleEmployeeId=${user.scheduleEmployeeId ?? 'NULL'})`);
    
    if (!user.scheduleEmployeeId) {
      console.log('  RESULT: No scheduleEmployeeId → 0 events!');
      continue;
    }

    let scheduleEventCount = 0;
    const publishedScheduleMonths = scheduleMonths.filter(sm => sm.publishedJson !== null);
    console.log(`  Published schedule months available: ${publishedScheduleMonths.length}`);
    
    for (const sm of publishedScheduleMonths) {
      try {
        const matrix = JSON.parse(sm.publishedJson!);
        if (!matrix?.facilities || typeof matrix.year !== 'number' || typeof matrix.month !== 'number') {
          console.log(`    ${sm.monthKey}: Invalid matrix structure`);
          continue;
        }
        for (const fac of matrix.facilities) {
          for (const unit of fac.units ?? []) {
            for (const row of unit.rows ?? []) {
              for (const [dayText, assignments] of Object.entries(row.cellsByDay ?? {})) {
                const day = Number(dayText);
                if (!Number.isInteger(day)) continue;
                const assignment = (assignments as any[]).find(
                  (item: any) => item.employeeId === user.scheduleEmployeeId && item.status !== 'draft'
                );
                if (assignment) {
                  scheduleEventCount++;
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    let overtimeEventCount = 0;
    for (const om of overtimeMonths) {
      try {
        const rows = JSON.parse(om.publishedRowsJson);
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          for (const [, assignments] of Object.entries(row.assignments ?? {})) {
            const assignment = (assignments as any[]).find(
              (item: any) => item.kind === 'employee' && item.employeeId === user.scheduleEmployeeId
            );
            if (assignment) {
              overtimeEventCount++;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    console.log(`  Schedule events: ${scheduleEventCount}`);
    console.log(`  Overtime events: ${overtimeEventCount}`);
    console.log(`  TOTAL: ${scheduleEventCount + overtimeEventCount}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
