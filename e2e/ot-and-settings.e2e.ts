import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const browserStorage = globalThis as unknown as {
      localStorage: { clear(): void; setItem(key: string, value: string): void };
      sessionStorage: { clear(): void };
    };
    browserStorage.localStorage.clear();
    browserStorage.sessionStorage.clear();
    browserStorage.localStorage.setItem('app-language', 'en');
  });
});

async function login(page: Page, identifier: string) {
  await page.goto('/login');
  await page.getByLabel('Email or Username').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function openScheduleSettings(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByText('More actions').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    return;
  }
  await page.getByRole('button', { name: 'Settings' }).click();
}

test('OT schedule supports August 2026 direct links and Excel/PDF export', async ({ page }) => {
  await page.addInitScript(() => {
    const browserGlobals = globalThis as unknown as {
      document: { documentElement: { setAttribute(name: string, value: string): void } };
    };
    Object.defineProperty(browserGlobals, 'print', {
      configurable: true,
      value: () => browserGlobals.document.documentElement.setAttribute('data-print-invoked', 'true'),
    });
  });
  await login(page, 'EMP-001');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByLabel('Operational date').fill('2026-08-15');
  await page.getByRole('link', { name: 'Review OT' }).click();
  await expect(page).toHaveURL(/\/admin\/late-schedule\?year=2026&month=8/);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.getByText(/^August 2026$/).first()).toBeVisible();

  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  expect((await excelDownload).suggestedFilename()).toBe('OT_Schedule_2026-08.xlsx');

  await page.getByRole('button', { name: 'PDF' }).click();
  const printDocument = page.frameLocator('iframe[aria-hidden="true"]');
  await expect.poll(() => printDocument.locator('title').textContent()).toBe('OT_Schedule_2026-08');
  await expect(printDocument.locator('body')).toContainText('OT Schedule');
  await expect.poll(() => printDocument.locator('html').getAttribute('data-print-invoked')).toBe('true');
});

test('Schedule Management settings workspace remains reachable and operable', async ({ page }) => {
  await login(page, 'EMP-001');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByLabel('Operational date').fill('2026-08-15');
  await page.getByRole('link', { name: 'Open Schedule' }).first().click();
  await expect(page).toHaveURL(/\/admin\/schedule\?date=2026-08-15/);

  await openScheduleSettings(page);
  await expect(page.getByRole('tablist', { name: 'Schedule settings sections' })).toBeVisible();
  const tableOrderTab = page.getByRole('tab', { name: 'Table Order' });
  await tableOrderTab.click();
  await expect(tableOrderTab).toHaveAttribute('aria-selected', 'true');
  const shiftTypesTab = page.getByRole('tab', { name: 'Shift Types & Schedule Codes' });
  await shiftTypesTab.click();
  await expect(shiftTypesTab).toHaveAttribute('aria-selected', 'true');
});
