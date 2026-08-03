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

test('protected routes redirect to login and authenticated users can log out', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('button').filter({ hasText: 'EMP-001' }).click();
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Log Out' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('public signup verifies email with OTP and then signs in normally', async ({ page }, testInfo) => {
  const uniqueSuffix = `${testInfo.project.name.replace(/[^a-z0-9]/gi, '').toLowerCase()}-${testInfo.retry}-${Date.now()}`;
  const signupEmail = `playwright.signup+${uniqueSuffix}@hospital.sa`;
  const employeeNumber = `EMP-${uniqueSuffix.slice(-10).toUpperCase()}`;

  await page.goto('/register');

  await page.getByLabel('Full name').fill('Playwright Signup');
  await page.getByLabel('Institutional email').fill(signupEmail);
  await page.getByLabel('Employee number').fill(employeeNumber);
  await page.getByLabel('Mobile number').fill('0501999999');
  await page.getByLabel('Job title').fill('Technologist');
  await page.getByLabel('Department').selectOption({ index: 1 });
  await page.getByLabel('Password', { exact: true }).fill('signup-pass-123');
  await page.getByLabel('Confirm password', { exact: true }).fill('signup-pass-123');
  await page.getByRole('button', { name: 'Create account & send code' }).click();

  await expect(page.getByText('Current development code')).toBeVisible();
  const otp = (await page.locator('p').filter({ hasText: /^\d{6}$/ }).first().textContent())?.trim();
  expect(otp).toMatch(/^\d{6}$/);

  await page.getByLabel('Digit 1 of 6').fill(otp ?? '');
  await page.getByRole('button', { name: 'Verify code & activate account' }).click();

  await expect(page.getByText('Your email has been verified')).toBeVisible();
  await page.getByRole('button', { name: 'Go to Sign In' }).click();

  await page.getByLabel('Email or Username').fill(signupEmail);
  await page.getByLabel('Password', { exact: true }).fill('signup-pass-123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/employee\/dashboard$/);
});
