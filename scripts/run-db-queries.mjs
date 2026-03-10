import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch (_) {}

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Missing DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL in .env.local');
  console.error('Get it from: Supabase Dashboard > Settings > Database > Connection string (URI)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const queries = [
  { name: '1. Schema', sql: `SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position` },
  { name: '2. Foreign keys', sql: `SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'` },
  { name: '3. Row counts', sql: `SELECT tablename, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC` },
  { name: '4. Sample rounds', sql: `SELECT * FROM rounds ORDER BY id DESC LIMIT 5` },
  { name: '5. Sample league_matches', sql: `SELECT * FROM league_matches LIMIT 5` }
];

async function run() {
  await client.connect();
  for (const q of queries) {
    console.log('\n=== ' + q.name + ' ===\n');
    const r = await client.query(q.sql);
    console.log(JSON.stringify(r.rows, null, 2));
  }
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
