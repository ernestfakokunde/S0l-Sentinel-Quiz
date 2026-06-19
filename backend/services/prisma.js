import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function maskDatabaseUrl(value) {
  if (!value) return 'DATABASE_URL is not set';

  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.username) url.username = `${url.username.slice(0, 2)}***`;
    return url.toString();
  } catch {
    return 'DATABASE_URL is set but could not be parsed for logging';
  }
}

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[db] Connected successfully: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    return true;
  } catch (err) {
    console.error(`[db] Connection failed: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    console.error(`[db] ${err.message}`);
    return false;
  }
}

export {
  checkDatabaseConnection,
  prisma,
};
