import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/i18n';
import type { AuthUser } from '@/types';
import ProfileIdentityCard from './ProfileIdentityCard';

const mocks = vi.hoisted(() => ({
  saveEmail: vi.fn(),
  changePassword: vi.fn(),
}));

describe('ProfileIdentityCard', () => {
  beforeEach(async () => {
    await changeLanguage('ar');
    mocks.saveEmail.mockReset();
    mocks.changePassword.mockReset();
  });

  it('renders all employee details added during creation', () => {
    const user: AuthUser = {
      id: 'emp-101',
      name: 'محمد السعيد',
      email: 'mohammed@hospital.sa',
      role: 'employee',
      departmentId: 'dept-1',
      departmentName: 'قسم الأشعة',
      position: 'أخصائي أول أشعة',
      employeeNumber: '45892',
      code: 'MS',
      phone: '0501234567',
    };

    render(
      <ProfileIdentityCard
        user={user}
        onSaveEmail={mocks.saveEmail}
        onChangePassword={mocks.changePassword}
      />,
    );

    expect(screen.getByText('محمد السعيد')).toBeInTheDocument();
    expect(screen.getAllByText('45892').length).toBeGreaterThan(0);
    expect(screen.getAllByText('أخصائي أول أشعة').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MS').length).toBeGreaterThan(0);
    expect(screen.getByText('0501234567')).toBeInTheDocument();
    expect(screen.getAllByText('قسم الأشعة').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mohammed@hospital.sa').length).toBeGreaterThan(0);
  });

  it('renders correctly for super admin and admin roles', async () => {
    await changeLanguage('en');
    const superAdmin: AuthUser = {
      id: 'user-sa',
      name: 'Super Administrator',
      email: 'admin@hospital.sa',
      role: 'super_admin',
      departmentId: 'dept-1',
      departmentName: 'Radiology',
      position: 'System Administrator',
      employeeNumber: '99001',
      code: 'SA',
      phone: '0555555555',
    };

    render(
      <ProfileIdentityCard
        user={superAdmin}
        onSaveEmail={mocks.saveEmail}
        onChangePassword={mocks.changePassword}
      />,
    );

    expect(screen.getByText('Super Administrator')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getAllByText('99001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('System Administrator').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SA').length).toBeGreaterThan(0);
    expect(screen.getByText('0555555555')).toBeInTheDocument();
    expect(screen.getAllByText('Radiology').length).toBeGreaterThan(0);
  });
});
