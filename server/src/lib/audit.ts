import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

type AuditDb = PrismaClient | Prisma.TransactionClient;

export interface AuditDraft {
  actorUserId?: string | null;
  actorName: string;
  action: string;
  module: string;
  entityId: string;
  entityLabel: string;
  before?: unknown;
  after?: unknown;
  context: Record<string, unknown>;
}

export async function createAuditEntry(db: AuditDb, draft: AuditDraft) {
  await db.auditEntry.create({
    data: {
      id: `audit-${crypto.randomUUID()}`,
      actorUserId: draft.actorUserId ?? null,
      actorName: draft.actorName,
      action: draft.action,
      module: draft.module,
      entityId: draft.entityId,
      entityLabel: draft.entityLabel,
      before: draft.before === undefined ? null : JSON.stringify(draft.before),
      after: draft.after === undefined ? null : JSON.stringify(draft.after),
      contextJson: JSON.stringify(draft.context),
    },
  });
}
