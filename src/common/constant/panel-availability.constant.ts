import { HireRequestStatus, PanelCandidateStatus } from '@prisma/client';

/**
 * Hire request statuses that count as an OPEN panel for a client.
 *
 * MUST stay in sync with the client branch of `getOpenedHireRequests`
 * (hire-request/hire-request.service.ts) — that query is the canonical
 * definition of "open" everywhere else in the product, and the talent pool
 * must not disagree with the list of requests a client can actually endorse
 * candidates onto.
 *
 * Deliberately excluded: `awaiting_decision`, `placement_completed`,
 * `cancelled` and `deleted` — in all four the panel is closed, so the
 * candidate is free to be shortlisted again.
 */
export const CLIENT_OPEN_HIRE_REQUEST_STATUSES: HireRequestStatus[] = [
  HireRequestStatus.new,
  HireRequestStatus.pending_signature,
  HireRequestStatus.sourcing,
  HireRequestStatus.for_review,
  HireRequestStatus.panel_ready,
  HireRequestStatus.interview_scheduled,
];

/**
 * Panel-candidate statuses meaning the candidate no longer occupies the panel.
 *
 * A candidate is flipped to `returned_to_pool` in bulk when someone else wins
 * the panel (see `hire-request.service.ts`), so they must become shortlistable
 * again even while the hire request itself is still open.
 */
export const RELEASED_PANEL_CANDIDATE_STATUSES: PanelCandidateStatus[] = [
  PanelCandidateStatus.returned_to_pool,
];

/**
 * Minimal structural shape shared by every `panelCandidates` payload that
 * feeds `isInClientOpenPanel`. Kept loose on purpose: the four call sites
 * select slightly different fields, and `findOne` reaches the nested relations
 * through optional chaining because they can be absent there.
 */
export type PanelCandidateAvailabilityInput = {
  status?: PanelCandidateStatus | null;
  panel?: {
    hireRequest?: {
      status?: HireRequestStatus | null;
      organization?: { id?: string | null } | null;
    } | null;
  } | null;
};

/**
 * True when the candidate currently occupies an **open panel of this client**.
 *
 * Drives the client-facing "Already in a panel" tag, which replaces the
 * "Add to list" button in the talent pool. Two independent conditions must
 * hold, and both have caused production bugs when missing:
 *
 * 1. The panel belongs to `organizationId`. Without this, a candidate sitting
 *    in *another* client's panel wrongly showed "Already in a panel".
 * 2. The hire request is open AND the candidate has not been released back to
 *    the pool. Without this, only `interview_scheduled` counted, so a
 *    candidate in the client's own `sourcing`/`panel_ready` panel wrongly
 *    stayed addable.
 *
 * Returns `false` when `organizationId` is absent (system roles / public
 * endpoints), since the tag is client-scoped by definition.
 */
export function isInClientOpenPanel(
  panelCandidates: PanelCandidateAvailabilityInput[] | null | undefined,
  organizationId: string | null | undefined,
): boolean {
  if (!organizationId) return false;

  return (panelCandidates ?? []).some((pc) => {
    const hireRequest = pc?.panel?.hireRequest;
    if (hireRequest?.organization?.id !== organizationId) return false;

    // `status` is absent from some `panelCandidates` selects; treat an unknown
    // panel-candidate status as still occupying the panel (fail closed).
    if (pc?.status && RELEASED_PANEL_CANDIDATE_STATUSES.includes(pc.status)) {
      return false;
    }

    return (
      !!hireRequest.status &&
      CLIENT_OPEN_HIRE_REQUEST_STATUSES.includes(hireRequest.status)
    );
  });
}
