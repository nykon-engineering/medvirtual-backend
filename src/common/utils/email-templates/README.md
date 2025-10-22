# Email Templates with Dynamic Theming

This directory contains email templates that support dynamic theming based on user organizations.

## Quick Start

```typescript
import { getUserEmailTheme } from './theme-helper';
import getVerificationCodeTemplate from './verification-code';

// Get user's theme
const theme = await getUserEmailTheme(prisma, userId);

// Generate themed email
const emailBody = getVerificationCodeTemplate(code, theme || undefined);
```

## Files Overview

### Core Files
- `theme.ts` - Theme definitions and business logic
- `theme-helper.ts` - Database helper for getting user themes
- `components.ts` - Reusable email header and footer components

### Email Templates
- `invite-signup.ts` - User invitation emails
- `verification-code.ts` - Account verification emails
- `reset-password.ts` - Password reset emails

## Theme Logic

1. **User without organization_id** → MedVirtual theme
2. **User with Berry Virtual organization** → Berry Virtual theme (#FD7171)
3. **User with other organizations** → MedVirtual theme
4. **Error or no organizations found** → MedVirtual theme

## Adding New Templates

1. Import theme types:
```typescript
import { EmailTheme } from './theme';
import { getEmailHeader, getEmailFooter } from './components';
```

2. Add theme parameter to your function:
```typescript
export function myTemplate(data: string, theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const companyName = theme?.companyName || 'MedVirtual';
  // ... rest of template
}
```

3. Use dynamic components:
```typescript
return `
  <!DOCTYPE html>
  <html>
  <body>
    ${getEmailHeader(theme)}
    <!-- Your content -->
    ${getEmailFooter(theme)}
  </body>
  </html>
`;
```

## Testing

```typescript
// Test with Berry Virtual theme
const berryTheme = getEmailThemeByBusinessUnit('Berry Virtual');
const email = myTemplate('data', berryTheme);

// Test with MedVirtual theme
const medTheme = getEmailThemeByBusinessUnit('MedVirtual');
const email = myTemplate('data', medTheme);

// Test fallback
const email = myTemplate('data'); // Uses MedVirtual default
```
