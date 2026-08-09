# Spec: Bill.com Payment Integration

**Feature:** Med Alliance — Automated Payout via Bill.com  
**Status:** Implemented (pending Prisma migration)  
**Date:** 2026-05-21

---

## 1. Overview

Previously, marking a payout request as paid required an admin to manually enter payment details (amount, date, transaction reference) by hand. This spec describes the automated replacement for Bill.com payouts.

When an admin clicks "Complete Payment" on an approved payout request whose affiliate uses Bill.com, the backend:

1. Authenticates with the Bill.com API (session managed automatically).
2. Creates a Bill.com bill for the affiliate.
3. Creates a Bill.com payment against that bill.
4. Moves the payout to `processing` status.

From that point, Bill.com webhooks drive the final state:

- **Payment confirmed** → payout moves to `paid`, partner receives an email.
- **Payment failed** → payout moves to `failed`, all admins are notified. The admin can retry, which resets the payout to `approved`.

Non-Bill.com payouts are unaffected. The existing `markPaid()` manual flow remains intact.

---

## 2. Payment Flow

```
approved
  └─ [admin clicks "Complete Payment"]
       └─ Bill.com login (session refreshed if needed)
            └─ POST /bills  → billId
                 └─ POST /payments  → paymentId
                      └─ status: processing
                           ├─ webhook: payment.updated (success)
                           │     └─ status: paid  → partner email sent
                           └─ webhook: payment.failed
                                 └─ status: failed  → all admins notified
                                      └─ [admin clicks "Retry"]
                                            └─ status: approved (retryable)
```

---

## 3. Data Model Changes

### 3.1 New enum values

```prisma
enum PayoutRequestStatus {
  // existing values unchanged ...
  processing   // Bill.com payment submitted and pending confirmation
  failed       // Bill.com payment failed; retryable by admin
}

enum PayoutMethod {
  // existing values unchanged ...
  bill_com     // Payment initiated via Bill.com API
}
```

### 3.2 New fields on `AffiliatePayoutRequest`

| Field | Type | Description |
|---|---|---|
| `bill_com_payment_id` | `String?` | Bill.com payment ID returned by `POST /payments` |
| `bill_com_status` | `String?` | Last raw status string from Bill.com (`SCHEDULED`, `PAID`, `FAILED`, etc.) |
| `bill_com_error` | `String?` | Error message from the `payment.failed` webhook payload |

All three fields are nullable. They are only populated for payouts processed via Bill.com.

### 3.3 Migration

```bash
npx prisma migrate dev --name add_billcom_payment_fields
npm run prisma:generate
```

---

## 4. Environment Variables

Add to `.env` (see `.env.example` for keys):

| Variable | Description |
|---|---|
| `BILLCOM_USERNAME` | Bill.com login username |
| `BILLCOM_PASSWORD` | Bill.com login password |
| `BILLCOM_ORGANIZATION_ID` | Bill.com organization ID |
| `BILLCOM_DEV_KEY` | Bill.com developer API key |
| `BILLCOM_FUNDING_ACCOUNT_ID` | Source bank account ID for all outbound payments |

> **Note:** There is no `BILLCOM_SESSION_ID` environment variable. The session ID is obtained at runtime via `POST /v3/login` and cached in memory by `BillComService`. It is transparently refreshed whenever a 401 is returned.

---

## 5. New Module: `src/med-alliance/bill-com/`

```
src/med-alliance/bill-com/
├── bill-com.module.ts
├── bill-com.service.ts
├── bill-com-payout.service.ts
├── bill-com-webhook.controller.ts
└── bill-com-admin.controller.ts
```

### 5.1 `BillComService`

Thin HTTP wrapper around the Bill.com REST API. No Prisma, no business logic. Base URL: `https://gateway.stage.bill.com/connect/v3`.

**Session management:**

- `login()` — calls `POST /v3/login` with credentials from env, stores `sessionId` in an instance-level cache.
- `ensureSession()` — returns the cached `sessionId`, calling `login()` if not set.
- On 401 from any downstream call, the cache is invalidated and one re-login is attempted before throwing `BadGatewayException`.

**Public methods:**

```typescript
createBill(params: {
  vendorId: string;       // affiliate account_number from payout_details
  dueDate: string;        // yyyy-MM-dd
  amount: number;
  description: string;
  invoiceNumber: string;  // payout request ID used as invoice reference
  invoiceDate: string;    // yyyy-MM-dd
}): Promise<{ billId: string }>
```

Request body sent to `POST /v3/bills`:
```json
{
  "vendorId": "...",
  "dueDate": "...",
  "billLineItems": [{ "amount": 0.00, "description": "..." }],
  "invoice": { "invoiceNumber": "...", "invoiceDate": "..." }
}
```

```typescript
createPayment(params: {
  vendorId: string;
  billId: string;
  amount: number;
  processDate: string;  // yyyy-MM-dd
}): Promise<{ paymentId: string; status: string }>
```

Request body sent to `POST /v3/payments`:
```json
{
  "vendorId": "...",
  "billId": "...",
  "processDate": "...",
  "fundingAccount": { "type": "BANK_ACCOUNT", "id": "<BILLCOM_FUNDING_ACCOUNT_ID>" },
  "amount": 0.00,
  "processingOptions": {
    "requestPayFaster": false,
    "createBill": false,
    "requestCheckDeliveryType": "STANDARD"
  }
}
```

Headers for all authenticated calls: `Content-Type`, `devKey`, `sessionId`.

---

### 5.2 `BillComPayoutService`

Owns all Bill.com-specific state machine transitions. Has direct Prisma access and injects `BillComService` and `MailService`.

**`initiatePayment(id, adminUser)`**

1. Loads payout request — must be `approved`. Throws `BadRequestException` otherwise.
2. Reads `affiliateProfile.payout_details` JSON → extracts `account_number` as `vendorId`. Throws `BadRequestException` if missing.
3. Derives amount from `approved_amount ?? requested_amount`.
4. Calls `BillComService.createBill(...)` to get `billId`.
5. Calls `BillComService.createPayment(...)` to get `paymentId`.
6. Updates payout: `status → processing`, stores `bill_com_payment_id`, `bill_com_status = 'SCHEDULED'`, `payment_method = 'bill_com'`.
7. Writes audit log: event `bill_com_payment_initiated`, source `admin_action`.
8. If any Bill.com call throws, the exception propagates before any DB write — payout stays `approved`.

**`retryPayment(id, adminUser)`**

1. Payout must be `failed`. Throws `BadRequestException` otherwise.
2. Resets payout: `status → approved`, clears `bill_com_payment_id`, `bill_com_status`, `bill_com_error`.
3. Writes audit log: event `status_changed` (`failed` → `approved`), source `admin_action`.

**`finalizeAsPaid(billComPaymentId)`** *(called by webhook)*

1. Looks up payout by `bill_com_payment_id`. If not found or not in `processing`, returns silently (idempotent).
2. Inside a transaction: sets `status → paid`, `paid_at`, `paid_amount`, `transaction_reference`, and marks linked commissions as `paid`.
3. Writes audit log, source `sync`.
4. Sends payout confirmation email to the affiliate (fire-and-forget, errors are swallowed).

**`markAsFailed(billComPaymentId, errorMsg)`** *(called by webhook)*

1. Looks up payout by `bill_com_payment_id`. If not found or not in `processing`, returns silently (idempotent).
2. Sets `status → failed`, `bill_com_status = 'FAILED'`, `bill_com_error = errorMsg`.
3. Writes audit log: event `bill_com_payment_failed`, source `sync`.
4. Calls `notifyAdminsOfFailure()` — queries all `system_admin` + `system_super_admin` users and sends each a failure email (fire-and-forget per recipient).

---

### 5.3 `BillComWebhookController`

Endpoint: `POST /webhooks/bill-com`

- No auth guard (matches existing HubSpot webhook pattern).
- Always returns HTTP 200 `{ received: true }` — even on internal errors — so Bill.com does not retry events that were already processed.
- Routes by `payload.eventType`:
  - `payment.updated` with a terminal success status (`PAID`, `COMPLETED`, `SUCCESS`) → `finalizeAsPaid()`
  - `payment.failed` → `markAsFailed()`
  - Anything else → logged and ignored.

---

### 5.4 `BillComAdminController`

Two admin-only endpoints under `POST /med-alliance/admin/payout-requests/:id/...`:

| Endpoint | Guard | Description |
|---|---|---|
| `initiate-payment` | `system_admin`, `system_super_admin` | Triggers Bill.com bill + payment creation |
| `retry-payment` | `system_admin`, `system_super_admin` | Resets a `failed` payout back to `approved` |

These endpoints live in `BillComAdminController` (inside `BillComModule`) rather than in `PayoutRequestsController` to avoid a circular module dependency.

---

### 5.5 `BillComModule`

```typescript
@Module({
  imports: [PrismaModule, MailModule, PayoutRequestsModule],
  providers: [BillComService, BillComPayoutService],
  controllers: [BillComWebhookController, BillComAdminController],
  exports: [BillComService, BillComPayoutService],
})
```

`PayoutRequestsModule` does **not** import `BillComModule` — there is no circular dependency.

---

## 6. Changes to Existing Files

### `payout-requests/payout-request.selects.ts` *(new)*

The Prisma select shapes (`PAYOUT_REQUEST_SELECT`, `ADMIN_SELECT`) and the `shapeAdminRequest` helper were extracted from `payout-requests.service.ts` into this shared file. The three new `bill_com_*` fields are included in both select shapes. Both `payout-requests.service.ts` and `bill-com-payout.service.ts` import from here.

### `payout-requests/payout-requests.service.ts`

- Replaced inline select constants and helpers with imports from `payout-request.selects.ts`.
- `getStatusCounts()`: added `processing: 0` and `failed: 0` to the result initializer so the kanban count endpoint returns all statuses.
- All other methods (`markPaid`, `decide`, etc.) are **unchanged**.

### `med-alliance/med-alliance.module.ts`

Added `BillComModule` to the imports array.

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| Missing env var (`BILLCOM_*`) | `InternalServerErrorException` at call time |
| `sessionId` expired (401 from Bill.com) | Session invalidated, one re-login attempted; if that fails → `BadGatewayException` |
| Bill.com login fails (wrong credentials) | `BadGatewayException` propagates to admin — payout unchanged |
| `createBill` succeeds but `createPayment` fails | `BadGatewayException` before any DB write — payout stays `approved`. Orphaned bill on Bill.com is acceptable; admin retries which creates a new one. |
| Payout not in `approved` status when admin calls initiate | `BadRequestException` |
| `payout_details.account_number` missing | `BadRequestException` |
| Webhook with unknown `bill_com_payment_id` | Logged as warning, returns 200 |
| `payment.updated` for already-`paid` payout | Idempotent — no state change, returns 200 |
| Admin email failure in failure notification | Swallowed per recipient, logged — webhook still returns 200 |
| `retryPayment` on non-`failed` payout | `BadRequestException` |

---

## 8. Out of Scope

- Support for payout methods other than Bill.com (existing `markPaid()` handles those).
- Bill.com vendor registration (affiliates are assumed to already have Bill.com accounts with a valid `account_number` in `payout_details`).
- Retry scheduling or automatic retry on failure (admin retries manually).
- Session refresh logic for `BILLCOM_SESSION_ID` expiry beyond the single re-login retry.
- Partial payments or split payouts.

---

## 9. Frontend Changes Required

> These changes are not implemented in the backend spec — they are required on the frontend side.

**Admin "Complete Payment" action:**

- Replace the existing manual payment modal with a confirmation dialog:
  > "Send payment via Bill.com? Amount: $X.XX — Recipient: [Partner name]"
- On confirm: `POST /med-alliance/admin/payout-requests/:id/initiate-payment`
- On success: payout card updates to `processing` status.
- On API error (`400`, `502`): show inline error in dialog, keep dialog open.

**New payout status pills:**

| Status | Style | Description shown |
|---|---|---|
| `processing` | Blue | "Payment submitted to Bill.com — awaiting confirmation" |
| `failed` | Red | Bill.com error message + "Retry" button |

**"Retry" button:** calls `POST /med-alliance/admin/payout-requests/:id/retry-payment`.

**Payout detail view:** when `bill_com_payment_id` is set, show:
- Bill.com Payment ID (with copy button)
- Bill.com Status (`SCHEDULED` / `PAID` / `FAILED`)

**Partner payout tab:**

| Internal status | Shown to partner |
|---|---|
| `processing` | "On the way!" |
| `failed` | Not shown — partner sees last confirmed state |
| `paid` | "Paid" |

Partners are never exposed to Bill.com terminology or error details.

---

## 10. Notification Emails

| Event | Trigger | Recipients |
|---|---|---|
| Payment confirmed | `finalizeAsPaid()` via webhook | Affiliate (partner) |
| Payment failed | `markAsFailed()` via webhook | All `system_admin` + `system_super_admin` users |

**Admin failure email subject:** `"Bill.com payment failed — [Partner name] ($X.XX)"`

**Admin failure email body includes:** partner name, amount, Bill.com payment ID, error message, link to the payout request in the admin UI.
