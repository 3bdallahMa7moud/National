export type ShiftRequestType = 'exchange' | 'replace';

export type ShiftRequestStatus =
  | 'pending_recipient'
  | 'pending_admin'
  | 'approved'
  | 'recipient_rejected'
  | 'admin_rejected'
  | 'cancelled'
  | 'expired'
  | 'stale';

export type ShiftRequestSource = 'schedule' | 'ot';

export type ShiftRequestWarningCode = 'schedule_conflict' | 'approved_vacation';

export type ShiftRequestAdminRejectionReason =
  | 'staff_shortage'
  | 'skill_mismatch'
  | 'approved_leave'
  | 'operational_need'
  | 'other';

export interface ShiftAssignmentRef {
  source: ShiftRequestSource;
  departmentId: string;
  monthKey: string;
  year: number;
  /** Zero-based month index, matching the Schedule stores. */
  month: number;
  day: number;
  rowId: string;
  employeeId: string;
  employeeCode: string;
  facilityId?: string;
  unitId?: string;
  facilityLabel: string;
  unitLabel: string;
  shiftLabel: string;
  timeRange: string;
  /** Snapshot fingerprint used to reject stale requests after the table changes. */
  fingerprint: string;
  startsAt: string;
}

export interface ShiftRequestWarning {
  code: ShiftRequestWarningCode;
  employeeId: string;
  assignment: ShiftAssignmentRef;
  message: string;
}

export type ShiftRequestActorRole = 'requester' | 'recipient' | 'admin' | 'system';

export interface ShiftRequestTimelineEvent {
  id: string;
  action:
    | 'created'
    | 'recipient_accepted'
    | 'recipient_rejected'
    | 'admin_approved'
    | 'admin_rejected'
    | 'cancelled'
    | 'expired'
    | 'stale'
    | 'conflict_overridden';
  actorRole: ShiftRequestActorRole;
  actorAccountId?: string;
  actorName: string;
  createdAt: string;
  note?: string;
}

export interface ShiftRequestParty {
  accountId: string;
  employeeId: string;
  employeeCode: string;
  name: string;
}

export interface ShiftRequest {
  id: string;
  type: ShiftRequestType;
  departmentId: string;
  requester: ShiftRequestParty;
  recipient: ShiftRequestParty;
  requesterAssignment: ShiftAssignmentRef;
  /** Required only for Exchange. */
  offeredAssignment?: ShiftAssignmentRef;
  status: ShiftRequestStatus;
  warnings: ShiftRequestWarning[];
  adminRejectionReason?: ShiftRequestAdminRejectionReason;
  adminRejectionNote?: string;
  conflictOverride?: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  timeline: ShiftRequestTimelineEvent[];
}

export interface CreateShiftRequestInput {
  type: ShiftRequestType;
  requesterAccountId: string;
  requesterName: string;
  recipientAccountId: string;
  recipientName: string;
  requesterAssignment: ShiftAssignmentRef;
  offeredAssignment?: ShiftAssignmentRef;
}

export type ShiftRequestMutationReason =
  | 'permission_denied'
  | 'unlinked_account'
  | 'inactive_account'
  | 'recipient_not_linked'
  | 'same_employee'
  | 'same_cell'
  | 'target_already_assigned'
  | 'cross_department'
  | 'source_mismatch'
  | 'offered_shift_required'
  | 'offered_shift_not_allowed'
  | 'not_found'
  | 'not_published'
  | 'past_shift'
  | 'duplicate_request'
  | 'wrong_actor'
  | 'invalid_status'
  | 'stale'
  | 'draft_conflict'
  | 'conflict_requires_override'
  | 'rejection_reason_required'
  | 'rejection_note_required'
  | 'storage_error'
  | 'apply_failed'
  | 'day_shift_ot_conflict';

export type ShiftRequestMutationResult =
  | { ok: true; request: ShiftRequest }
  | {
      ok: false;
      reason: ShiftRequestMutationReason;
      request?: ShiftRequest;
      warnings?: ShiftRequestWarning[];
      message?: string;
    };

export interface ShiftAssignmentValidationSuccess {
  ok: true;
  assignment: ShiftAssignmentRef;
}

export type ShiftAssignmentValidationResult =
  | ShiftAssignmentValidationSuccess
  | {
      ok: false;
      reason: 'not_found' | 'not_published' | 'past_shift' | 'stale';
      message?: string;
    };

export interface ShiftApplyReceipt {
  id: string;
  before: unknown;
  after: unknown;
}

export type ShiftAssignmentApplyResult =
  | { ok: true; receipt: ShiftApplyReceipt; warnings: ShiftRequestWarning[] }
  | {
      ok: false;
      reason: 'not_found' | 'stale' | 'draft_conflict' | 'storage_error' | 'apply_failed';
      warnings?: ShiftRequestWarning[];
      message?: string;
    };

export interface ShiftAssignmentGateway {
  validate(assignment: ShiftAssignmentRef, now: Date): ShiftAssignmentValidationResult;
  inspectWarnings(request: ShiftRequest): ShiftRequestWarning[];
  apply(request: ShiftRequest, options: { actorName: string; overrideConflicts: boolean }): ShiftAssignmentApplyResult;
  rollback(receipt: ShiftApplyReceipt): void;
}
