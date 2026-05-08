import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
console.log('invoiceConfiguration' in prisma);
prisma.$disconnect();
