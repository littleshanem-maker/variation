const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.ketidyzumcdxditjfruk.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTcyMTk1MSwiZXhwIjoyMDg3Mjk3OTUxfQ.qQku9uj7RhKZvkE1JtPx1eWu0FiNmFnyAZmvQCRj_cQ',
  ssl: { rejectUnauthorized: false }
});

const sql = `
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'variations'
AND schemaname = 'public'
`;

pool.query(sql, [])
  .then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
    pool.end();
  })
  .catch(e => {
    console.error(e.message);
    pool.end();
  });