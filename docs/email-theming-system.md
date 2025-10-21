# Email Theming System Documentation

## Overview

The Email Theming System allows dynamic email styling based on the user's organization business unit. This system automatically applies different color schemes and branding to emails depending on whether the user belongs to "Berry Virtual" or "MedVirtual" organizations.

## Features

- **Dynamic Color Theming**: Emails automatically use organization-specific colors
- **Berry Virtual Support**: Special #FD7171 color scheme for Berry Virtual organizations
- **MedVirtual Default**: Standard #01546B color scheme for MedVirtual and other organizations
- **Fallback Handling**: Graceful fallback to MedVirtual theme when organization cannot be determined
- **Backward Compatibility**: Existing email templates continue to work without modification

## Architecture

### Core Components

#### 1. Theme Definition (`src/common/utils/email-templates/theme.ts`)

```typescript
export interface EmailTheme {
  primaryColor: string;
  primaryColorHover: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  companyName: string;
}
```

**Functions:**
- `getEmailThemeByBusinessUnit(businessUnit: string | null): EmailTheme`
- `getEmailThemeByUserId(userId: string, organizations: any[]): EmailTheme`

#### 2. Theme Helper (`src/common/utils/email-templates/theme-helper.ts`)

```typescript
export async function getUserEmailTheme(prisma: PrismaService, userId: string)
```

**Logic:**
1. Checks user role first
2. **System users** (system_super_admin, system_admin): Always use MedVirtual theme
3. **Client users without organization_id**: Use MedVirtual theme
4. **Client users with organization_id**: Query user's organizations (admin, owner, or member)
5. Prioritizes "Berry Virtual" over other business units
6. Falls back to MedVirtual theme if no organizations found

#### 3. Email Components (`src/common/utils/email-templates/components.ts`)

**Functions:**
- `getEmailHeader(theme?: EmailTheme): string`
- `getEmailFooter(theme?: EmailTheme): string`

**Legacy Support:**
- `EmailHeader` and `EmailFooter` constants for backward compatibility

### Supported Email Templates

#### 1. Invite Signup (`invite-signup.ts`)
- **Usage**: `InviteSignup(inviteLink: string, theme?: EmailTheme)`
- **Dynamic Elements**: Button colors, header background, company name

#### 2. Verification Code (`verification-code.ts`)
- **Usage**: `getVerificationCodeTemplate(code: string, theme?: EmailTheme, isBerryVirtual?: boolean, verificationUrl?: string)`
- **Dynamic Elements**: Code color, header background, company name, Berry Virtual indicator, verification URL

#### 3. Reset Password (`reset-password.ts`)
- **Usage**: `getResetPasswordTemplate(userName: string, resetLink: string, theme?: EmailTheme)`
- **Dynamic Elements**: Button colors, header background, company name

## System Behavior

### User Type Handling

1. **System Users** (system_super_admin, system_admin):
   - Always use MedVirtual theme regardless of organizations
   - No dynamic theming applied

2. **Client Users without organization_id**:
   - Use MedVirtual theme by default

3. **Client Users with organization_id**:
   - Check their organization and any they admin/own
   - Prioritize "Berry Virtual" organizations
   - Fall back to MedVirtual theme if no organizations found

4. **Error Handling**:
   - Database errors return null (uses MedVirtual fallback)
   - Invalid business units fall back to MedVirtual theme

## Color Schemes

### Berry Virtual Theme
```typescript
{
  primaryColor: '#FD7171',
  primaryColorHover: '#E55A5A',
  secondaryColor: '#F8F9FA',
  accentColor: '#FD7171',
  companyName: 'Berry Virtual'
}
```

### Berry Virtual Indicator

For verification code emails, an additional visual indicator is shown when the user belongs to Berry Virtual:

```html
<div style="background-color: #FD7171; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; font-weight: 600;">
  <strong>Berry Virtual Account</strong>
</div>
```

This indicator only appears when `isBerryVirtual` is `true`.

### Verification URL

The verification code email includes a URL that contains both the verification token and the Berry Virtual status:

```
http://localhost:3000/signup/verification-code?t=TOKEN&berry=true
http://localhost:3000/signup/verification-code?t=TOKEN&berry=false
```

- `t`: The verification token/code
- `berry`: Boolean indicating if the user belongs to Berry Virtual (`true` or `false`)

This URL allows the frontend to:
1. Extract the verification code automatically
2. Apply appropriate styling based on Berry Virtual status
3. Show relevant branding and messaging

### MedVirtual Theme (Default)
```typescript
{
  primaryColor: '#01546B',
  primaryColorHover: '#013A4F',
  secondaryColor: '#F8F9FA',
  accentColor: '#00B2E2',
  companyName: 'MedVirtual'
}
```

## Implementation in Services

### AuthService
All authentication-related emails automatically use dynamic theming:

```typescript
// Get user email theme and Berry Virtual status
const emailTheme = await getUserEmailTheme(this.prisma, user.id);
const isBerryVirtual = await isUserBerryVirtual(this.prisma, user.id);

// Generate verification URL with Berry Virtual parameter
const verificationUrl = `${process.env.FRONTEND_URL}/signup/verification-code?t=${code}&berry=${isBerryVirtual ? 'true' : 'false'}`;

// Send email with theme, Berry Virtual indicator, and verification URL
const emailBody = getVerificationCodeTemplate(code, emailTheme || undefined, isBerryVirtual, verificationUrl);
```

**Affected Methods:**
- `signUp()` - User registration verification
- `resendCode()` - Verification code resend
- `inviteUser()` - User invitation

### RecoveryPassService
Password recovery emails use dynamic theming:

```typescript
const emailTheme = await getUserEmailTheme(this.prisma, user.id);
const emailBody = getResetPasswordTemplate(
  user.first_name,
  resetLink,
  emailTheme || undefined
);
```

### NotificationsService
All notification emails use dynamic theming:

```typescript
// Get user email theme
const emailTheme = await getUserEmailTheme(this.prisma, user.id);

// Build email with theme
const html = this.buildEmail(emailContent, emailTheme);
```

**Affected Methods:**
- `notifyHireRequestPlacementCompleted()`
- `notifyHireRequestClientChange()`
- `notifyHireRequestAssigned()`
- `notifyTicketChange()`

## Database Requirements

The system relies on the following database structure:

### USER Table
- `id`: Primary key
- `organization_id`: Foreign key to organization (nullable)
- `is_organization_owner`: Boolean flag
- Other user fields...

### Organization Table
- `id`: Primary key
- `business_unit`: String field (e.g., "Berry Virtual", "MedVirtual")
- `status`: Organization status
- `admin_id`: Foreign key to admin user
- `owner_id`: Foreign key to owner user

## Usage Examples

### Creating a New Email Template

```typescript
import { getEmailHeader, getEmailFooter } from '../components';
import { EmailTheme } from '../theme';

export function myEmailTemplate(data: string, theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const companyName = theme?.companyName || 'MedVirtual';
  
  return `
    <!DOCTYPE html>
    <html>
    <body>
      <div class="container">
        ${getEmailHeader(theme)}
        
        <div class="content">
          <h2 style="color: ${primaryColor};">Welcome to ${companyName}</h2>
          <p>${data}</p>
        </div>
        
        ${getEmailFooter(theme)}
      </div>
    </body>
    </html>
  `;
}
```

### Using in a Service

```typescript
// Get user's email theme
const emailTheme = await getUserEmailTheme(this.prisma, userId);

// Generate email with theme
const emailBody = myEmailTemplate(data, emailTheme || undefined);

// Send email
await this.mailService.sendMail({
  from: 'MedVirtual <noreply@medvirtual.ai>',
  to: user.email,
  subject: 'Email Subject',
  html: emailBody,
});
```

## Error Handling

The system includes robust error handling:

1. **Database Errors**: If user lookup fails, returns `null`
2. **Missing Organization**: If user has no `organization_id`, uses MedVirtual theme
3. **Invalid Business Unit**: Falls back to MedVirtual theme
4. **Template Errors**: Graceful fallback to default colors

## Testing

### Unit Tests
Test individual theme functions:

```typescript
describe('Email Theme System', () => {
  it('should return Berry Virtual theme for Berry Virtual business unit', () => {
    const theme = getEmailThemeByBusinessUnit('Berry Virtual');
    expect(theme.primaryColor).toBe('#FD7171');
    expect(theme.companyName).toBe('Berry Virtual');
  });

  it('should return MedVirtual theme for unknown business unit', () => {
    const theme = getEmailThemeByBusinessUnit('Unknown');
    expect(theme.primaryColor).toBe('#01546B');
    expect(theme.companyName).toBe('MedVirtual');
  });
});
```

### Integration Tests
Test email generation with different user types:

```typescript
describe('Email Generation', () => {
  it('should generate Berry Virtual themed email for Berry Virtual user', async () => {
    const user = await createUser({ organization: { business_unit: 'Berry Virtual' } });
    const theme = await getUserEmailTheme(prisma, user.id);
    const email = getVerificationCodeTemplate('123456', theme);
    
    expect(email).toContain('#FD7171');
    expect(email).toContain('Berry Virtual');
  });
});
```

## Migration Guide

### From Static to Dynamic Theming

1. **Update Template Functions**: Add optional `theme` parameter
2. **Update Service Calls**: Pass theme to template functions
3. **Test Fallbacks**: Ensure MedVirtual theme works as default
4. **Update Tests**: Add theme-related test cases

### Adding New Business Units

1. **Update Theme Function**: Add new case in `getEmailThemeByBusinessUnit()`
2. **Define Color Scheme**: Add new theme object
3. **Update Documentation**: Add new theme to documentation
4. **Test Integration**: Verify emails use correct theme

## Performance Considerations

- **Database Queries**: Theme helper makes one user lookup and one organization query
- **Caching**: Consider caching user themes for high-traffic scenarios
- **Fallback Speed**: MedVirtual theme is returned immediately for users without `organization_id`

## Security Considerations

- **User Data**: Only queries user's own organizations
- **Theme Validation**: Colors are predefined, preventing injection
- **Error Handling**: Sensitive errors are logged, not exposed to users

## Troubleshooting

### Common Issues

1. **Emails Not Themed**: Check if user has `organization_id` and valid organizations
2. **Wrong Colors**: Verify `business_unit` field in organization table
3. **Template Errors**: Ensure all template functions accept optional theme parameter

### Debug Steps

1. Check user's `organization_id` in database
2. Verify organization's `business_unit` field
3. Test `getUserEmailTheme()` function directly
4. Check email template function parameters

## Future Enhancements

- **Custom Branding**: Allow organizations to upload custom logos
- **Theme Editor**: Admin interface for customizing themes
- **A/B Testing**: Support for multiple theme variants
- **Analytics**: Track email engagement by theme
