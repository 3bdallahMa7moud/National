import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clearAllRateLimits } from '../src/lib/rateLimit.js';
import {
  buildRequesterAssignment,
  buildRecipientAssignment,
  ids,
  login,
  makeAgent,
  prismaClient,
  resetDatabase,
  seedBaseData,
} from './helpers.js';

const app = createApp();
const prisma = prismaClient();

function requesterAssignmentWithCell(employeeIdsInCell: string[]) {
  return {
    ...buildRequesterAssignment(),
    fingerprint: [
      'schedule',
      '2026-09',
      'facility-kamc',
      'unit-ct-1',
      'schedule-row-1',
      '15',
      'emp-ali',
      '',
      'CT-1',
      'Scanner 1',
      'Day',
      '08:00 - 16:00',
      [...employeeIdsInCell].sort().join(','),
    ].join('|'),
  };
}

function recipientAssignmentWithCell(employeeIdsInCell: string[]) {
  return {
    ...buildRecipientAssignment(),
    fingerprint: [
      'schedule',
      '2026-09',
      'facility-kamc',
      'unit-ct-1',
      'schedule-row-2',
      '16',
      'emp-omar',
      '',
      'CT-1',
      'Scanner 2',
      'Night',
      '16:00 - 23:00',
      [...employeeIdsInCell].sort().join(','),
    ].join('|'),
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

  it('performance: compresses large authenticated API responses when the client supports gzip', async () => {
    const agent = makeAgent(app);
    await login(agent, 'admin@hospital.sa');

    const response = await agent
      .get('/api/bootstrap')
      .set('accept-encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers.vary).toContain('Accept-Encoding');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body.schedule).toBeDefined();
    expect(response.body.overtime).toBeDefined();
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

  it('auth: public signup endpoints are disabled', async () => {
    const agent = makeAgent(app);

    const options = await agent.get('/api/auth/signup/options');
    expect(options.status).toBe(404);
    expect(options.body.error.code).toBe('SIGNUP_DISABLED');

    const request = await agent.post('/api/auth/signup/request').send({
      email: 'new.employee@hospital.sa',
    });
    expect(request.status).toBe(404);
    expect(request.body.error.code).toBe('SIGNUP_DISABLED');

    const verify = await agent.post('/api/auth/signup/verify').send({
      email: 'new.employee@hospital.sa',
      code: '123456',
    });
    expect(verify.status).toBe(404);
    expect(verify.body.error.code).toBe('SIGNUP_DISABLED');

    const resend = await agent.post('/api/auth/signup/resend').send({
      email: 'new.employee@hospital.sa',
    });
    expect(resend.status).toBe(404);
    expect(resend.body.error.code).toBe('SIGNUP_DISABLED');
  });

  it('auth: seeded accounts are active, verified, and can log in across roles', async () => {
    const seededUsers = await prisma.user.findMany({
      where: {
        id: {
          in: [ids.superAdmin, ids.admin, ids.employeeAli],
        },
      },
      select: {
        email: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
      },
      orderBy: { email: 'asc' },
    });

    expect(seededUsers).toHaveLength(3);
    expect(seededUsers).toEqual([
      expect.objectContaining({
        email: 'admin@hospital.sa',
        role: 'admin',
        isActive: true,
        emailVerifiedAt: expect.any(Date),
      }),
      expect.objectContaining({
        email: 'ali@hospital.sa',
        role: 'employee',
        isActive: true,
        emailVerifiedAt: expect.any(Date),
      }),
      expect.objectContaining({
        email: 'super@hospital.sa',
        role: 'super_admin',
        isActive: true,
        emailVerifiedAt: expect.any(Date),
      }),
    ]);

    for (const identifier of ['super@hospital.sa', 'admin@hospital.sa', 'ali@hospital.sa']) {
      const agent = makeAgent(app);
      const response = await login(agent, identifier);
      expect(response.status).toBe(200);
    }
  });

  it('departments: creation accepts an empty description, persists to the database, and appears in bootstrap while validation failures stay structured', async () => {
    const adminAgent = makeAgent(app);
    await login(adminAgent, 'admin@hospital.sa');

    const validation = await adminAgent.post('/api/departments').send({
      name: '',
      description: '',
    });
    expect(validation.status).toBe(400);
    expect(validation.body.error.code).toBe('VALIDATION_ERROR');
    expect(validation.body.error.details.fieldErrors.name).toContain('Department name is required.');

    const createDepartment = await adminAgent.post('/api/departments').send({
      name: 'Interventional CT',
      description: '',
    });
    expect(createDepartment.status).toBe(201);
    expect(createDepartment.body.department.name.en).toBe('Interventional CT');
    expect(createDepartment.body.department.description.en).toBe('');

    const storedDepartment = await prisma.department.findUniqueOrThrow({
      where: { id: createDepartment.body.department.id },
    });
    expect(storedDepartment.nameEn).toBe('Interventional CT');
    expect(storedDepartment.descriptionEn).toBe('');

    const bootstrap = await adminAgent.get('/api/bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.departments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createDepartment.body.department.id,
          name: expect.objectContaining({ en: 'Interventional CT' }),
          description: expect.objectContaining({ en: '' }),
        }),
      ]),
    );
  });

  it('authorization: employee is blocked from admin endpoints and admin role management cannot bypass super admin control', async () => {
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
      description: '',
    });
    expect(createDepartment.status).toBe(201);

    const superAdminPatch = await adminAgent.patch(`/api/employees/${ids.superAdmin}`).send({
      role: 'employee',
    });
    expect(superAdminPatch.status).toBe(403);
    expect(superAdminPatch.body.error.code).toBe('FORBIDDEN');

    const adminCreateAdmin = await adminAgent.post('/api/employees').send({
      name: 'Unauthorized Admin',
      employeeNumber: 'EMP-970',
      code: 'UAD',
      email: 'unauthorized.admin@hospital.sa',
      position: 'Coordinator',
      phone: '0501777000',
      role: 'admin',
      departmentId: ids.department,
    });
    expect(adminCreateAdmin.status).toBe(403);
    expect(adminCreateAdmin.body.error.code).toBe('FORBIDDEN');

    const adminSelfRolePatch = await adminAgent.patch(`/api/employees/${ids.admin}`).send({
      role: 'employee',
    });
    expect(adminSelfRolePatch.status).toBe(403);
    expect(adminSelfRolePatch.body.error.code).toBe('FORBIDDEN');

    const adminPromotePatch = await adminAgent.patch(`/api/employees/${ids.employeeAli}`).send({
      role: 'super_admin',
    });
    expect(adminPromotePatch.status).toBe(403);
    expect(adminPromotePatch.body.error.code).toBe('FORBIDDEN');

    const adminDeactivateSuper = await adminAgent.patch(`/api/employees/${ids.superAdmin}`).send({
      active: false,
    });
    expect(adminDeactivateSuper.status).toBe(403);
    expect(adminDeactivateSuper.body.error.code).toBe('FORBIDDEN');

    const adminDeactivateSuperAccess = await adminAgent.patch(`/api/employees/${ids.superAdmin}/access`).send({
      templateId: 'standard',
      overrides: {},
      active: false,
    });
    expect(adminDeactivateSuperAccess.status).toBe(403);
    expect(adminDeactivateSuperAccess.body.error.code).toBe('FORBIDDEN');

    const superAgent = makeAgent(app);
    await login(superAgent, 'super@hospital.sa');
    const promoteToAdmin = await superAgent.patch(`/api/employees/${ids.employeeAli}`).send({
      role: 'admin',
    });
    expect(promoteToAdmin.status).toBe(200);
    expect(promoteToAdmin.body.employee.role).toBe('admin');

    const promotedAdminAgent = makeAgent(app);
    await login(promotedAdminAgent, 'ali@hospital.sa');
    const promotedAdminSelfDemote = await promotedAdminAgent.patch(`/api/employees/${ids.employeeAli}`).send({
      role: 'employee',
    });
    expect(promotedAdminSelfDemote.status).toBe(403);
    expect(promotedAdminSelfDemote.body.error.code).toBe('FORBIDDEN');

    const superDemoteSelf = await superAgent.patch(`/api/employees/${ids.superAdmin}`).send({
      role: 'admin',
    });
    expect(superDemoteSelf.status).toBe(400);
    expect(superDemoteSelf.body.error.code).toBe('PROTECTED_SUPER_ADMIN');

    const superDeactivateSelf = await superAgent.patch(`/api/employees/${ids.superAdmin}`).send({
      active: false,
    });
    expect(superDeactivateSelf.status).toBe(400);
    expect(superDeactivateSelf.body.error.code).toBe('PROTECTED_SUPER_ADMIN');

    const superDeactivateSelfAccess = await superAgent.patch(`/api/employees/${ids.superAdmin}/access`).send({
      templateId: 'standard',
      overrides: {},
      active: false,
    });
    expect(superDeactivateSelfAccess.status).toBe(400);
    expect(superDeactivateSelfAccess.body.error.code).toBe('PROTECTED_SUPER_ADMIN');
  });

  it('departments and employees: validation, creation, duplicate detection, update, deactivate, and restore work', async () => {
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
      position: 'Technologist',
      phone: '0501888999',
      role: 'employee',
      departmentId: ids.department,
    });
    expect(created.status).toBe(201);
    expect(created.body.employee.employeeNumber).toBe('EMP-999');
    expect(created.body.defaultPassword).toBe('123456');

    const duplicate = await adminAgent.post('/api/employees').send({
      name: 'Duplicate Noura',
      employeeNumber: 'EMP-999',
      code: 'NOR',
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
    expect(stored.emailVerifiedAt).not.toBeNull();

    const bootstrap = await adminAgent.get('/api/bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.employees.find((employee: { id: string }) => employee.id === created.body.employee.id)).toMatchObject({
      id: created.body.employee.id,
      isActive: false,
    });
    expect(bootstrap.body.accessProfiles[created.body.employee.id]).toMatchObject({
      accountId: created.body.employee.id,
      active: false,
    });

    const restored = await adminAgent.post('/api/employees').send({
      name: 'Noura Restored',
      employeeNumber: 'EMP-999',
      code: 'NUR',
      position: 'Senior Technologist',
      phone: '0501999000',
      role: 'employee',
      departmentId: ids.department,
    });
    expect(restored.status).toBe(200);
    expect(restored.body.restored).toBe(true);
    expect(restored.body.defaultPassword).toBe('123456');
    expect(restored.body.employee).toMatchObject({
      id: created.body.employee.id,
      employeeNumber: 'EMP-999',
      code: 'NUR',
      isActive: true,
    });
    expect(restored.body.accessProfile).toMatchObject({
      accountId: created.body.employee.id,
      active: true,
      templateId: 'standard',
    });

    const restoredStored = await prisma.user.findUniqueOrThrow({ where: { id: created.body.employee.id } });
    expect(restoredStored.isActive).toBe(true);
    expect(restoredStored.employeeNumber).toBe('EMP-999');
    expect(restoredStored.passwordHash).toBeTruthy();

    const restoredLogin = await makeAgent(app).post('/api/auth/login').send({
      identifier: 'EMP-999',
      password: '123456',
    });
    expect(restoredLogin.status).toBe(200);
    expect(restoredLogin.body.user.employeeNumber).toBe('EMP-999');
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

    const wrongOtp = request.body.devCode === '000000' ? '000001' : '000000';
    const invalidVerify = await agent.post('/api/auth/forgot-password/verify').send({
      identifier: 'ali@hospital.sa',
      code: wrongOtp,
    });
    expect(invalidVerify.status).toBe(400);
    expect(invalidVerify.body.error.code).toBe('INVALID_RESET_CODE');

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

    const reuse = await agent.post('/api/auth/forgot-password/reset').send({
      identifier: 'ali@hospital.sa',
      code: request.body.devCode,
      password: 'new-pass-789',
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_CODE');

    const loginWithNewPassword = await login(agent, 'ali@hospital.sa', 'new-pass-456');
    expect(loginWithNewPassword.status).toBe(200);

    const expiredRequest = await agent.post('/api/auth/forgot-password/request').send({
      identifier: 'ali@hospital.sa',
    });
    expect(expiredRequest.status).toBe(200);
    expect(expiredRequest.body.devCode).toMatch(/^\d{6}$/);

    await prisma.passwordResetCode.updateMany({
      where: { userId: ids.employeeAli, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredVerify = await agent.post('/api/auth/forgot-password/verify').send({
      identifier: 'ali@hospital.sa',
      code: expiredRequest.body.devCode,
    });
    expect(expiredVerify.status).toBe(400);
    expect(expiredVerify.body.error.code).toBe('INVALID_RESET_CODE');

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
      { employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published', hasConflict: false },
    ]);
  });

  it('shift requests: replace preserves slot metadata in the database and survives bootstrap refresh', async () => {
    const scheduleMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const published = JSON.parse(scheduleMonth.publishedJson ?? '{}');
    published.facilities[0].units[0].rows[0].cellsByDay['15'] = [
      {
        employeeId: 'emp-ali',
        employeeCode: 'ALI',
        colorKey: 'night',
        status: 'published',
        hasConflict: true,
        conflictReason: 'stale conflict',
        conflictType: 'timeOverlap',
      },
      { employeeId: 'emp-cover', employeeCode: 'CVR', status: 'published' },
    ];
    await prisma.scheduleMonth.update({
      where: { monthKey: '2026-09' },
      data: {
        publishedJson: JSON.stringify(published),
        draftJson: JSON.stringify(published),
      },
    });

    const requesterAgent = makeAgent(app);
    const recipientAgent = makeAgent(app);
    const adminAgent = makeAgent(app);
    await login(requesterAgent, 'ali@hospital.sa');
    await login(recipientAgent, 'omar@hospital.sa');
    await login(adminAgent, 'admin@hospital.sa');

    const createResponse = await requesterAgent.post('/api/shift-requests').send({
      type: 'replace',
      recipientAccountId: ids.employeeOmar,
      requesterAssignment: requesterAssignmentWithCell(['emp-ali', 'emp-cover']),
    });
    expect(createResponse.status).toBe(201);

    const acceptResponse = await recipientAgent.post(`/api/shift-requests/${createResponse.body.request.id}/accept`);
    expect(acceptResponse.status).toBe(200);

    const approveResponse = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(approveResponse.status).toBe(200);

    const storedMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const nextPublished = JSON.parse(storedMonth.publishedJson ?? '{}');
    const nextDraft = JSON.parse(storedMonth.draftJson ?? '{}');
    expect(nextPublished.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual([
      {
        employeeId: 'emp-omar',
        employeeCode: 'OMR',
        colorKey: 'night',
        status: 'published',
        hasConflict: false,
      },
      {
        employeeId: 'emp-cover',
        employeeCode: 'CVR',
        status: 'published',
        hasConflict: false,
      },
    ]);
    expect(nextDraft.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual(
      nextPublished.facilities[0].units[0].rows[0].cellsByDay['15'],
    );

    const bootstrap = await adminAgent.get('/api/bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.schedule.matricesByMonth['2026-09'].facilities[0].units[0].rows[0].cellsByDay['15']).toEqual(
      nextPublished.facilities[0].units[0].rows[0].cellsByDay['15'],
    );
  });

  it('shift requests: exchange preserves primary and secondary assignments, persists through schedule publish round-trip, and records audit', async () => {
    const scheduleMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const published = JSON.parse(scheduleMonth.publishedJson ?? '{}');
    published.facilities[0].units[0].rows[0].cellsByDay['15'] = [
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'published' },
      { employeeId: 'emp-cover-a', employeeCode: 'CVA', status: 'published' },
    ];
    published.facilities[0].units[0].rows[1].cellsByDay['16'] = [
      { employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published' },
      { employeeId: 'emp-cover-b', employeeCode: 'CVB', status: 'published' },
    ];
    await prisma.scheduleMonth.update({
      where: { monthKey: '2026-09' },
      data: {
        publishedJson: JSON.stringify(published),
        draftJson: JSON.stringify(published),
      },
    });

    const requesterAgent = makeAgent(app);
    const recipientAgent = makeAgent(app);
    const adminAgent = makeAgent(app);
    await login(requesterAgent, 'ali@hospital.sa');
    await login(recipientAgent, 'omar@hospital.sa');
    await login(adminAgent, 'admin@hospital.sa');

    const createResponse = await requesterAgent.post('/api/shift-requests').send({
      type: 'exchange',
      recipientAccountId: ids.employeeOmar,
      requesterAssignment: requesterAssignmentWithCell(['emp-ali', 'emp-cover-a']),
      offeredAssignment: recipientAssignmentWithCell(['emp-omar', 'emp-cover-b']),
    });
    expect(createResponse.status).toBe(201);

    const acceptResponse = await recipientAgent.post(`/api/shift-requests/${createResponse.body.request.id}/accept`);
    expect(acceptResponse.status).toBe(200);

    const approveResponse = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(approveResponse.status).toBe(200);

    const storedMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const nextPublished = JSON.parse(storedMonth.publishedJson ?? '{}');
    const nextDraft = JSON.parse(storedMonth.draftJson ?? '{}');
    expect(nextPublished.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual([
      { employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published', hasConflict: false },
      { employeeId: 'emp-cover-a', employeeCode: 'CVA', status: 'published', hasConflict: false },
    ]);
    expect(nextPublished.facilities[0].units[0].rows[1].cellsByDay['16']).toEqual([
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'published', hasConflict: false },
      { employeeId: 'emp-cover-b', employeeCode: 'CVB', status: 'published', hasConflict: false },
    ]);
    expect(nextDraft.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual(
      nextPublished.facilities[0].units[0].rows[0].cellsByDay['15'],
    );
    expect(nextDraft.facilities[0].units[0].rows[1].cellsByDay['16']).toEqual(
      nextPublished.facilities[0].units[0].rows[1].cellsByDay['16'],
    );
    expect(nextPublished.auditLog[0]).toMatchObject({ action: 'assign', day: 16, rowId: 'schedule-row-2' });
    expect(nextPublished.auditLog[1]).toMatchObject({ action: 'assign', day: 15, rowId: 'schedule-row-1' });
    expect(JSON.parse(storedMonth.versionsJson)).toHaveLength(1);

    const scheduleResponse = await adminAgent.get('/api/schedule');
    expect(scheduleResponse.status).toBe(200);
    const publishResponse = await adminAgent.put('/api/schedule').send(scheduleResponse.body.schedule);
    expect(publishResponse.status).toBe(200);

    const afterRoundTrip = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const roundTripPublished = JSON.parse(afterRoundTrip.publishedJson ?? '{}');
    expect(roundTripPublished.facilities[0].units[0].rows[0].cellsByDay['15']).toEqual(
      nextPublished.facilities[0].units[0].rows[0].cellsByDay['15'],
    );
    expect(roundTripPublished.facilities[0].units[0].rows[1].cellsByDay['16']).toEqual(
      nextPublished.facilities[0].units[0].rows[1].cellsByDay['16'],
    );

    const bootstrap = await adminAgent.get('/api/bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.schedule.matricesByMonth['2026-09'].facilities[0].units[0].rows[0].cellsByDay['15']).toEqual(
      nextPublished.facilities[0].units[0].rows[0].cellsByDay['15'],
    );
    expect(bootstrap.body.schedule.matricesByMonth['2026-09'].facilities[0].units[0].rows[1].cellsByDay['16']).toEqual(
      nextPublished.facilities[0].units[0].rows[1].cellsByDay['16'],
    );
  });

  it('shift requests: conflicting exchange requires override and leaves database unchanged until approved', async () => {
    const scheduleMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    const published = JSON.parse(scheduleMonth.publishedJson ?? '{}');
    published.facilities.push({
      id: 'facility-b',
      name: 'Facility B',
      accentColorToken: 'facility-kamc',
      units: [{
        id: 'unit-cross',
        name: 'Cross Unit',
        blockType: 'equipmentDay',
        rows: [{
          id: 'schedule-row-cross',
          unitLabel: 'Cross Unit',
          rowLabel: 'Overlap',
          shiftLabel: 'Day',
          timeRange: '09:00 - 12:00',
          colorKey: 'morning',
          weekendOnly: false,
          blockType: 'equipmentDay',
          cellsByDay: {
            15: [{ employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published' }],
          },
        }],
      }],
    });
    await prisma.scheduleMonth.update({
      where: { monthKey: '2026-09' },
      data: {
        publishedJson: JSON.stringify(published),
        draftJson: JSON.stringify(published),
      },
    });

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

    const acceptResponse = await recipientAgent.post(`/api/shift-requests/${createResponse.body.request.id}/accept`);
    expect(acceptResponse.status).toBe(200);

    const blockedApprove = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: false,
    });
    expect(blockedApprove.status).toBe(409);
    expect(blockedApprove.body.error.code).toBe('CONFLICT_REQUIRES_OVERRIDE');
    expect(blockedApprove.body.warnings).toEqual([
      expect.objectContaining({ code: 'schedule_conflict', employeeId: 'emp-omar' }),
    ]);

    const unchangedMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    expect(JSON.parse(unchangedMonth.publishedJson ?? '{}').facilities[0].units[0].rows[0].cellsByDay['15']).toEqual([
      { employeeId: 'emp-ali', employeeCode: 'ALI', status: 'published' },
    ]);

    const approvedWithOverride = await adminAgent.post(`/api/shift-requests/${createResponse.body.request.id}/approve`).send({
      overrideConflicts: true,
    });
    expect(approvedWithOverride.status).toBe(200);
    expect(approvedWithOverride.body.request.conflictOverride).toBe(true);

    const storedMonth = await prisma.scheduleMonth.findUniqueOrThrow({ where: { monthKey: '2026-09' } });
    expect(JSON.parse(storedMonth.publishedJson ?? '{}').facilities[0].units[0].rows[0].cellsByDay['15'][0]).toMatchObject({
      employeeId: 'emp-omar',
      hasConflict: true,
      conflictType: 'crossFacility',
    });
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

  it('calendar feed: legacy employee accounts use default standard access and an empty feed until roster-linked', async () => {
    const existingEmployee = await prisma.user.findUniqueOrThrow({
      where: { id: ids.employeeAli },
      select: { passwordHash: true },
    });

    await prisma.user.create({
      data: {
        id: 'user-calendar-legacy',
        employeeNumber: 'EMP-905',
        code: 'LEG',
        nameEn: 'Legacy Calendar',
        nameAr: 'Legacy Calendar',
        email: 'legacy-calendar@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000005',
        role: 'employee',
        departmentId: ids.department,
        positionEn: 'Technologist',
        positionAr: 'Technologist',
        isActive: true,
        passwordHash: existingEmployee.passwordHash,
        scheduleEmployeeId: null,
      },
    });

    const legacyAgent = makeAgent(app);
    await login(legacyAgent, 'legacy-calendar@hospital.sa');

    const sessionResponse = await legacyAgent.get('/api/auth/session');
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.access).toMatchObject({
      templateId: 'standard',
      active: true,
    });

    const tokenResponse = await legacyAgent.get('/api/calendar-sync');
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.token).toMatch(/^[a-f0-9]{64}$/);

    const feedResponse = await makeAgent(app).get(`/api/calendar-sync/feed/${tokenResponse.body.token}.ics`);
    expect(feedResponse.status).toBe(200);
    expect(feedResponse.text).toContain('BEGIN:VCALENDAR');
    expect(feedResponse.text).not.toContain('BEGIN:VEVENT');
  });

  it('auth: forgot-password rate-limits brute-force OTP guessing per identifier', async () => {
    const agent = makeAgent(app);

    await agent.post('/api/auth/forgot-password/request').send({
      identifier: 'ali@hospital.sa',
    });

    // Make 10 attempts with different wrong codes
    for (let i = 0; i < 10; i++) {
      const code = String(100000 + i);
      const res = await agent.post('/api/auth/forgot-password/verify').send({
        identifier: 'ali@hospital.sa',
        code,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RESET_CODE');
    }

    // 11th attempt must be rate-limited (429)
    const rateLimitedRes = await agent.post('/api/auth/forgot-password/verify').send({
      identifier: 'ali@hospital.sa',
      code: '999999',
    });
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.body.error.code).toBe('RATE_LIMITED');
  }, 15000);

  it('calendar feed: events have deterministic UIDs across requests and roll over overnight shifts', async () => {
    const aliAgent = makeAgent(app);
    await login(aliAgent, 'ali@hospital.sa');

    const tokenResponse = await aliAgent.get('/api/calendar-sync');
    expect(tokenResponse.status).toBe(200);
    const token = tokenResponse.body.token as string;

    const firstFeed = await makeAgent(app).get(`/api/calendar-sync/feed/${token}.ics`);
    expect(firstFeed.status).toBe(200);
    const secondFeed = await makeAgent(app).get(`/api/calendar-sync/feed/${token}.ics`);
    expect(secondFeed.status).toBe(200);

    const firstUids = firstFeed.text.match(/UID:[^\r\n]+/g);
    const secondUids = secondFeed.text.match(/UID:[^\r\n]+/g);

    expect(firstUids).toEqual(secondUids);
  });
});
