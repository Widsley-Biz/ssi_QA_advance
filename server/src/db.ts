import pg from 'pg';

const { Pool } = pg;

// Cloud Run: connects via the Cloud SQL Unix socket mounted at
// /cloudsql/<INSTANCE_CONNECTION_NAME> when --add-cloudsql-instances is set.
// Local dev: connects via Cloud SQL Auth Proxy on 127.0.0.1 (PGHOST/PGPORT).
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

export const pool = new Pool(
  instanceConnectionName
    ? {
        host: `/cloudsql/${instanceConnectionName}`,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
    : {
        host: process.env.PGHOST ?? '127.0.0.1',
        port: process.env.PGPORT ? Number(process.env.PGPORT) : 5433,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
);
