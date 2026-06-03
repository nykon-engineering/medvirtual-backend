# Alliance Notifications Module — Spec

## Overview

The `AllianceNotificationsModule` (`src/med-alliance/notifications/`) is the single delivery point for all transactional emails in the Med Alliance affiliate program. It is a shared NestJS module imported by every sub-module that needs to send email.

### Design goals

- **Fire-and-forget**: every caller uses `void expression` — notifications never block or interrupt the calling transaction.
- **Error isolation**: every `sendMail` call is wrapped in try/catch that logs via `Logger.error` and never rethrows. A failed email never breaks business logic.
- **Idempotency on the caller**: the service does not deduplicate sends. Callers are responsible for calling at the right moment (after successful DB writes, inside post-commit flow).
- **Sender prefix**: `[DEV]` is prepended to the `from` field when `process.env.ENVIRONMENT !== 'PROD'`, matching the existing pattern in `AffiliatesService.buildFromWithPrefix()`.
- **Theme**: all Alliance emails use the `MedVirtual` theme by default (`getEmailThemeByBusinessUnit('MedVirtual')`). Any public method accepts an optional `theme?: EmailTheme` override for Berry Virtual compatibility.

---

## Module structure

```
src/med-alliance/notifications/
├── notifications.module.ts
├── notifications.service.ts
└── templates/
    ├── commission-eligible.ts
    ├── payout-paid.ts
    ├── referral-stage-changed.ts
    ├── admin-commission-pending.ts
    ├── admin-payout-requested.ts
    ├── admin-referral-new.ts
    ├── admin-partner-registered.ts
    └── admin-payment-failed.ts
```

### `AllianceNotificationsModule`

```typescript
@Module({
  imports: [MailModule, PrismaModule],
  providers: [AllianceNotificationsService],
  exports: [AllianceNotificationsService],
})
export class AllianceNotificationsModule {}
```

Imported by:
- `MedAllianceModule`
- `CommissionsModule`
- `PayoutRequestsModule`
- `ReferredCompaniesModule`
- `AffiliatesModule`
- `SyncModule`
- `BillComModule`

---

## `AllianceNotificationsService`

### Constructor dependencies

| Dependency | Purpose |
|---|---|
| `PrismaService` | Fetch admin recipients at send time |
| `MailService` | Resend API delivery |

### Private helpers

#### `defaultTheme(): EmailTheme`
Returns `getEmailThemeByBusinessUnit('MedVirtual')`.

#### `buildFrom(theme?: EmailTheme): string`
Constructs the `from` header: `${companyName} <noreply@medvirtual.ai>`. Prepends `[DEV]` when `process.env.ENVIRONMENT !== 'PROD'`.

#### `getAdminEmails(): Promise<string[]>`
Queries all users with `role` in `['system_admin', 'system_super_admin']` and returns their emails. Called fresh on every admin notification — no caching.

---

## Email events

### Partner emails (sent to the affiliate)

---

#### `notifyCommissionEligible`

| Field | Value |
|---|---|
| **Trigger** | `CommissionsService.decide()` when `newStatus === 'eligible'` |
| **File** | `src/med-alliance/commissions/commissions.service.ts` |
| **Recipient** | Affiliate user (the Growth Partner who made the referral) |
| **Subject** | `Your commission is ready — $[amount] from [Company]` |
| **Template** | `commission-eligible.ts` |
| **CTA** | `/modules/alliance/partner/earnings` |

**Payload interface:**
```typescript
interface CommissionEligiblePayload {
  firstName: string;
  organizationName: string;
  commissionAmount: number;   // formatted to 2 decimal places in email
  commissionPercent: number;
}
```

**Data source:** `prisma.affiliateCommission.findUnique` with `affiliate.email`, `affiliate.first_name`, `commission_amount`, `commission_percent_snapshot`, `organization.name`.

---

#### `notifyPayoutPaid`

| Field | Value |
|---|---|
| **Trigger** | `PayoutRequestsService.markPaid()` (manual admin action) AND `BillComPayoutService.finalizeAsPaid()` (Bill.com webhook) |
| **Files** | `payout-requests.service.ts`, `bill-com-payout.service.ts` |
| **Recipient** | Affiliate user |
| **Subject** | `Your payout of $[amount] has been processed` |
| **Template** | `payout-paid.ts` |
| **CTA** | `/modules/alliance/partner/payouts` |

**Payload interface:**
```typescript
interface PayoutPaidPayload {
  firstName: string;
  totalAmount: number;
  paidAt: Date;               // formatted as "Month DD, YYYY" in email
}
```

**Note:** This replaced the inline bare email in `BillComPayoutService.finalizeAsPaid()` (lines 247–261 in original).

---

#### `notifyReferralStageChanged`

| Field | Value |
|---|---|
| **Trigger** | `ReferredCompaniesService.updateReferralStage()` after successful stage update |
| **File** | `src/med-alliance/referred-companies/referred-companies.service.ts` |
| **Recipient** | Affiliate user linked to the referred organization (`org.referredByAffiliate`) |
| **Subject** | `[Company] has moved to [new stage]` |
| **Template** | `referral-stage-changed.ts` |
| **CTA** | `/modules/alliance/partner/referred-companies` |

**Payload interface:**
```typescript
interface ReferralStageChangedPayload {
  firstName: string;
  organizationName: string;
  previousStage: string;      // raw enum value, formatted in template
  newStage: string;
}
```

**Stage display:** `stageLabel()` helper replaces underscores with spaces and capitalizes each word. Example: `in_negotiation` → `In Negotiation`.

---

### Admin emails (sent to all `system_admin` and `system_super_admin` users)

---

#### `notifyAdminPayoutRequested`

| Field | Value |
|---|---|
| **Trigger** | `PayoutRequestsService.create()` after payout request is created |
| **File** | `src/med-alliance/payout-requests/payout-requests.service.ts` |
| **Recipients** | All system admins |
| **Subject** | `Payout request from [Partner] — $[amount]` |
| **Template** | `admin-payout-requested.ts` |
| **CTA** | `/modules/alliance/admin/payout-requests` |

**Payload interface:**
```typescript
interface AdminPayoutRequestedPayload {
  affiliateName: string;      // first_name + last_name, fallback to email
  totalAmount: number;
  commissionCount: number;    // number of commissions in the request
  payoutRequestId: string;
}
```

---

#### `notifyAdminCommissionPending`

| Field | Value |
|---|---|
| **Trigger** | `CommissionDetectionService.run()` when a commission is created with status `pending_admin_confirmation` (company is already `eligible` at creation time) |
| **File** | `src/med-alliance/sync/commission-detection.service.ts` |
| **Recipients** | All system admins |
| **Subject** | `Commission ready for review — [Company]` |
| **Template** | `admin-commission-pending.ts` |
| **CTA** | `/modules/alliance/admin/commissions` |

**Payload interface:**
```typescript
interface AdminCommissionPendingPayload {
  organizationName: string;
  affiliateName: string;      // affiliate user email, fallback to userId
  commissionAmount: number;
  commissionId: string;
}
```

**Note:** This fires during the HubSpot invoice sync cron, once per invoice per eligible company. For companies in the 30-day stabilization window, commissions are created as `detected` and this email is NOT sent.

---

#### `notifyAdminReferralNew`

| Field | Value |
|---|---|
| **Trigger** | `ReferredCompaniesService.create()` after a new referred company is created |
| **File** | `src/med-alliance/referred-companies/referred-companies.service.ts` |
| **Recipients** | All system admins |
| **Subject** | `New referral: [Company] referred by [Partner]` |
| **Template** | `admin-referral-new.ts` |
| **CTA** | `/modules/alliance/admin/pipeline` |

**Payload interface:**
```typescript
interface AdminReferralNewPayload {
  organizationName: string;
  affiliateName: string;      // first_name + last_name of the currentUser who submitted
  referredCompanyId: string;
}
```

---

#### `notifyAdminPartnerRegistered`

| Field | Value |
|---|---|
| **Trigger** | `AffiliatesService.create()` after a new affiliate profile is created |
| **File** | `src/med-alliance/affiliates/affiliates.service.ts` |
| **Recipients** | All system admins |
| **Subject** | `New Alliance partner registered: [Name]` |
| **Template** | `admin-partner-registered.ts` |
| **CTA** | `/modules/alliance/admin/partners` |

**Payload interface:**
```typescript
interface AdminPartnerRegisteredPayload {
  partnerName: string;        // first_name + last_name, fallback to email
  partnerEmail: string;
  affiliateProfileId: string;
}
```

---

#### `notifyAdminPaymentFailed`

| Field | Value |
|---|---|
| **Trigger** | `BillComPayoutService.markAsFailed()` when a Bill.com webhook reports payment failure |
| **File** | `src/med-alliance/bill-com/bill-com-payout.service.ts` |
| **Recipients** | All system admins |
| **Subject** | `Bill.com payment failed — [Partner name] ($[amount])` |
| **Template** | `admin-payment-failed.ts` |
| **CTA** | `/modules/alliance/admin/payout-requests` |

**Payload interface:**
```typescript
interface AdminPaymentFailedPayload {
  partnerName: string;
  amount: number;
  billComPaymentId: string;
  errorMsg: string;           // displayed in monospace error box
  payoutRequestId: string;
}
```

**Note:** This replaced the `notifyAdminsOfFailure()` private method in `BillComPayoutService`.

---

## Template conventions

All 8 templates follow the same pattern:

1. Function signature: `(payload, theme?: EmailTheme): string`
2. Full `<!DOCTYPE html>` document with inline CSS (email-client safe)
3. Logo: `https://staging.medvirtual.ai/${companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}`
4. `primaryColor` and `companyName` extracted from `theme` with fallbacks (`#01546B`, `MedVirtual`)
5. `getEmailFooter(theme)` injected at the bottom of every email
6. CTA button uses `primaryColor` background with `border-radius: 30px`

**Partner templates** include a personal greeting (`Hi [firstName],`) and a `highlight-box` (green left-border panel) to display monetary amounts.

**Admin templates** skip the greeting and go straight to a detail table. The payment-failed template additionally includes a red `alert-banner` and a monospace `error-msg` box.

---

## Error handling

```
notifyXxx()
  └─ outer try/catch
       ├─ getAdminEmails()  [admin emails only]
       └─ for each recipient
            └─ inner try/catch
                 └─ mail.sendMail()
                      └─ on failure: Logger.error, continue
```

- `MailService.sendMail` throws `BadRequestException` on Resend API failure — this is caught silently.
- A failure sending to one admin does not prevent delivery to the others.
- Errors are logged with `Logger.error` including the recipient address for tracing.

---

## Environment behavior

| `ENVIRONMENT` | `from` header |
|---|---|
| `PROD` | `MedVirtual <noreply@medvirtual.ai>` |
| anything else | `[DEV] MedVirtual <noreply@medvirtual.ai>` |

---

## Out of scope

- Email deduplication / idempotency — the service sends on every call.
- Unsubscribe / preferences — not applicable for transactional system emails.
- Retry logic — a failed send is logged and dropped; upstream retry is handled by the caller's own flow (e.g., cron re-runs).
- Partner-facing commission detected emails — commissions in `detected` status are in the 30-day stabilization window; no email is sent until they become `eligible`.
