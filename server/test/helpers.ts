import type { Express } from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { AccessTemplateId, PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/lib/auth.js';
import { prisma } from '../src/lib/prisma.js';

type ResponseHeaders = Record<string, string | string[] | number>;

export type TestResponse = {
  status: number;
  // Route responses vary widely across the suite, so the test harness exposes
  // a dynamic payload shape and leaves endpoint-specific assertions to tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  text: string;
  headers: ResponseHeaders;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';
  encrypted = false;

  _read() {}

  _write(
    _chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    callback();
  }

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }
}

class TestRequest implements PromiseLike<TestResponse> {
  private body: unknown;
  private headers: Record<string, string> = {};
  private responsePromise: Promise<TestResponse> | null = null;

  constructor(
    private readonly agent: TestAgent,
    private readonly method: HttpMethod,
    private readonly path: string,
  ) {}

  send(body: unknown) {
    this.body = body;
    return this.execute();
  }

  set(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }

  private execute() {
    if (!this.responsePromise) {
      this.responsePromise = this.agent.dispatch(this.method, this.path, this.body, this.headers);
    }
    return this.responsePromise;
  }
}

export class TestAgent {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly app: Express) {}

  get(path: string) {
    return new TestRequest(this, 'GET', path);
  }

  post(path: string) {
    return new TestRequest(this, 'POST', path);
  }

  put(path: string) {
    return new TestRequest(this, 'PUT', path);
  }

  patch(path: string) {
    return new TestRequest(this, 'PATCH', path);
  }

  delete(path: string) {
    return new TestRequest(this, 'DELETE', path);
  }

  async dispatch(
    method: HttpMethod,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<TestResponse> {
    const socket = new MockSocket() as unknown as Socket;
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = path;

    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );

    const bodyBuffer = body === undefined
      ? undefined
      : Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
          ? Buffer.from(body)
          : Buffer.from(JSON.stringify(body));

    if (bodyBuffer && !normalizedHeaders['content-type']) {
      normalizedHeaders['content-type'] = Buffer.isBuffer(body) || typeof body === 'string'
        ? 'text/plain; charset=utf-8'
        : 'application/json; charset=utf-8';
    }
    if (bodyBuffer) {
      normalizedHeaders['content-length'] = String(bodyBuffer.byteLength);
    }

    normalizedHeaders.origin ??= 'http://127.0.0.1:5173';

    const cookieHeader = this.serializeCookies();
    if (cookieHeader) {
      normalizedHeaders.cookie = cookieHeader;
    }

    req.headers = normalizedHeaders;

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res) as (
      chunk: unknown,
      encoding?: BufferEncoding,
      callback?: (error?: Error | null) => void,
    ) => boolean;
    const originalEnd = res.end.bind(res) as (
      chunk?: unknown,
      encoding?: BufferEncoding,
      callback?: () => void,
    ) => ServerResponse<IncomingMessage>;

    res.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
      if (chunk !== undefined) {
        chunks.push(this.toBuffer(chunk, typeof encoding === 'string' ? encoding : undefined));
      }
      if (typeof encoding === 'function') {
        return originalWrite(chunk, undefined, encoding);
      }
      return originalWrite(chunk, encoding, callback);
    }) as typeof res.write;

    res.end = ((chunk?: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) => {
      if (chunk !== undefined) {
        chunks.push(this.toBuffer(chunk, typeof encoding === 'string' ? encoding : undefined));
      }
      if (typeof encoding === 'function') {
        return originalEnd(chunk, undefined, encoding);
      }
      return originalEnd(chunk, encoding, callback);
    }) as typeof res.end;

    res.assignSocket(socket);

    return new Promise<TestResponse>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        const rawBody = Buffer.concat(chunks);
        const contentEncoding = String(res.getHeader('content-encoding') ?? '');
        const decodedBody = contentEncoding === 'gzip' ? gunzipSync(rawBody) : rawBody;
        const text = decodedBody.toString('utf8');
        const contentType = String(res.getHeader('content-type') ?? '');
        const response: TestResponse = {
          status: res.statusCode,
          body: contentType.includes('application/json') && text
            ? JSON.parse(text)
            : text,
          text,
          headers: Object.fromEntries(
            Object.entries(res.getHeaders()).map(([key, value]) => [key, value as string | string[] | number]),
          ),
        };
        this.captureCookies(res.getHeader('set-cookie'));
        resolve(response);
      };

      res.on('prefinish', finish);
      res.on('finish', finish);
      res.on('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      try {
        const app = this.app as unknown as {
          handle: (
            request: IncomingMessage,
            response: ServerResponse<IncomingMessage>,
            next: (error?: unknown) => void,
          ) => void;
        };

        app.handle(req, res, (error: unknown) => {
          if (error && !settled) {
            settled = true;
            reject(error);
          }
        });
        if (bodyBuffer) {
          req.push(bodyBuffer);
        }
        req.push(null);
      } catch (error) {
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }

  private serializeCookies() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private captureCookies(rawHeader: number | string | string[] | undefined) {
    const cookieHeaders = Array.isArray(rawHeader)
      ? rawHeader
      : typeof rawHeader === 'string'
        ? [rawHeader]
        : [];

    for (const header of cookieHeaders) {
      const [pair, ...attributes] = header.split(';');
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      const isExpired = attributes.some((attribute) => {
        const normalized = attribute.trim().toLowerCase();
        return normalized === 'max-age=0' || normalized.startsWith('expires=thu, 01 jan 1970');
      });
      if (!value || isExpired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  private toBuffer(chunk: unknown, encoding?: BufferEncoding) {
    if (Buffer.isBuffer(chunk)) {
      return chunk;
    }
    if (chunk instanceof Uint8Array) {
      return Buffer.from(chunk);
    }
    return Buffer.from(String(chunk), encoding);
  }
}

export const ids = {
  department: 'dept-test-1',
  superAdmin: 'user-super',
  admin: 'user-admin',
  employeeAli: 'user-ali',
  employeeOmar: 'user-omar',
  employeeView: 'user-view',
} as const;

const defaultPassword = '123456';
const monthKey = '2026-09';

export function scheduleAssignmentFingerprint() {
  return 'schedule|2026-09|facility-kamc|unit-ct-1|schedule-row-1|15|emp-ali||CT-1|Scanner 1|Day|08:00 - 16:00|emp-ali';
}

export function recipientScheduleAssignmentFingerprint() {
  return 'schedule|2026-09|facility-kamc|unit-ct-1|schedule-row-2|16|emp-omar||CT-1|Scanner 2|Night|16:00 - 23:00|emp-omar';
}

export function buildRequesterAssignment() {
  return {
    source: 'schedule' as const,
    departmentId: ids.department,
    monthKey,
    year: 2026,
    month: 8,
    day: 15,
    rowId: 'schedule-row-1',
    employeeId: 'emp-ali',
    employeeCode: 'ALI',
    facilityId: 'facility-kamc',
    unitId: 'unit-ct-1',
    facilityLabel: 'KAMC',
    unitLabel: 'CT-1',
    shiftLabel: 'Day',
    timeRange: '08:00 - 16:00',
    fingerprint: scheduleAssignmentFingerprint(),
    startsAt: '2026-09-15T08:00:00',
  };
}

export function buildRecipientAssignment() {
  return {
    source: 'schedule' as const,
    departmentId: ids.department,
    monthKey,
    year: 2026,
    month: 8,
    day: 16,
    rowId: 'schedule-row-2',
    employeeId: 'emp-omar',
    employeeCode: 'OMR',
    facilityId: 'facility-kamc',
    unitId: 'unit-ct-1',
    facilityLabel: 'KAMC',
    unitLabel: 'CT-1',
    shiftLabel: 'Night',
    timeRange: '16:00 - 23:00',
    fingerprint: recipientScheduleAssignmentFingerprint(),
    startsAt: '2026-09-16T16:00:00',
  };
}

export async function resetDatabase() {
  await prisma.emailVerificationCode.deleteMany();
  await prisma.passwordResetCode.deleteMany();
  await prisma.calendarFeedToken.deleteMany();
  await prisma.shiftRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.employeeAccessProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.scheduleMonth.deleteMany();
  await prisma.overtimeMonth.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

function scheduleMonthPayload() {
  return {
    departmentId: ids.department,
    month: 8,
    year: 2026,
    facilities: [
      {
        id: 'facility-kamc',
        name: 'KAMC',
        accentColorToken: 'facility-kamc',
        units: [
          {
            id: 'unit-ct-1',
            name: 'CT-1',
            blockType: 'equipmentDay',
            rows: [
              {
                id: 'schedule-row-1',
                unitLabel: 'CT-1',
                rowLabel: 'Scanner 1',
                shiftLabel: 'Day',
                timeRange: '08:00 - 16:00',
                colorKey: 'morning',
                weekendOnly: false,
                blockType: 'equipmentDay',
                cellsByDay: {
                  15: [{ employeeId: 'emp-ali', employeeCode: 'ALI', status: 'published' }],
                },
              },
              {
                id: 'schedule-row-2',
                unitLabel: 'CT-1',
                rowLabel: 'Scanner 2',
                shiftLabel: 'Night',
                timeRange: '16:00 - 23:00',
                colorKey: 'night',
                weekendOnly: false,
                blockType: 'equipmentDay',
                cellsByDay: {
                  16: [{ employeeId: 'emp-omar', employeeCode: 'OMR', status: 'published' }],
                },
              },
            ],
          },
        ],
      },
    ],
    legend: [],
    vacations: [],
    holidays: [],
    settings: [],
    auditLog: [],
    cellMarkers: {},
  };
}

function overtimeMonthPayload() {
  return {
    rows: [
      {
        id: 'ot-row-1',
        title: 'Weekday OT',
        location: 'KAMC',
        timeRange: '18:00 - 22:00',
        hours: 4,
        unitId: 'ot-unit-1',
        assignments: {
          20: [{ kind: 'employee', employeeId: 'emp-ali' }],
        },
      },
    ],
    units: [
      {
        id: 'ot-unit-1',
        name: 'General OT',
      },
    ],
  };
}

export async function seedBaseData() {
  const passwordHash = await hashPassword(defaultPassword);

  await prisma.department.create({
    data: {
      id: ids.department,
      nameEn: 'CT Testing Department',
      nameAr: 'قسم الاختبار',
      descriptionEn: 'Integration test department',
      descriptionAr: 'قسم مخصص للاختبارات',
      managerId: null,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        id: ids.superAdmin,
        employeeNumber: 'EMP-900',
        code: 'SUP',
        nameEn: 'Super Admin',
        nameAr: 'مدير عام',
        email: 'super@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000000',
        role: UserRole.super_admin,
        departmentId: ids.department,
        positionEn: 'Head',
        positionAr: 'رئيس',
        isActive: true,
        passwordHash,
        scheduleEmployeeId: 'emp-super',
      },
      {
        id: ids.admin,
        employeeNumber: 'EMP-901',
        code: 'ADM',
        nameEn: 'Admin User',
        nameAr: 'مدير',
        email: 'admin@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000001',
        role: UserRole.admin,
        departmentId: ids.department,
        positionEn: 'Coordinator',
        positionAr: 'منسق',
        isActive: true,
        passwordHash,
        scheduleEmployeeId: 'emp-admin',
      },
      {
        id: ids.employeeAli,
        employeeNumber: 'EMP-902',
        code: 'ALI',
        nameEn: 'Ali',
        nameAr: 'علي',
        email: 'ali@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000002',
        role: UserRole.employee,
        departmentId: ids.department,
        positionEn: 'Technologist',
        positionAr: 'فني',
        isActive: true,
        passwordHash,
        scheduleEmployeeId: 'emp-ali',
      },
      {
        id: ids.employeeOmar,
        employeeNumber: 'EMP-903',
        code: 'OMR',
        nameEn: 'Omar',
        nameAr: 'عمر',
        email: 'omar@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000003',
        role: UserRole.employee,
        departmentId: ids.department,
        positionEn: 'Technologist',
        positionAr: 'فني',
        isActive: true,
        passwordHash,
        scheduleEmployeeId: 'emp-omar',
      },
      {
        id: ids.employeeView,
        employeeNumber: 'EMP-904',
        code: 'VW1',
        nameEn: 'View Only',
        nameAr: 'عرض فقط',
        email: 'viewer@hospital.sa',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        phone: '0501000004',
        role: UserRole.employee,
        departmentId: ids.department,
        positionEn: 'Observer',
        positionAr: 'مراقب',
        isActive: true,
        passwordHash,
        scheduleEmployeeId: 'emp-view',
      },
    ],
  });

  await prisma.department.update({
    where: { id: ids.department },
    data: {
      managerId: ids.superAdmin,
    },
  });

  await prisma.employeeAccessProfile.createMany({
    data: [
      {
        userId: ids.employeeAli,
        templateId: AccessTemplateId.standard,
        overridesJson: '{}',
        isActive: true,
        updatedByLabel: 'Seeder',
      },
      {
        userId: ids.employeeOmar,
        templateId: AccessTemplateId.standard,
        overridesJson: '{}',
        isActive: true,
        updatedByLabel: 'Seeder',
      },
      {
        userId: ids.employeeView,
        templateId: AccessTemplateId.view_only,
        overridesJson: '{}',
        isActive: true,
        updatedByLabel: 'Seeder',
      },
    ],
  });

  const schedule = scheduleMonthPayload();
  await prisma.scheduleMonth.create({
    data: {
      id: 'schedule-2026-09',
      monthKey,
      year: 2026,
      month: 8,
      departmentId: ids.department,
      draftJson: JSON.stringify(schedule),
      publishedJson: JSON.stringify(schedule),
      versionsJson: '[]',
      status: 'published',
      deleted: false,
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      publishedByUserId: ids.superAdmin,
    },
  });

  const overtime = overtimeMonthPayload();
  await prisma.overtimeMonth.create({
    data: {
      id: 'overtime-2026-09',
      monthKey,
      year: 2026,
      month: 8,
      departmentId: ids.department,
      rowsJson: JSON.stringify(overtime.rows),
      unitsJson: JSON.stringify(overtime.units),
      publishedRowsJson: JSON.stringify(overtime.rows),
      publishedUnitsJson: JSON.stringify(overtime.units),
      versionsJson: '[]',
      status: 'published',
      deleted: false,
      notice: 'Approved weekday overtime is 4 hours.',
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      publishedByUserId: ids.superAdmin,
    },
  });

  await prisma.notification.create({
    data: {
      id: 'notification-omar-private',
      type: 'general',
      title: 'Private note',
      message: 'Only Omar should see this.',
      audienceKind: 'account',
      audienceAccountId: ids.employeeOmar,
      departmentId: ids.department,
    },
  });
}

export async function login(agent: TestAgent, identifier: string, password = defaultPassword) {
  return agent.post('/api/auth/login').send({ identifier, password });
}

export function makeAgent(app: Express) {
  return new TestAgent(app);
}

export function prismaClient() {
  return prisma as PrismaClient;
}
