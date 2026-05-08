"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
console.log('invoiceConfiguration' in prisma);
prisma.$disconnect();
//# sourceMappingURL=test-prisma.js.map