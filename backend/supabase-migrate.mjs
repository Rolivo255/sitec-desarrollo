#!/usr/bin/env node
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipData = args.has('--skip-data');
const bucketName = process.env.SUPABASE_BUCKET || 'portal-sitec';

const sourceConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: true } : undefined,
};

function parseConnectionString(connectionString) {
  if (!connectionString) {
    return null;
  }

  try {
    const parsed = new URL(connectionString);
    const sslmode = parsed.searchParams.get('sslmode');
    const isPooler = parsed.hostname.includes('.pooler.supabase.com');
    const ssl = (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'allow' || parsed.searchParams.get('ssl') === 'true' || parsed.hostname.includes('.supabase.co'));
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, ''),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl: ssl ? { rejectUnauthorized: true, ca: readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8') } : undefined,
    };
  } catch {
    return null;
  }
}

const poolerHost = process.env.SUPABASE_POOLER_HOST;


function normalizeConnectionString(connectionString) {
  if (!connectionString) {
    return null;
  }

  try {
    const parsed = new URL(connectionString);
    const isSupabasePooler = parsed.hostname.includes('.pooler.supabase.com') || parsed.hostname === poolerHost;

    if (poolerHost) {
      parsed.hostname = poolerHost;
    }

    if (!parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    } else if (isSupabasePooler) {
      parsed.searchParams.set('sslmode', 'require');
    }

    return parsed.toString();
  } catch {
    return connectionString;
  }
}

const targetConfig = parseConnectionString(normalizeConnectionString(process.env.SUPABASE_DB_CONNECTION_STRING)) || {
  host: process.env.SUPABASE_HOST,
  port: Number(process.env.SUPABASE_PORT || 5432),
  database: process.env.SUPABASE_DATABASE,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  ssl: process.env.SUPABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
};

if (!targetConfig.host || !targetConfig.database || !targetConfig.user || !targetConfig.password) {
  console.warn('No se encontró una configuración de destino válida para Supabase. Define SUPABASE_DB_CONNECTION_STRING o las variables SUPABASE_HOST/PORT/DB/USER/PASSWORD.');
} else if (String(targetConfig.password).includes('[YOUR-PASSWORD]')) {
  console.warn('La cadena de conexión sigue usando el marcador [YOUR-PASSWORD]. Reemplázalo por la contraseña real de la base de datos de Supabase antes de migrar.');
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function mapColumnType(column) {
  const dataType = (column.data_type || '').toLowerCase();
  const udtName = (column.udt_name || '').toLowerCase();

  if (dataType === 'character varying' || dataType === 'varchar' || dataType === 'character') {
    return column.character_maximum_length
      ? `varchar(${column.character_maximum_length})`
      : 'varchar';
  }

  if (dataType === 'numeric' || dataType === 'decimal') {
    if (column.numeric_precision != null && column.numeric_scale != null) {
      return `numeric(${column.numeric_precision},${column.numeric_scale})`;
    }
    return 'numeric';
  }

  if (dataType === 'integer' || dataType === 'int' || udtName === 'int4') {
    return 'integer';
  }

  if (dataType === 'bigint' || udtName === 'int8') {
    return 'bigint';
  }

  if (dataType === 'smallint' || udtName === 'int2') {
    return 'smallint';
  }

  if (dataType === 'double precision' || udtName === 'float8') {
    return 'double precision';
  }

  if (dataType === 'real' || udtName === 'float4') {
    return 'real';
  }

  if (dataType === 'boolean' || udtName === 'bool') {
    return 'boolean';
  }

  if (dataType === 'timestamp without time zone') {
    return 'timestamp';
  }

  if (dataType === 'timestamp with time zone') {
    return 'timestamptz';
  }

  if (dataType === 'time without time zone') {
    return 'time';
  }

  if (dataType === 'time with time zone') {
    return 'timetz';
  }

  if (dataType === 'date') {
    return 'date';
  }

  if (dataType === 'bytea') {
    return 'bytea';
  }

  if (dataType === 'jsonb') {
    return 'jsonb';
  }

  if (dataType === 'json') {
    return 'json';
  }

  if (dataType === 'text' || udtName === 'text') {
    return 'text';
  }

  if (dataType === 'array') {
    return udtName;
  }

  return udtName || dataType || 'text';
}

async function createStorageBucket() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.log('No se encontró SUPABASE_SERVICE_ROLE_KEY; se omite la creación del bucket de storage.');
    return;
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: bucketName, public: false }),
  });

  if (response.ok) {
    console.log(`Bucket de storage creado o ya existente: ${bucketName}`);
    return;
  }

  const details = await response.text();
  console.warn(`No se pudo crear el bucket ${bucketName}: ${response.status} ${details}`);
}

async function listTables(pool) {
  const { rows } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  return rows.map((row) => row.table_name);
}

async function getColumns(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return rows;
}

async function getPrimaryKeys(pool, tableName) {
  const query = `
    SELECT a.attname AS column_name
    FROM pg_index i
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    ORDER BY a.attnum
  `;

  const { rows } = await pool.query(query, [tableName]);
  return rows.map((row) => row.column_name);
}

async function tableExists(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT to_regclass($1) AS table_name`,
    [tableName]
  );
  return Boolean(rows[0]?.table_name);
}

async function getTargetColumns(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return rows.map((row) => row.column_name);
}

async function migrateTable({ sourcePool, targetPool, tableName, columns, primaryKeys }) {
  const exists = await tableExists(targetPool, tableName);

  if (!exists) {
    const columnsSql = columns.map((column) => {
      const type = mapColumnType(column);
      const isNullable = column.is_nullable === 'YES';
      const definition = `${quoteIdent(column.column_name)} ${type}${isNullable ? '' : ' NOT NULL'}`;
      return definition;
    });

    const pkClause = primaryKeys.length > 0 ? `, PRIMARY KEY (${primaryKeys.map(quoteIdent).join(', ')})` : '';
    const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (${columnsSql.join(', ')}${pkClause})`;

    console.log(`Creando tabla ${tableName}`);
    await targetPool.query(createSql);
  } else {
    console.log(`Usando tabla existente ${tableName}`);
  }

  if (skipData) {
    return;
  }

  const selectSql = `SELECT * FROM ${quoteIdent(tableName)}`;
  const sourceColumns = columns.map((column) => column.column_name);
  const targetColumns = await getTargetColumns(targetPool, tableName);
  const insertColumns = sourceColumns.filter((columnName) => targetColumns.includes(columnName));

  if (insertColumns.length === 0) {
    console.log(`No hay columnas compatibles para migrar en ${tableName}`);
    return;
  }

  const selectRows = await sourcePool.query(selectSql);

  if (selectRows.rows.length === 0) {
    return;
  }

  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
  const conflictClause = primaryKeys.length > 0 && primaryKeys.every((key) => insertColumns.includes(key))
    ? ` ON CONFLICT (${primaryKeys.map(quoteIdent).join(', ')}) DO NOTHING`
    : '';
  const insertSql = `INSERT INTO ${quoteIdent(tableName)} (${insertColumns.map(quoteIdent).join(', ')}) VALUES (${placeholders})${conflictClause}`;

  let inserted = 0;
  for (const row of selectRows.rows) {
    const values = insertColumns.map((name) => row[name]);
    try {
      await targetPool.query(insertSql, values);
      inserted += 1;
    } catch (error) {
      const message = error?.message || '';
      if (message.includes('duplicate') || message.includes('already exists') || message.includes('violates unique')) {
        continue;
      }
      throw error;
    }
  }

  console.log(`Migradas ${inserted} filas de ${tableName}`);
}

async function main() {
  const sourcePool = new Pool(sourceConfig);
  const targetPool = new Pool(targetConfig);

  try {
    await sourcePool.query('SELECT 1');
    await targetPool.query('SELECT 1');
  } catch (error) {
    console.error('No fue posible conectar a la base de datos fuente o destino.', error);
    process.exitCode = 1;
    return;
  }

  try {
    console.log('Conexión verificada.');

    if (!dryRun) {
      await createStorageBucket();
    }

    const tables = await listTables(sourcePool);
    console.log(`Tablas encontradas en PostgreSQL local: ${tables.length}`);

    if (dryRun) {
      console.log('Modo dry-run: no se migra nada.');
      console.log(tables.slice(0, 20).join(', '));
      return;
    }

    for (const tableName of tables) {
      const columns = await getColumns(sourcePool, tableName);
      const primaryKeys = await getPrimaryKeys(sourcePool, tableName);
      await migrateTable({ sourcePool, targetPool, tableName, columns, primaryKeys });
    }

    console.log('Migración finalizada.');
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
