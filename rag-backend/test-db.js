require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        const adapter = new PrismaPg(pool);
        const prisma = new PrismaClient({ adapter });

        const count = await prisma.user.count();
        console.log('✅ Database connected! User count:', count);

        await prisma.$disconnect();
        await pool.end();
    } catch (e) {
        console.error('❌ Database error:', e.message);
        process.exit(1);
    }
}

main();