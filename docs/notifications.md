## Notifications API

This document describes the email notification endpoints exposed by the backend. These endpoints use the existing `MailService` (Resend) under the hood to deliver emails.

### Requirements

- Environment variables:
  - `RESEND_API_KEY`: API key for Resend (required to send emails)
  - `FRONTEND_URL`: Used in email templates for assets (logo)
- Server port: default `3000` unless you set `PORT`

### Base URL

- Local: `http://localhost:3000`

### Routes Summary

- `POST /notifications` — Send a generic email to one or more recipients
- `POST /notifications/hire-request/:id/placement-completed` — Notify assignee when placement is completed
- `POST /notifications/hire-request/:id/client-edited` — Notify assignee when client edits a hire request
- `POST /notifications/hire-request/:id/client-canceled` — Notify assignee when client cancels a hire request
- `POST /notifications/ticket/:id/created` — Notify assignee when a ticket is created
- `POST /notifications/ticket/:id/assigned` — Notify assignee when a ticket is assigned
- `POST /notifications/ticket/:id/canceled` — Notify assignee when a ticket is canceled

---

## Generic Email

### Endpoint

- `POST /notifications`

### Request Body

```json
{
  "from": "MedVirtual <noreply@medvirtual.ai>",
  "to": ["user@example.com"],
  "cc": ["manager@example.com"],
  "subject": "Subject line",
  "html": "<p>HTML content</p>"
}
```

Notes:
- `to` accepts an array of emails.
- `cc` is optional (array of emails).

### Example

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "from": "MedVirtual <noreply@medvirtual.ai>",
    "to": ["user@example.com"],
    "subject": "Test notification",
    "html": "<p>Hello from notifications</p>"
  }'
```

### Responses

- 200: `{ "status": 200, "message": "Email sent successfully", "data": true }`
- 400: Missing/invalid fields or `RESEND_API_KEY` not set

---

## Hire Request Notifications

These endpoints automatically resolve the recipient as the hire request assignee (`hireRequest.assigned_user.email`).

### Placement Completed

- `POST /notifications/hire-request/:id/placement-completed`

Example:
```bash
curl -X POST http://localhost:3000/notifications/hire-request/<HIRE_REQUEST_ID>/placement-completed
```

### Client Edited

- `POST /notifications/hire-request/:id/client-edited`

Example:
```bash
curl -X POST http://localhost:3000/notifications/hire-request/<HIRE_REQUEST_ID>/client-edited
```

### Client Canceled

- `POST /notifications/hire-request/:id/client-canceled`

Example:
```bash
curl -X POST http://localhost:3000/notifications/hire-request/<HIRE_REQUEST_ID>/client-canceled
```

### Responses

- 200: `{ "status": 200, "message": "Notification sent", "data": true }`
- 404: Hire request not found
- 400: Hire request has no assignee email

---

## Ticket Notifications

These endpoints automatically resolve the recipient as the ticket assignee (`ticket.user.email`).

### Ticket Created

- `POST /notifications/ticket/:id/created`

Example:
```bash
curl -X POST http://localhost:3000/notifications/ticket/<TICKET_ID>/created
```

### Ticket Assigned

- `POST /notifications/ticket/:id/assigned`

Example:
```bash
curl -X POST http://localhost:3000/notifications/ticket/<TICKET_ID>/assigned
```

### Ticket Canceled

- `POST /notifications/ticket/:id/canceled`

Example:
```bash
curl -X POST http://localhost:3000/notifications/ticket/<TICKET_ID>/canceled
```

### Responses

- 200: `{ "status": 200, "message": "Notification sent", "data": true }`
- 404: Ticket not found
- 400: Ticket has no assignee email

---

## Troubleshooting

- 404 Not Found for `/notifications` routes:
  - Ensure the server is running with the latest code. If port `3000` is in use, restart or set `PORT=3001` before starting.
  - Confirm `NotificationsModule` is imported in `AppModule`.
- 400 Bad Request:
  - Verify request fields.
  - Ensure `RESEND_API_KEY` is set.


