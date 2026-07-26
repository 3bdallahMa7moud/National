import { expect, test, type Page } from '@playwright/test';

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

async function openMobileNavigation(page: Page, accessibleName: string) {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole('button', { name: accessibleName }).click();
  }
}

test('administrator signs in and opens employee management', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button').filter({ hasText: 'EMP-001' }).click();
  await expect(page.getByLabel('Email or Username')).toHaveValue('EMP-001');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('123456');

  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await openMobileNavigation(page, 'Open navigation menu');
  await page.getByRole('link', { name: 'Employees' }).click();

  await expect(page).toHaveURL(/\/admin\/employees$/);
  await expect(
    page.getByRole('heading', { name: 'Employee Management' }),
  ).toBeVisible();
});

test('employee uses the Arabic RTL experience and opens calendar sync', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.getByRole('button').filter({ hasText: 'EMP-002' }).click();
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await openMobileNavigation(page, 'فتح قائمة التنقل');
  await page.getByRole('link', { name: 'مزامنة التقويم' }).click();

  await expect(page).toHaveURL(/\/calendar-sync$/);
  await expect(page.getByRole('heading', { name: 'مزامنة التقويم' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
