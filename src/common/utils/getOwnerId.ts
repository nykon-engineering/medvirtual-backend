export async function getOwnerId(userId: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.uSER.findUnique({
    where: { id: userId },
    select: {
        id: true,
        hubspot_id: true,
        first_name: true,
        last_name: true,
        email: true,
    },
        
    });

    /* => Commented because we cannot create owners using hubspot API
    if (user && !user.hubspot_id) {
    await this.ownerCreationService.execute(user)
    }
    */

    return user && user.hubspot_id ? user.hubspot_id : null; 
}