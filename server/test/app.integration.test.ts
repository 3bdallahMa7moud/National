import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clearAllRateLimits } from '../src/lib/rateLimit.js';
import {
  buildRequesterAssignment,
  ids,
  login,
  makeAgent,
  prismaClient,
  resetDatabase,
  seedBaseData,
} from './helpers.js';

const app = createApp();
const prisma = prismaClient();

function signupPayload(overrides: Partial<{
  name: string;
  email: string;
  employeeNumber: string;
  phone: string;
  position: string;
  departmentId: string;
  password: string;
  role: string;
}> = {}) {
  return {
    name: 'Noura Signup',
    email: 'noura.signup@hospital.sa',
    employeeNumber: 'EMP-950',
    phone: '0501555555',
    position: 'Technologist',
    departmentId: ids.department,
    password: 'signup-pass-123',
    ...overrides,
  };
}

describe('server integration', () => {
  beforeEach(async () => {
    clearAllRateLimits();
    await resetDatabase();
    await seedBaseData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('auth: login, session restore, protected route, and logout work', async () => {
    const agent = makeAgent(app);

    const unauthorized = await agent.get('/api/auth/session');
    expect(unauthorized.status).toBe(401);

    const loginResponse = await login(agent, 'super@hospital.sa');
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe('super_admin');

    const sessionResponse = await agent.get('/api/auth/session');
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.id).toBe(ids.superAdmin);

    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(204);

    const sessionAfterLogout = await agent.get('/api/auth/session');
    expect(sessionAfterLogout.status).toBe(401);
  });

  it('auth: invalid credentials are rejected', async () => {
    const agent = makeAgent(app);
    const response = await agent.post('/api/auth/login').send({
      identifier: 'super@hospital.sa',
      password: 'wrong-password',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('auth: signup request validates input, rejects verified duplicates, creates an unverified account, and ignores privileged role input', async () => {
    const agent = makeAgent(app);

    const options = await agent.get('/api/auth/signup/options');
    expect(options.status).toBe(200);
    expect(options.body.departments).toEqual([
      {
        id: ids.department,
        name: {
          en: 'CT Testing Department',
          ar: 'قسم الاختبار',
        },
      },
    ]);

    const invalid = await agent.post('/api/auth/signup/request').send({
      email: 'not-an-email',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const duplicate = await agent.post('/api/auth/signup/request').send(signupPayload({
      email: 'ali@hospital.sa',
      employeeNumber: 'EMP-951',
    }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    const signup = await agent.post('/api/auth/signup/request').send(signupPayload({
      role: 'admin',
    }));
    expect(signup.status).toBe(201);
    expect(signup.body.verificationRequired).toBe(true);
    expect(signup.body.maskedEmail).toContain('@hospital.sa');
    expect(signup.body.devCode).toMatch(/^\d{6}$/);

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'noura.signup@hospital.sa' },
      include: { emailVerificationCodes: true },
    });
    expect(createdUser.role).toBe('employee');
    expect(createdUser.isActive).toBe(false);
    expect(createdUser.emailVerifiedAt).toBeNull();
    expect(createdUser.passwordHash).not.toBe('signup-pass-123');
    expect(createdUser.emailVerificationCodes).toHaveLength(1);
    expect(createdUser.emailVerificationCodes[0].codeHash).not.toBe(signup.body.devCode);
  });

  it('auth: signup options auto-seed a default department in non-production when the database is empty', async () => {
    await resetDatabase();

    const agent = makeAgent(app);
    const response = await agent.get('/api/auth/signup/options');

    expect(response.status).toBe(200);
    expect(response.body.departments).toEqual([
      {
        id: 'dept-1',
        name: {
          en: 'CT Scan Department',
          ar: 'قسم الأشعة المقطعية',
        },
      },
    ]);

    const storedDepartments = await prisma.department.findMany({
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
      },
    });
    expect(storedDepartments).toEqual([
      {
        id: 'dept-1',
        nameEn: 'CT Scan Department',
        nameAr: 'قسم الأشعة المقطعية',
      },
    ]);
  });

  it('auth: unverified signup cannot log in until OTP verification succeeds, and the verified account can then log in', async () => {
    const agent = makeAgent(app);
    const signup = await agent.post('/api/auth/signup/request').send(signupPayload());
    expect(signup.status).toBe(201);

    const unverifiedLogin = await agent.post('/api/auth/login').send({
      identifier: 'noura.signup@hospital.sa',
      password: 'signup-pass-123',
    });
    expect(unverifiedLogin.status).toBe(403);
    expect(unverifiedLogin.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');

    const verify = await agent.post('/api/auth/signup/verify').send({
      email: 'noura.signup@hospital.sa',
      code: signup.body.devCode,
    });
    expect(verify.status).toBe(200);
    expect(verify.body.ok).toBe(true);

    const verifiedUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'noura.signup@hospital.sa' },
    });
    expect(verifiedUser.isActive).toBe(true);
    expect(verifiedUser.emailVerifiedAt).not.toBeNull();

    const verifiedLogin = await agent.post('/api/auth/login').send({
      identifier: 'noura.signup@hospital.sa',
      password: 'signup-pass-123',
    });
    expect(verifiedLogin.status).toBe(200);
    expect(verifiedLogin.body.user.role).toBe('employee');
  });

  it('auth: signup verification rejects incorrect, expired, max-attempt, and reused OTPs', async () => {
    const wrongCodeAgent = makeAgent(app);
    const signup = await wrongCodeAgent.post('/api/auth/signup/request').send(signupPayload());
    expect(signup.status).toBe(201);

    const wrongCode = await wrongCodeAgent.post('/api/auth/signup/verify').send({
      email: 'noura.signup@hospital.sa',
      code: '111111',
    });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe('INVALID_SIGNUP_OTP');

    await prisma.emailVerificationCode.updateMany({
      where: { userId: signup.body.userId },
      data: {
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    const expiredCode = await wrongCodeAgent.post('/api/auth/signup/verify').send({
      email: 'noura.signup@hospital.sa',
      code: signup.body.devCode,
    });
    expect(expiredCode.status).toBe(400);
    expect(expiredCode.body.error.code).toBe('SIGNUP_OTP_EXPIRED');

    const attemptsAgent = makeAgent(app);
    const attemptsSignup = await attemptsAgent.post('/api/auth/signup/request').send(signupPayload({
      email: 'attempts.signup@hospital.sa',
      employeeNumber: 'EMP-952',
    }));
    expect(attemptsSignup.status).toBe(201);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await attemptsAgent.post('/api/auth/signup/verify').send({
        email: 'attempts.signup@hospital.sa',
        code: '222222',
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_SIGNUP_OTP');
    }

    const maxAttempt = await attemptsAgent.post('/api/auth/signup/verify').send({
      email: 'attempts.signup@hospital.sa',
      code: '222222',
    });
    expect(maxAttempt.status).toBe(429);
    expect(maxAttempt.body.error.code).toBe('SIGNUP_OTP_ATTEMPTS_EXCEEDED');

    const blockedAfterMax = await attemptsAgent.post('/api/auth/signup/verify').send({
      email: 'attempts.signup@hospital.sa',
      code: attemptsSignup.body.devCode,
    });
    expect(blockedAfterMax.status).toBe(429);
    expect(blockedAfterMax.body.error.code).toBe('SIGNUP_OTP_ATTEMPTS_EXCEEDED');

    const reuseAgent = makeAgent(app);
    const reuseSignup = await reuseAgent.post('/api/auth/signup/request').send(signupPayload({
      email: 'reuse.signup@hospital.sa',
      employeeNumber: 'EMP-953',
    }));
    expect(reuseSignup.status).toBe(201);

    const firstVerify = await reuseAgent.post('/api/auth/signup/verify').send({
      email: 'reuse.signup@hospital.sa',
      code: reuseSignup.body.devCode,
    });
    expect(firstVerify.status).toBe(200);

    const reusedCode = await reuseAgent.post('/api/auth/signup/verify').send({
      email: 'reuse.signup@hospital.sa',
      code: reuseSignup.body.devCode,
    });
    expect(reusedCode.status).toBe(409);
    expect(reusedCode.body.error.code).toBe('SIGNUP_OTP_ALREADY_USED');
  }, 20_000);

  it('auth: signup resend enforces cooldown, invalidates previous codes, and rate limits repeated requests', async () => {
    const agent = makeAgent(app);
    const signup = await agent.post('/api/auth/signup/request').send(signupPayload());
    expect(signup.status).toBe(201);

    const cooldown = await agent.post('/api/auth/signup/resend').send({
      email: 'noura.signup@hospital.sa',
    });
    expect(cooldown.status).toBe(429);
    expect(cooldown.body.error.code).toBe('SIGNUP_OTP_RESEND_COOLDOWN');

    await prisma.emailVerificationCode.updateMany({
      where: { userId: signup.body.userId },
      data: {
        requestedAt: new Date('2026-07-31T00:00:00.000Z'),
      },
    });

    const resend = await agent.post('/api/auth/signup/resend').send({
      email: 'noura.signup@hospital.sa',
    });
    expect(resend.status).toBe(200);
    expect(resend.body.resent).toBe(true);
    expect(resend.body.devCode).toMatch(/^\d{6}$/);
    expect(resend.body.devCode).not.toBe(signup.body.devCode);

    const oldCode = await agent.post('/api/auth/signup/verify').send({
      email: 'noura.signup@hospital.sa',
      code: signup.body.devCode,
    });
    expect(oldCode.status).toBe(400);
    expect(oldCode.body.error.code).toBe('INVALID_SIGNUP_OTP');

    const newCode = await agent.post('/api/auth/signup/verify').send({
      email: 'noura.signup@hospital.sa',
      code: resend.body.devCode,
    });
    expect(newCode.status).toBe(200);

    const rateLimitAgent = makeAgent(app);
    const requestPayload = signupPayload({
      email: 'ratelimit.signup@hospital.sa',
      employeeNumber: 'EMP-954',
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await rateLimitAgent.post('/api/auth/signup/request').send(requestPayload);
      expect(response.status).toBe(attempt === 0 ? 201 : 200);
    }

    const rateLimited = await rateLimitAgent.post('/api/auth/signup/request').send(requestPayload);
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body.error.code).toBe('RATE_LIMITED');
  }, 20_000);

  it('authorization: employee is blocked from admin endpoints and admin cannot modify super admin', async () => {
    const employeeAgent = makeAgent(app);
    await login(employeeAgent, 'ali@hospital.sa');
    const employeeCreateDepartment = await employeeAgent.post('/api/departments').send({
      name: 'Blocked Department',
      description: 'Should fail',
    });
    expect(employeeCreateDepartment.status).toBe(403);

    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');
    const createDepartment = await adminAgent.post('/api/departments').send({
      name: 'Admin Department',
      description: 'Created by admin',
    });
    expect(createDepartment.status).toBe(201);

    const superAdminPatch = await adminAgent.patch(`/api/employees/${ids.superAdmin}`).send({
      role: 'employee',
    });
    expect(superAdminPatch.status).toBe(403);
    expect(superAdminPatch.body.error.code).toBe('FORBIDDEN');
  });

  it('departments and employees: validation, creation, duplicate detection, update, and deactivate work', async () => {
    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');

    const invalidEmployee = await adminAgent.post('/api/employees').send({
      employeeNumber: '',
    });
    expect(invalidEmployee.status).toBe(400);
    expect(invalidEmployee.body.error.code).toBe('VALIDATION_ERROR');

    const created = await adminAgent.post('/api/employees').send({
      name: 'Noura',
      employeeNumber: 'EMP-999',
      code: 'NOU',
      email: 'noura.employee@hospital.sa',
      position: 'Technologist',
      phone: '0501888999',
      role: 'employee',
      departmentId: ids.department,
    });
    expect(created.status).toBe(201);
    expect(created.body.employee.employeeNumber).toBe('EMP-999');
    expect(created.body.setupEmailSent).toBe(true);
    expect(created.body.defaultPassword).toBeUndefined();

    const duplicate = await adminAgent.post('/api/employees').send({
      name: 'Duplicate Noura',
      employeeNumber: 'EMP-999',
      code: 'NOR',
      email: 'duplicate.noura@hospital.sa',
      position: 'Technologist',
      phone: '0501888998',
      role: 'employee',
      departmentId: ids.department,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMPLOYEE_NUMBER_TAKEN');

    const update = await adminAgent.patch(`/api/employees/${created.body.employee.id}`).send({
      phone: '0501777777',
      active: false,
    });
    expect(update.status).toBe(200);
    expect(update.body.employee.isActive).toBe(false);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.body.employee.id } });
    expect(stored.isActive).toBe(false);
    expect(stored.phone).toBe('0501777777');
    expect(stored.emailVerifiedAt).toBeNull();

    const setupCode = await prisma.passwordResetCode.findFirst({
      where: { userId: created.body.employee.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(setupCode).toBeTruthy();
  });

  it('auth: forgot-password delivers OTPs by email, handles no-email accounts safely, and the reset flow updates credentials', async () => {
    const agent = makeAgent(app);

    const request = await agent.post('/api/auth/forgot-password/request').send({
      identifier: 'ali@hospital.sa',
    });
    expect(request.status).toBe(200);
    expect(request.body.accountFound).toBe(true);
    expect(request.body.hasEmail).toBe(true);
    expect(request.body.devCode).toMatch(/^\d{6}$/);

    const verify = await agent.post('/api/auth/forgot-password/verify').send({
      identifier: 'ali@hospital.sa',
      code: request.body.devCode,
    });
    expect(verify.status).toBe(200);

    const reset = await agent.post('/api/auth/forgot-password/reset').send({
      identifier: 'ali@hospital.sa',
      code: request.body.devCode,
      password: 'new-pass-456',
    });
    expect(reset.status).toBe(200);

    const loginWithNewPassword = await login(agent, 'ali@hospital.sa', 'new-pass-456');
    expect(loginWithNewPassword.status).toBe(200);

    await prisma.user.update({
      where: { id: ids.employeeOmar },
      data: {
        email: null,
        emailVerifiedAt: null,
      },
    });

    const noEmail = await agent.post('/api/auth/forgot-password/request').send({
      identifier: 'EMP-903',
    });
    expect(noEmail.status).toBe(200);
    expect(noEmail.body.accountFound).toBe(true);
    expect(noEmail.body.hasEmail).toBe(false);
    expect(noEmail.body.devCode).toBeUndefined();
  });

  it('employees: admin reset-password sends an email-based recovery code instead of assigning a default password', async () => {
    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');

    const before = await prisma.user.findUniqueOrThrow({
      where: { id: ids.employeeAli },
      select: { passwordHash: true },
    });

    const response = await adminAgent.post(`/api/employees/${ids.employeeAli}/reset-password`);
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.delivery).toBe('email');
    expect(response.body.defaultPassword).toBeUndefined();

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: ids.employeeAli },
      select: { passwordHash: true },
    });
    expect(after.passwordHash).toBe(before.passwordHash);

    const latestCode = await prisma.passwordResetCode.findFirst({
      where: { userId: ids.employeeAli },
      orderBy: { requestedAt: 'desc' },
    });
    expect(latestCode).toBeTruthy();
  });

  it('bootstrap redacts schedule drafts for employees', async () => {
    const employeeAgent = makeAgent(app);
    await login(employeeAgent, 'ali@hospital.sa');

    const response = await employeeAgent.get('/api/bootstrap');
    expect(response.status).toBe(200);
    expect(response.body.schedule.draftsByMonth).toEqual({});
    expect(response.body.schedule.matricesByMonth['2026-09']).toBeTruthy();
    expect(response.body.overtime.rowsByMonth['2026-09']).toEqual(response.body.overtime.publishedRowsByMonth['2026-09']);
  });

  it('schedule: retrieval works, unauthorized mutation is blocked, invalid duplicates are rejected, and valid draft updates persist', async () => {
    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');

    const readResponse = await adminAgent.get('/api/schedule');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.schedule.updatedAtByMonth['2026-09']).toBeTruthy();

    const employeeAgent = makeAgent(app);
    await login(employeeAgent, 'ali@hospital.sa');
    const unauthorized = await employeeAgent.put('/api/schedule').send(readResponse.body.schedule);
    expect(unauthorized.status).toBe(403);

    const duplicatePayload = structuredClone(readResponse.body.schedule);
    const duplicateDraft = structuredClone(duplicatePayload.draftsByMonth['2026-09']);
    duplicateDraft.facilities[0].units[0].rows[0].cellsByDay['15'] = [
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'draft' },
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'draft' },
    ];
    duplicatePayload.draftsByMonth['2026-09'] = duplicateDraft;
    const duplicateResponse = await adminAgent.put('/api/schedule').send(duplicatePayload);
    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.error.code).toBe('SCHEDULE_SYNC_FAILED');

    const validPayload = structuredClone(readResponse.body.schedule);
    const validDraft = structuredClone(validPayload.draftsByMonth['2026-09']);
    validDraft.facilities[0].units[0].rows[0].cellsByDay['15'] = [
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'draft' },
      { employeeId: 'emp-admin', employeeCode: 'ADM', status: 'draft' },
    ];
    validPayload.draftsByMonth['2026-09'] = validDraft;
    const updateResponse = await adminAgent.put('/api/schedule').send(validPayload);
    expect(updateResponse.status).toBe(200);

    const storedMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const draft = JSON.parse(storedMonth.draftJson ?? '{}');
    expect(draft.facilities[0].units[0].rows[0].cellsByDay['15']).toHaveLength(2);
  });

  it('overtime: retrieval works, unauthorized mutation is blocked, negative hours are rejected, and valid updates persist', async () => {
    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');

    const readResponse = await adminAgent.get('/api/overtime');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.overtime.updatedAtByMonth['2026-09']).toBeTruthy();

    const employeeAgent = makeAgent(app);
    await login(employeeAgent, 'ali@hospital.sa');
    const unauthorized = await employeeAgent.put('/api/overtime').send(readResponse.body.overtime);
    expect(unauthorized.status).toBe(403);

    const negativePayload = structuredClone(readResponse.body.overtime);
    negativePayload.rowsByMonth['2026-09'][0].hours = -2;
    const negativeResponse = await adminAgent.put('/api/overtime').send(negativePayload);
    expect(negativeResponse.status).toBe(400);
    expect(negativeResponse.body.error.code).toBe('OVERTIME_SYNC_FAILED');

    const validPayload = structuredClone(readResponse.body.overtime);
    validPayload.rowsByMonth['2026-09'][0].hours = 6;
    const validResponse = await adminAgent.put('/api/overtime').send(validPayload);
    expect(validResponse.status).toBe(200);

    const storedMonth = await prisma.overtimeMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const rows = JSON.parse(storedMonth.rowsJson);
    expect(rows[0].hours).toBe(6);
  });

  it('shift requests: create, accept, approve, notifications, and schedule mutation work end to end', async () => {
    const requesterAgent = makeAgent(app);
    const recipientAgent = makeAgent(app);
    const adminAgent = makeAgent(app);
    await login(requesterAgent, 'ali@hospital.sa');
    await login(recipientAgent, 'omar@hospital.sa');
    await login(adminAgent, 'admin@hospital.sa');

    const createResponse = await requesterAgent.post('/api/shift-requests').send({
      type: 'replace',
      recipientAccountId: ids.employeeOmar,
      requesterAssignment: buildRequesterAssignment(),
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.request.status).toBe('pending_recipient');

    const recipientNotifications = await recipientAgent.get('/api/notifications');
    expect(recipientNotifications.status).toBe(200);
    expect(recipientNotifications.body.notifications.some((item: { type: string }) => item.type === 'shift_request_received')).toBe(true);

    const acceptResponse = await recipientAgent.post(`/api/shift-requests/${createResponse.body.request.id}/accept`);
    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.request.status).toBe('pending_admin');

    const approveResponse = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.request.status).toBe('approved');

    const scheduleMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const published = JSON.parse(scheduleMonth.publishedJson ?? '{}');
    expect(published.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual([
      { employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published' },
    ]);
  });

  it('shift requests: invalid transition, unauthorized processing, and admin rejection validation are enforced', async () => {
    const requesterAgent = makeAgent(app);
    const adminAgent = makeAgent(app);
    await login(requesterAgent, 'ali@hospital.sa');
    await login(adminAgent, 'admin@hospital.sa');

    const createResponse = await requesterAgent.post('/api/shift-requests').send({
      type: 'replace',
      recipientAccountId: ids.employeeOmar,
      requesterAssignment: buildRequesterAssignment(),
    });
    expect(createResponse.status).toBe(201);

    const earlyApprove = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(earlyApprove.status).toBe(409);

    const unauthorizedApprove = await requesterAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(unauthorizedApprove.status).toBe(403);

    const invalidReject = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/reject-admin`).send({
      reason: 'other',
      note: '',
    });
    expect(invalidReject.status).toBe(400);

    const validReject = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/reject-admin`).send({
      reason: 'operational_need',
    });
    expect(validReject.status).toBe(200);
    expect(validReject.body.request.status).toBe('admin_rejected');
  });

  it('notifications: users only see their own notifications and can mark a notification as read', async () => {
    await prisma.notification.create({
      data: {
        id: 'notification-ali-private',
        type: 'general',
        title: 'Ali note',
        message: 'Only Ali should see this.',
        audienceKind: 'account',
        audienceAccountId: ids.employeeAli,
        departmentId: ids.department,
      },
    });

    const aliAgent = makeAgent(app);
    const omarAgent = makeAgent(app);
    await login(aliAgent, 'ali@hospital.sa');
    await login(omarAgent, 'omar@hospital.sa');

    const aliNotifications = await aliAgent.get('/api/notifications');
    expect(aliNotifications.status).toBe(200);
    expect(aliNotifications.body.notifications.some((item: { id: string }) => item.id === 'notification-ali-private')).toBe(true);
    expect(aliNotifications.body.notifications.some((item: { id: string }) => item.id === 'notification-omar-private')).toBe(false);

    const omarNotifications = await omarAgent.get('/api/notifications');
    expect(omarNotifications.status).toBe(200);
    expect(omarNotifications.body.notifications.some((item: { id: string }) => item.id === 'notification-omar-private')).toBe(true);
    expect(omarNotifications.body.notifications.some((item: { id: string }) => item.id === 'notification-ali-private')).toBe(false);

    const readResponse = await aliAgent.post('/api/notifications/notification-ali-private/read');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.notification.isRead).toBe(true);
  });

  it('calendar feed: access restrictions, rotation, and invalid tokens are enforced', async () => {
    const viewOnlyAgent = makeAgent(app);
    await login(viewOnlyAgent, 'viewer@hospital.sa');
    const forbidden = await viewOnlyAgent.get('/api/calendar-sync');
    expect(forbidden.status).toBe(403);

    const aliAgent = makeAgent(app);
    await login(aliAgent, 'ali@hospital.sa');
    const tokenResponse = await aliAgent.get('/api/calendar-sync');
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.token).toMatch(/^[a-f0-9]{64}$/);

    const oldToken = tokenResponse.body.token as string;
    const rotateResponse = await aliAgent.post('/api/calendar-sync/rotate');
    expect(rotateResponse.status).toBe(200);
    expect(rotateResponse.body.token).not.toBe(oldToken);

    const invalidFeed = await makeAgent(app).get(`/api/calendar-sync/feed/${oldToken}.ics`);
    expect(invalidFeed.status).toBe(404);

    const newFeed = await makeAgent(app).get(`/api/calendar-sync/feed/${rotateResponse.body.token}.ics`);
    expect(newFeed.status).toBe(200);
    expect(newFeed.text).toContain('BEGIN:VCALENDAR');
  });
});
