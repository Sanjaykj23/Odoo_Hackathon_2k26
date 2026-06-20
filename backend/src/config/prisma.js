import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

// Gracefully connect to the database on boot
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to PostgreSQL database via Prisma.');
  })
  .catch((err) => {
    console.warn('Prisma failed to connect to PostgreSQL database on boot:', err.message);
    console.warn('Server will continue running. Ensure PostgreSQL is active and DATABASE_URL is correct.');
  });

export default prisma;
