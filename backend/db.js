import pg from 'pg';
import sql from 'mssql';
import * as dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

const rawConnectionString = process.env.SUPABASE_DB_CONNECTION_STRING || process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
const connectionString = rawConnectionString;
if (!connectionString && !process.env.PGHOST) {
  throw new Error('Configura SUPABASE_DB_CONNECTION_STRING o PGHOST antes de iniciar el backend.');
}
const remote = connectionString ? new URL(connectionString).hostname !== 'localhost' : process.env.PGHOST !== 'localhost';
export const pool = new Pool({
  ...(connectionString ? { connectionString } : {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  }),
  ssl: remote ? {
    rejectUnauthorized: true,
    ca: readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8'),
  } : undefined,
  max: Number(process.env.PGPOOL_MAX || 3),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: true,
});
export const getDatabaseConnectionInfo = () => ({
  host: connectionString ? new URL(connectionString).hostname : process.env.PGHOST,
  usingPooler: Boolean(connectionString?.includes('.pooler.supabase.com')),
});

const SQLSERVER_ENABLED = String(process.env.SQLSERVER_ENABLED || 'false').toLowerCase() === 'true';

const SQLSERVER_CONFIG = {
  server: process.env.SQLSERVER_HOST || 'localhost',
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DATABASE || 'master',
  user: process.env.SQLSERVER_USER || 'sa',
  password: process.env.SQLSERVER_PASSWORD || '',
  options: {
    encrypt: String(process.env.SQLSERVER_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.SQLSERVER_TRUST_CERT || 'true').toLowerCase() === 'true',
  },
  pool: {
    max: Number(process.env.SQLSERVER_POOL_MAX || 10),
    min: Number(process.env.SQLSERVER_POOL_MIN || 0),
    idleTimeoutMillis: Number(process.env.SQLSERVER_POOL_IDLE_MS || 30000),
  },
};

let sqlServerPoolPromise = null;

export const isSqlServerEnabled = () => SQLSERVER_ENABLED;

export const getSqlServerPool = async () => {
  if (!SQLSERVER_ENABLED) {
    throw new Error('SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true para activarlo.');
  }

  if (!sqlServerPoolPromise) {
    sqlServerPoolPromise = sql.connect(SQLSERVER_CONFIG);
  }

  return sqlServerPoolPromise;
};

export const checkPostgresConnection = async () => {
  await pool.query('SELECT 1');
  return { ok: true };
};

export const checkSqlServerConnection = async () => {
  if (!SQLSERVER_ENABLED) {
    return { ok: true, enabled: false, message: 'SQL Server deshabilitado por configuracion' };
  }

  const sqlPool = await getSqlServerPool();
  await sqlPool.request().query('SELECT 1 AS ok');
  return { ok: true, enabled: true };
};

