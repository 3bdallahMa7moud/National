import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const browserStorage = globalThis as unknown as {
      localStorage: {
        clear(): void;
        setItem(key: string, value: string): void;
      };
      sessionStorage: {
        clear(): void;
      };
    };
    browserStorage.localStorage.clear();
    browserStorage.sessionStorage.clear();
    browserStorage.localStorage.setItem('app-language', 'en');
  });
});

test('administrator can add shift definitions, units, and rows from schedule settings', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/login');
  await page.getByLabel('Email or Username').fill('EMP-001');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByLabel('Operational date').fill('2026-08-17');
  await page.getByRole('link', { name: 'Open Schedule' }).first().click();
  await expect(page).toHaveURL(/\/admin\/schedule\?date=2026-08-17$/);

  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByText('More Actions').click();
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('tab', { name: 'Shift Types & Schedule Codes' })).toHaveAttribute('aria-selected', 'true');

  await page.getByPlaceholder('e.g. Morning / Evening').fill('Weekend Relief');
  await page.getByRole('button', { name: 'Add Shift Definition' }).click();
  await expect(page.locator('input[value="Weekend Relief"]').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Unit / Shift Structure' }).click();
  await page.getByPlaceholder('e.g. ICU - Ward A / Emergency Department').fill('Room X');
  await page.getByRole('button', { name: 'Add Unit' }).click();
  await expect(page.locator('input[value="Room X"]').first()).toBeVisible();

  const rowInput = page.getByPlaceholder('New Row / Bed Name (e.g. Bed 1 - Morning)').last();
  await rowInput.fill('Bed X1');
  await page.getByRole('button', { name: 'Add Row' }).last().click();
  await expect(page.locator('input[value="Bed X1"]').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
