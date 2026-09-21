import { PrismaClient } from '@prisma/client';

// singleton — กัน connection รั่วตอน dev --watch
const g = globalThis;
export const prisma = g.__prisma ?? new PrismaClient();
if (!g.__prisma) g.__prisma = prisma;
