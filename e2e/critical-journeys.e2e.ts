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
    const initMarker = '__pw_storage_initialized__';
    if (globalThis.window.name.includes(initMarker)) {
      return;
    }
    globalThis.window.name = `${globalThis.window.name} ${initMarker}`.trim();
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

async function expectGenerateScheduleAvailability(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByText('More Actions').click();
    await expect(page.getByRole('button', { name: 'Generate Schedule' })).toBeVisible();
    return;
  }

  await expect(page.locator('button[aria-label="Generate Schedule"]:visible')).toBeVisible();
}

async function expectScheduleRowsVisible(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await expect(page.getByText('GE VCT').first()).toBeVisible();
    return;
  }

  await expect(page.getByTestId('facility-label-kamc').first()).toBeVisible();
  await expect(page.getByText('GE VCT').first()).toBeVisible();
}

test('administrator signs in, restores the session after reload, and opens employee management', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email or Username').fill('EMP-001');
  await page.getByLabel('Password', { exact: true }).fill('123456');

  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.reload();
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

  await page.locator('input[name="identifier"]').fill('EMP-002');
  await page.locator('input[name="password"]').fill('123456');
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

test('protected routes redirect to login and authenticated users can log out', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email or Username').fill('EMP-001');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Log Out' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('login page does not expose public registration', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Create account' })).toHaveCount(0);
});

test('administrator can open Schedule Management for August 2026 and rows survive a reload', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email or Username').fill('EMP-001');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByLabel('Operational date').fill('2026-08-17');
  await page.getByRole('link', { name: 'Open Schedule' }).first().click();
  await expect(page).toHaveURL(/\/admin\/schedule\?date=2026-08-17$/);
  await expect(page.getByRole('heading', { name: 'Monthly Schedule Management' }).first()).toBeVisible();
  await expectGenerateScheduleAvailability(page);
  await expectScheduleRowsVisible(page);

  await page.reload();

  await expect(page).toHaveURL(/\/admin\/schedule\?date=2026-08-17$/);
  await expectGenerateScheduleAvailability(page);
  await expectScheduleRowsVisible(page);
});
