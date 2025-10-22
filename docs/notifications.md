## Notifications System

This document describes the email notification system used internally by the backend. Notifications are sent automatically when certain events occur and are handled through the `NotificationsService`.

### Requirements

- Environment variables:
  - `RESEND_API_KEY`: API key for Resend (required to send emails)
  - `FRONTEND_URL`: Used in email templates for assets (logo)

### How It Works

Notifications are sent automatically when:
- A hire request is created and assigned to a user
- A hire request is reassigned to another user
- A hire request status changes to 'placement_completed'
- A client edits or cancels a hire request
- A ticket is created, assigned, or closed

### Notification Methods

The system uses the following notification methods internally:

#### 1. Hire Request Created
- **Method**: `notifyHireRequestCreated(hireRequestId: string)`
- **Triggered when**: A hire request is created and assigned to a user
- **Used in**: `HireRequestService.create()`
- **Recipient**: The assigned user (`hireRequest.assigned_user.email`)

#### 2. Hire Request Reassigned
- **Method**: `notifyHireRequestCreated(hireRequestId: string)` (reused)
- **Triggered when**: A hire request is reassigned to another user
- **Used in**: `HireRequestService.reassign()`
- **Recipient**: The newly assigned user

#### 3. Placement Completed
- **Method**: `notifyHireRequestPlacementCompleted(hireRequestId: string, winnerCandidateId?: string)`
- **Triggered when**: A hire request status changes to 'placement_completed'
- **Used in**: `HireRequestService.changeWinner()`
- **Recipient**: The assigned user
- **Includes**: Winner candidate name in the email template

#### 4. Client Changes
- **Method**: `notifyHireRequestClientChange(hireRequestId: string, action: 'edited' | 'canceled')`
- **Triggered when**: Client edits or cancels a hire request
- **Used in**: `HireRequestService.update()` and status change methods
- **Recipient**: The assigned user

#### 5. Ticket Events
- **Method**: `notifyTicketEvent(ticketId: string, event: 'created' | 'assigned' | 'closed')`
- **Triggered when**: Ticket is created, assigned, or closed
- **Used in**: `TicketService.create()` and other ticket operations
- **Recipient**: The assigned user (`ticket.user.email`)

### Email Template

All notifications use a consistent email template with:
- **Header**: MedVirtual logo with brand color (#01546B)
- **Content**: Event-specific information and details
- **Button**: "View Details" button with brand color (#01546B)
- **Footer**: Copyright information

### Error Handling

- All notifications are sent asynchronously
- Errors are logged but don't interrupt business logic
- Missing email addresses are handled gracefully
- Failed notifications are logged with warning messages

---

## Troubleshooting

### Common Issues

1. **No notifications received**:
   - Check that `RESEND_API_KEY` is set in environment variables
   - Check that `FRONTEND_URL` is set for email template assets
   - Verify the assigned user has a valid email address
   - Check server logs for notification errors

2. **Missing assigned user**:
   - Ensure hire requests have an assigned user before sending notifications
   - Check organization admin_id is properly set

3. **Email template issues**:
   - Verify `FRONTEND_URL` is accessible for logo loading
   - Check that all required fields are present in the database

### Debugging

To debug notification issues, check the server logs for:
- `[notifications] Attempting to send...` - Notification is being sent
- `[notifications] ...sent successfully` - Notification was sent successfully
- `[notifications] ...email failed` - Notification failed to send
- `[notifications] No assigned user...` - No user to notify

### Testing

You can test notifications by:
1. Creating a new hire request with an assigned user
2. Reassigning a hire request to another user
3. Changing a hire request status to 'placement_completed'
4. Editing a hire request as a client user