import axios from 'axios';
import api from './axios';
import { fetchAndHydrateBootstrap } from './backendBootstrap';
import type {
  CreateShiftRequestInput,
  ShiftRequest,
  ShiftRequestAdminRejectionReason,
  ShiftRequestMutationReason,
  ShiftRequestMutationResult,
  ShiftRequestWarning,
} from '@/types/shiftRequest';

function failure(
  reason: ShiftRequestMutationReason,
  request?: ShiftRequest,
  warnings?: ShiftRequestWarning[],
  message?: string,
): ShiftRequestMutationResult {
  return { ok: false, reason, ...(request ? { request } : {}), ...(warnings ? { warnings } : {}), ...(message ? { message } : {}) };
}

function mapError(error: unknown): ShiftRequestMutationResult {
  if (!axios.isAxiosError(error)) return failure('storage_error');
  const code = String(error.response?.data?.error?.code ?? '');
  const message = String(error.response?.data?.error?.message ?? '');
  const warnings = error.response?.data?.warnings as ShiftRequestWarning[] | undefined;
  const byCode: Record<string, ShiftRequestMutationReason> = {
    FORBIDDEN: 'permission_denied',
    RECIPIENT_NOT_LINKED: 'recipient_not_linked',
    CROSS_DEPARTMENT: 'cross_department',
    OFFERED_REQUIRED: 'offered_shift_required',
    OFFERED_NOT_ALLOWED: 'offered_shift_not_allowed',
    SOURCE_MISMATCH: 'source_mismatch',
    SAME_EMPLOYEE: 'same_employee',
    SAME_CELL: 'same_cell',
    STALE_ASSIGNMENT: 'stale',
    NOT_PUBLISHED: 'not_published',
    PAST_SHIFT: 'past_shift',
    DUPLICATE_REQUEST: 'duplicate_request',
    INVALID_STATUS: 'invalid_status',
    DRAFT_CONFLICT: 'draft_conflict',
    CONFLICT_REQUIRES_OVERRIDE: 'conflict_requires_override',
    NOTE_REQUIRED: 'rejection_note_required',
    NOT_FOUND: 'not_found',
    INACTIVE_ACCOUNT: 'inactive_account',
  };
  return failure(byCode[code] ?? 'storage_error', undefined, warnings, message || undefined);
}

async function refreshAfterMutation(promise: Promise<{ data: { request: ShiftRequest } }>): Promise<ShiftRequestMutationResult> {
  try {
    const response = await promise;
    await fetchAndHydrateBootstrap();
    return { ok: true, request: response.data.request };
  } catch (error) {
    return mapError(error);
  }
}

export async function createShiftRequest(input: CreateShiftRequestInput): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post('/shift-requests', {
    type: input.type,
    recipientAccountId: input.recipientAccountId,
    requesterAssignment: input.requesterAssignment,
    offeredAssignment: input.offeredAssignment,
  }));
}

export async function createShiftRequestBatch(inputs: CreateShiftRequestInput[]) {
  const results: ShiftRequestMutationResult[] = [];
  let createdCount = 0;
  for (const input of inputs) {
    const result = await createShiftRequest(input);
    results.push(result);
    if (result.ok) createdCount += 1;
  }
  return {
    ok: createdCount > 0,
    createdCount,
    results,
  };
}

export async function acceptShiftRequest(requestId: string): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post(`/shift-requests/${requestId}/accept`));
}

export async function rejectShiftRequestByRecipient(requestId: string): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post(`/shift-requests/${requestId}/reject`));
}

export async function cancelShiftRequest(requestId: string): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post(`/shift-requests/${requestId}/cancel`));
}

export async function approveShiftRequest(requestId: string, overrideConflicts = false): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post(`/shift-requests/${requestId}/approve`, { overrideConflicts }));
}

export async function rejectShiftRequestByAdmin(
  requestId: string,
  reason: ShiftRequestAdminRejectionReason,
  note?: string,
): Promise<ShiftRequestMutationResult> {
  return refreshAfterMutation(api.post(`/shift-requests/${requestId}/reject-admin`, { reason, note }));
}

export async function deleteShiftRequest(requestId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await api.delete(`/shift-requests/${requestId}`);
    await fetchAndHydrateBootstrap();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Delete failed' };
  }
}

export async function clearClosedShiftRequests(): Promise<{ ok: boolean; count: number; message?: string }> {
  try {
    const response = await api.delete<{ ok: boolean; count: number }>('/shift-requests/clear-closed');
    await fetchAndHydrateBootstrap();
    return { ok: true, count: response.data.count };
  } catch (error) {
    return { ok: false, count: 0, message: axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Clear failed' };
  }
}
