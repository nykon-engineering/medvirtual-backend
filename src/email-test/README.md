# Email Testing Endpoints

This module provides endpoints to test all email templates with different themes.

## Available Endpoints

### Base URL
```
GET /email-test
```

### 1. Test Verification Code Template
```
GET /email-test/verification-code?theme=medvirtual&berry=false&email=test@example.com
```

**Parameters:**
- `theme` (optional): `medvirtual` or `berry` (default: `medvirtual`)
- `berry` (optional): `true` or `false` (default: `false`)
- `email` (optional): Destination email (default: `test@example.com`)

**Example:**
```bash
# MedVirtual theme
curl "http://localhost:3000/email-test/verification-code?theme=medvirtual&berry=false&email=test@example.com"

# Berry Virtual theme
curl "http://localhost:3000/email-test/verification-code?theme=berry&berry=true&email=test@example.com"
```

### 2. Test Invite Signup Template
```
GET /email-test/invite-signup?theme=medvirtual&email=test@example.com
```

**Parameters:**
- `theme` (optional): `medvirtual` or `berry` (default: `medvirtual`)
- `email` (optional): Destination email (default: `test@example.com`)

**Example:**
```bash
curl "http://localhost:3000/email-test/invite-signup?theme=berry&email=test@example.com"
```

### 3. Test Reset Password Template
```
GET /email-test/reset-password?theme=medvirtual&email=test@example.com
```

**Parameters:**
- `theme` (optional): `medvirtual` or `berry` (default: `medvirtual`)
- `email` (optional): Destination email (default: `test@example.com`)

**Example:**
```bash
curl "http://localhost:3000/email-test/reset-password?theme=medvirtual&email=test@example.com"
```

### 4. Test Notification Template
```
GET /email-test/notification?theme=medvirtual&email=test@example.com
```

**Parameters:**
- `theme` (optional): `medvirtual` or `berry` (default: `medvirtual`)
- `email` (optional): Destination email (default: `test@example.com`)

**Example:**
```bash
curl "http://localhost:3000/email-test/notification?theme=berry&email=test@example.com"
```

### 5. Test All Templates
```
GET /email-test/all?theme=medvirtual&email=test@example.com
```

**Parameters:**
- `theme` (optional): `medvirtual` or `berry` (default: `medvirtual`)
- `email` (optional): Destination email (default: `test@example.com`)

**Example:**
```bash
curl "http://localhost:3000/email-test/all?theme=berry&email=test@example.com"
```

## Available Themes

### MedVirtual (Default)
- **Primary color**: #01546B
- **Hover color**: #013A4F
- **Name**: MedVirtual
- **Usage**: For users without organization or with organization that is not Berry Virtual

### Berry Virtual
- **Primary color**: #FD7171
- **Hover color**: #E55A5A
- **Name**: Berry Virtual
- **Usage**: For users with active Berry Virtual organization

## API Response

### Success Response
```json
{
  "success": true,
  "message": "Email sent successfully",
  "theme": "MedVirtual",
  "isBerryVirtual": false,
  "verificationCode": "123456",
  "verificationUrl": "http://localhost:3000/signup/verification-code?t=123456&berry=false"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Failed to send email",
  "error": "Error details here"
}
```

### Response for /all
```json
{
  "success": true,
  "message": "All email templates sent successfully",
  "theme": "MedVirtual",
  "results": {
    "verificationCode": { "success": true, "message": "..." },
    "inviteSignup": { "success": true, "message": "..." },
    "resetPassword": { "success": true, "message": "..." },
    "notification": { "success": true, "message": "..." }
  }
}
```

## Template Features

### Modern Design
- Logo with color dot
- Simple greeting "Hi,"
- Main message with emoji :)
- Modern CTA button
- Personalized closing "Best, [Company] team"
- Minimalist footer with support

### Responsive
- Compatible with email clients
- System fonts
- Inline styles for maximum compatibility

### Dynamic Theming
- Colors based on organization
- Dynamic company name
- Customized support email

## Development Usage

1. **Start the server**:
   ```bash
   npm run start:dev
   ```

2. **Test a specific template**:
   ```bash
   curl "http://localhost:3000/email-test/verification-code?theme=berry&email=your-email@example.com"
   ```

3. **Test all templates**:
   ```bash
   curl "http://localhost:3000/email-test/all?theme=medvirtual&email=your-email@example.com"
   ```

## Required Environment Variables

Make sure you have the following environment variables configured:

```bash
# Required for mail service
RESEND_API_KEY=your_resend_api_key

# Optional - Sender email (default: noreply@medvirtual.ai)
FROM_EMAIL=noreply@medvirtual.ai

# Optional - Frontend URL (default: http://localhost:3000)
FRONTEND_URL=http://localhost:3000
```

## Required Logo Files

Make sure you have the following logo files in your frontend:

```
frontend/public/logo.png      # MedVirtual logo
frontend/public/logobv.png    # Berry Virtual logo
```

Templates will automatically select the correct logo based on the theme:
- **MedVirtual**: `logo.png`
- **Berry Virtual**: `logobv.png`

## Important Notes

- Emails are actually sent using the configured mail service
- Tokens and codes are for testing (not valid for real use)
- Make sure you have the mail service (Resend) configured correctly
- Endpoints are available only in development (consider adding guards for production)
- The `from` field is taken from `FROM_EMAIL` or uses `noreply@medvirtual.ai` by default