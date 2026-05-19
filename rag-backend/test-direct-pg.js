require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const result = await client.query('SELECT 1');
    console.log('✅ Query successful:', result.rows);

    await client.end();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
