import { PrismaService } from '../../../prisma/prisma.service';
import { getEmailThemeByUserId } from './theme';

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
