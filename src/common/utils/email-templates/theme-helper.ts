import { PrismaService } from '../../../prisma/prisma.service';
import { getEmailThemeByUserId } from './theme';

export async function isUserBerryVirtual(prisma: PrismaService, userId: string): Promise<boolean> {
  try {
    const user = await prisma.uSER.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        organization_id: true,
        role: true
      }
    });

    if (!user) {
      return false;
    }

    // System users are not Berry Virtual
    if (['system_super_admin', 'system_admin'].includes(user.role)) {
      return false;
    }

    // If user doesn't have organization_id, not Berry Virtual
    if (!user.organization_id) {
      return false;
    }

    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { admin_id: userId },
          { owner_id: userId },
          { id: user.organization_id }
        ]
      },
      select: {
        business_unit: true,
        status: true
      }
    });

    // Check if any organization is Berry Virtual and active
    return organizations.some(org => 
      org.business_unit === "Berry Virtual" && org.status === 'active'
    );
  } catch (error) {
    console.error('Error checking if user is Berry Virtual:', error);
    return false;
  }
}

export async function getUserEmailTheme(prisma: PrismaService, userId: string) {
  try {
    const user = await prisma.uSER.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        organization_id: true,
        role: true
      }
    });

    if (!user) {
      return null;
    }

    // System users (system_super_admin, system_admin) always use MedVirtual theme
    if (['system_super_admin', 'system_admin'].includes(user.role)) {
      return getEmailThemeByUserId(userId, []);
    }

    // If user doesn't have organization_id, use MedVirtual theme
    if (!user.organization_id) {
      return getEmailThemeByUserId(userId, []);
    }

    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { admin_id: userId },
          { owner_id: userId },
          { id: user.organization_id }
        ]
      },
      select: {
        business_unit: true,
        status: true
      }
    });

    return getEmailThemeByUserId(userId, organizations);
  } catch (error) {
    console.error('Error getting user email theme:', error);
    return null;
  }
}
