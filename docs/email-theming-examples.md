# Email Theming System - Usage Examples

## Basic Usage

### 1. Getting User Theme

```typescript
import { getUserEmailTheme, isUserBerryVirtual } from '../common/utils/email-templates/theme-helper';

// In your service
const emailTheme = await getUserEmailTheme(this.prisma, userId);
const isBerryVirtual = await isUserBerryVirtual(this.prisma, userId);
```

### 2. Using in Email Templates

```typescript
import getVerificationCodeTemplate from '../common/utils/email-templates/verification-code';

// Generate verification URL with Berry Virtual parameter
const verificationUrl = `${process.env.FRONTEND_URL}/signup/verification-code?t=${code}&berry=${isBerryVirtual ? 'true' : 'false'}`;

// Generate themed email with Berry Virtual indicator and verification URL
const emailBody = getVerificationCodeTemplate(code, emailTheme || undefined, isBerryVirtual, verificationUrl);
```

## Service Integration Examples

### AuthService Example

```typescript
// In signUp method
const emailTheme = await getUserEmailTheme(this.prisma, newUser.id);
const isBerryVirtual = await isUserBerryVirtual(this.prisma, newUser.id);

// Generate verification URL with Berry Virtual parameter
const verificationUrl = `${process.env.FRONTEND_URL}/signup/verification-code?t=${code}&berry=${isBerryVirtual ? 'true' : 'false'}`;

const emailBody = getVerificationCodeTemplate(code, emailTheme || undefined, isBerryVirtual, verificationUrl);

await this.mailService.sendMail({
  from: 'MedVirtual <noreply@medvirtual.ai>',
  to: data.email,
  subject: 'Verification Code',
  html: emailBody,
});
```

### NotificationsService Example

```typescript
// In notification method
const emailTheme = await getUserEmailTheme(this.prisma, user.id);

const html = this.buildEmail(
  `<h2>Notification Title</h2>
   <p>Notification content...</p>
   <a href="${url}" style="background-color: ${emailTheme?.primaryColor || '#01546B'};">
     Action Button
   </a>`,
  emailTheme
);
```

## Creating Custom Templates

### Template Structure

```typescript
import { getEmailHeader, getEmailFooter } from './components';
import { EmailTheme } from './theme';

export function myCustomTemplate(data: any, theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${companyName} - Custom Email</title>
      <style>
        .button {
          background-color: ${primaryColor};
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
        }
        .button:hover {
          background-color: ${primaryColorHover};
        }
        .link {
          color: ${primaryColor};
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${getEmailHeader(theme)}
        
        <div class="content">
          <h2>Welcome to ${companyName}</h2>
          <p>Your data: ${data}</p>
          <a href="#" class="button">Action Button</a>
          <p><a href="#" class="link">Learn More</a></p>
        </div>
        
        ${getEmailFooter(theme)}
      </div>
    </body>
    </html>
  `;
}
```

### Using Custom Template

```typescript
// In your service
const emailTheme = await getUserEmailTheme(this.prisma, userId);
const emailBody = myCustomTemplate(userData, emailTheme || undefined);

await this.mailService.sendMail({
  from: 'MedVirtual <noreply@medvirtual.ai>',
  to: user.email,
  subject: 'Custom Email Subject',
  html: emailBody,
});
```

## Theme Testing Examples

### Unit Tests

```typescript
import { getEmailThemeByBusinessUnit } from './theme';

describe('Email Theme System', () => {
  describe('getEmailThemeByBusinessUnit', () => {
    it('should return Berry Virtual theme for Berry Virtual business unit', () => {
      const theme = getEmailThemeByBusinessUnit('Berry Virtual');
      
      expect(theme.primaryColor).toBe('#FD7171');
      expect(theme.primaryColorHover).toBe('#E55A5A');
      expect(theme.companyName).toBe('Berry Virtual');
    });

    it('should return MedVirtual theme for MedVirtual business unit', () => {
      const theme = getEmailThemeByBusinessUnit('MedVirtual');
      
      expect(theme.primaryColor).toBe('#01546B');
      expect(theme.primaryColorHover).toBe('#013A4F');
      expect(theme.companyName).toBe('MedVirtual');
    });

    it('should return MedVirtual theme for unknown business unit', () => {
      const theme = getEmailThemeByBusinessUnit('Unknown');
      
      expect(theme.primaryColor).toBe('#01546B');
      expect(theme.companyName).toBe('MedVirtual');
    });

    it('should return MedVirtual theme for null business unit', () => {
      const theme = getEmailThemeByBusinessUnit(null);
      
      expect(theme.primaryColor).toBe('#01546B');
      expect(theme.companyName).toBe('MedVirtual');
    });
  });
});
```

### Integration Tests

```typescript
import { getUserEmailTheme } from './theme-helper';

describe('getUserEmailTheme', () => {
  it('should return MedVirtual theme for user without organization_id', async () => {
    const user = await createUser({ organization_id: null });
    const theme = await getUserEmailTheme(prisma, user.id);
    
    expect(theme?.primaryColor).toBe('#01546B');
    expect(theme?.companyName).toBe('MedVirtual');
  });

  it('should return MedVirtual theme for system users', async () => {
    const user = await createUser({ role: 'system_super_admin' });
    const theme = await getUserEmailTheme(prisma, user.id);
    
    expect(theme?.primaryColor).toBe('#01546B');
    expect(theme?.companyName).toBe('MedVirtual');
  });

  it('should return MedVirtual theme for system admin users', async () => {
    const user = await createUser({ role: 'system_admin' });
    const theme = await getUserEmailTheme(prisma, user.id);
    
    expect(theme?.primaryColor).toBe('#01546B');
    expect(theme?.companyName).toBe('MedVirtual');
  });

  it('should return Berry Virtual theme for Berry Virtual user', async () => {
    const organization = await createOrganization({ business_unit: 'Berry Virtual' });
    const user = await createUser({ organization_id: organization.id });
    const theme = await getUserEmailTheme(prisma, user.id);
    
    expect(theme?.primaryColor).toBe('#FD7171');
    expect(theme?.companyName).toBe('Berry Virtual');
  });

  it('should prioritize Berry Virtual over other organizations', async () => {
    const berryOrg = await createOrganization({ business_unit: 'Berry Virtual' });
    const medOrg = await createOrganization({ business_unit: 'MedVirtual' });
    const user = await createUser({ 
      organization_id: medOrg.id,
      adminOrganizations: { connect: { id: berryOrg.id } }
    });
    
    const theme = await getUserEmailTheme(prisma, user.id);
    
    expect(theme?.primaryColor).toBe('#FD7171');
    expect(theme?.companyName).toBe('Berry Virtual');
  });

  it('should return true for Berry Virtual user', async () => {
    const organization = await createOrganization({ business_unit: 'Berry Virtual' });
    const user = await createUser({ organization_id: organization.id });
    
    const isBerryVirtual = await isUserBerryVirtual(prisma, user.id);
    
    expect(isBerryVirtual).toBe(true);
  });

  it('should return false for non-Berry Virtual user', async () => {
    const organization = await createOrganization({ business_unit: 'MedVirtual' });
    const user = await createUser({ organization_id: organization.id });
    
    const isBerryVirtual = await isUserBerryVirtual(prisma, user.id);
    
    expect(isBerryVirtual).toBe(false);
  });

  it('should return false for system users', async () => {
    const user = await createUser({ role: 'system_super_admin' });
    
    const isBerryVirtual = await isUserBerryVirtual(prisma, user.id);
    
    expect(isBerryVirtual).toBe(false);
  });
});
```

## Error Handling Examples

### Graceful Fallback

```typescript
try {
  const emailTheme = await getUserEmailTheme(this.prisma, userId);
  const emailBody = getVerificationCodeTemplate(code, emailTheme || undefined);
  
  await this.mailService.sendMail({
    from: 'MedVirtual <noreply@medvirtual.ai>',
    to: user.email,
    subject: 'Verification Code',
    html: emailBody,
  });
} catch (error) {
  // Fallback to default theme
  const emailBody = getVerificationCodeTemplate(code);
  
  await this.mailService.sendMail({
    from: 'MedVirtual <noreply@medvirtual.ai>',
    to: user.email,
    subject: 'Verification Code',
    html: emailBody,
  });
}
```

### Logging for Debugging

```typescript
const emailTheme = await getUserEmailTheme(this.prisma, userId);

if (!emailTheme) {
  console.warn(`No theme found for user ${userId}, using MedVirtual default`);
}

console.log(`Using theme for user ${userId}:`, {
  primaryColor: emailTheme?.primaryColor,
  companyName: emailTheme?.companyName
});
```

## Performance Optimization

### Caching User Themes

```typescript
// Simple in-memory cache (for development)
const themeCache = new Map<string, EmailTheme>();

export async function getUserEmailThemeCached(prisma: PrismaService, userId: string) {
  if (themeCache.has(userId)) {
    return themeCache.get(userId);
  }

  const theme = await getUserEmailTheme(prisma, userId);
  if (theme) {
    themeCache.set(userId, theme);
  }
  
  return theme;
}
```

### Batch Theme Loading

```typescript
export async function getMultipleUserThemes(prisma: PrismaService, userIds: string[]) {
  const users = await prisma.uSER.findMany({
    where: { id: { in: userIds } },
    select: { id: true, organization_id: true }
  });

  const organizationIds = users
    .map(u => u.organization_id)
    .filter(Boolean);

  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { id: { in: organizationIds } },
        { admin_id: { in: userIds } },
        { owner_id: { in: userIds } }
      ]
    },
    select: { business_unit: true, status: true, admin_id: true, owner_id: true, id: true }
  });

  return userIds.map(userId => {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    if (!user.organization_id) {
      return getEmailThemeByUserId(userId, []);
    }

    const userOrgs = organizations.filter(org => 
      org.admin_id === userId || org.owner_id === userId || org.id === user.organization_id
    );

    return getEmailThemeByUserId(userId, userOrgs);
  });
}
```
