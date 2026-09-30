import express from 'express';
import * as dotenv from 'dotenv';
import { checkPostgresConnection, checkSqlServerConnection, getSqlServerPool, isSqlServerEnabled, pool, getDatabaseConnectionInfo } from './db.js';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.BACKEND_PORT || 4000);

app.use(express.json({ limit: '20mb' }));

const ensureDescuentosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents_discount_nomina (
      id BIGSERIAL PRIMARY KEY,
      periodo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      valor NUMERIC(18,4) NOT NULL,
      codigo_centro_costo TEXT NOT NULL DEFAULT '',
      centro_costo TEXT NOT NULL,
      observacion TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'pendiente revision',
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_incidents_discount_nomina_periodo_format
        CHECK (periodo ~ '^[0-9]{4}-[0-9]{2}$')
    )
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS estado TEXT
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS codigo_centro_costo TEXT
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS observacion TEXT
  `);

  await pool.query(`
    UPDATE incidents_discount_nomina
    SET codigo_centro_costo = ''
    WHERE codigo_centro_costo IS NULL
  `);

  await pool.query(`
    UPDATE incidents_discount_nomina
    SET observacion = ''
    WHERE observacion IS NULL
  `);

  await pool.query(`
    UPDATE incidents_discount_nomina
    SET estado = 'pendiente revision'
    WHERE estado IS NULL
      OR TRIM(estado) = ''
      OR LOWER(TRIM(estado)) IN ('pendiente', 'pendiente revision')
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN estado SET DEFAULT 'pendiente revision'
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN estado SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN codigo_centro_costo SET DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN codigo_centro_costo SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN observacion SET DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE incidents_discount_nomina
    ALTER COLUMN observacion SET NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_incidents_discount_nomina_periodo
      ON incidents_discount_nomina (periodo DESC, fecha_creacion DESC)
  `);
};

const ensureExentosPagoSeguroTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS humana_exentos_pago_seguro (
      id BIGSERIAL PRIMARY KEY,
      cedula TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      porcentaje_exento NUMERIC(5,2) NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_humana_exentos_porcentaje_rango
        CHECK (porcentaje_exento >= 0 AND porcentaje_exento <= 100)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_humana_exentos_pago_seguro_nombre
      ON humana_exentos_pago_seguro (nombre)
  `);
};

const ensureValetFijoEmpleadoTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS valet_fijo_empleado (
      id BIGSERIAL PRIMARY KEY,
      centro_costo_id TEXT NOT NULL,
      centro_costo_nombre TEXT NOT NULL DEFAULT '',
      empleado_cedula TEXT NOT NULL,
      empleado_nombre TEXT NOT NULL DEFAULT '',
      valor_fijo NUMERIC(18,2) NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_valet_fijo_empleado UNIQUE (centro_costo_id, empleado_cedula),
      CONSTRAINT chk_valet_fijo_empleado_valor_fijo_positivo CHECK (valor_fijo >= 0)
    )
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_empleado
    DROP CONSTRAINT IF EXISTS chk_valet_fijo_empleado_valor_fijo_positivo
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_empleado
    ADD CONSTRAINT chk_valet_fijo_empleado_valor_fijo_positivo CHECK (valor_fijo >= 0)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_empleado_centro
      ON valet_fijo_empleado (centro_costo_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_empleado_cedula
      ON valet_fijo_empleado (empleado_cedula)
  `);
};

const ensureValetFijoHorarioTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS valet_fijo_horario (
      id BIGSERIAL PRIMARY KEY,
      centro_costo_id TEXT NOT NULL,
      centro_costo_nombre TEXT NOT NULL DEFAULT '',
      empleado_cedula TEXT NOT NULL,
      empleado_nombre TEXT NOT NULL DEFAULT '',
      fecha_turno DATE NOT NULL,
      hora_entrada TEXT NOT NULL,
      hora_salida TEXT NOT NULL,
      es_adicional BOOLEAN NOT NULL DEFAULT FALSE,
      aprobado BOOLEAN NOT NULL DEFAULT TRUE,
      recurrencia BOOLEAN NOT NULL DEFAULT FALSE,
      fin_recurrencia DATE,
      observacion TEXT NOT NULL DEFAULT '',
      evidencia_blob BYTEA,
      evidencia_mime_type TEXT NOT NULL DEFAULT '',
      evidencia_nombre_archivo TEXT NOT NULL DEFAULT '',
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_valet_fijo_horario UNIQUE (centro_costo_id, empleado_cedula, fecha_turno, hora_entrada, hora_salida)
    )
  `);

  // Compatibilidad con esquemas previos: agrega columnas faltantes y migra fecha_turno.
  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS centro_costo_nombre TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS empleado_nombre TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_turno DATE
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS aprobado BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'valet_fijo_horario' AND column_name = 'anio'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'valet_fijo_horario' AND column_name = 'mes'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'valet_fijo_horario' AND column_name = 'dia'
      ) THEN
        UPDATE valet_fijo_horario
        SET fecha_turno = make_date(
          CASE
            WHEN COALESCE(anio::text, '') ~ '^\\d{4}$' THEN anio::int
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int
          END,
          GREATEST(1, LEAST(12,
            CASE WHEN COALESCE(mes::text, '') ~ '^\\d{1,2}$' THEN mes::int ELSE 1 END
          )),
          GREATEST(1, LEAST(31,
            CASE WHEN COALESCE(dia::text, '') ~ '^\\d{1,2}$' THEN dia::int ELSE 1 END
          ))
        )
        WHERE fecha_turno IS NULL;
      END IF;
    END $$
  `);

  await pool.query(`
    UPDATE valet_fijo_horario
    SET fecha_turno = CURRENT_DATE
    WHERE fecha_turno IS NULL
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    DROP COLUMN IF EXISTS anio,
    DROP COLUMN IF EXISTS mes,
    DROP COLUMN IF EXISTS semana,
    DROP COLUMN IF EXISTS dia
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ALTER COLUMN fecha_turno SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    DROP CONSTRAINT IF EXISTS uq_valet_fijo_horario
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD CONSTRAINT uq_valet_fijo_horario UNIQUE (centro_costo_id, empleado_cedula, fecha_turno, hora_entrada, hora_salida)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_centro
      ON valet_fijo_horario (centro_costo_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_empleado
      ON valet_fijo_horario (empleado_cedula)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_fecha_turno
      ON valet_fijo_horario (fecha_turno)
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS recurrencia BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fin_recurrencia DATE
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS observacion TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_blob BYTEA
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_mime_type TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_nombre_archivo TEXT NOT NULL DEFAULT ''
  `);
};

const ensureValetFijoCentroTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS valet_fijo_centro (
      id BIGSERIAL PRIMARY KEY,
      centro_costo_id TEXT NOT NULL,
      centro_costo_nombre TEXT NOT NULL DEFAULT '',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_valet_fijo_centro UNIQUE (centro_costo_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_centro_activo
      ON valet_fijo_centro (activo)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_centro_nombre
      ON valet_fijo_centro (centro_costo_nombre)
  `);
};

const ensureValetFijoConfiguracionTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS valet_fijo_configuracion (
      id BIGSERIAL PRIMARY KEY,
      centro_costo_id TEXT NOT NULL,
      horas_normal_limite NUMERIC(10,2) NOT NULL DEFAULT 40,
      valor_normal NUMERIC(18,2) NOT NULL DEFAULT 3.50,
      valor_adicional NUMERIC(18,2) NOT NULL DEFAULT 3.00,
      valor_domingo NUMERIC(18,2) NOT NULL DEFAULT 10.00,
      valor_domingo_adicional NUMERIC(18,2) NOT NULL DEFAULT 15.00,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_valet_fijo_configuracion UNIQUE (centro_costo_id),
      CONSTRAINT chk_valet_fijo_config_horas_normal CHECK (horas_normal_limite >= 0),
      CONSTRAINT chk_valet_fijo_config_valor_normal CHECK (valor_normal >= 0),
      CONSTRAINT chk_valet_fijo_config_valor_adicional CHECK (valor_adicional >= 0),
      CONSTRAINT chk_valet_fijo_config_valor_domingo CHECK (valor_domingo >= 0),
      CONSTRAINT chk_valet_fijo_config_valor_domingo_adicional CHECK (valor_domingo_adicional >= 0)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valet_fijo_configuracion_centro
      ON valet_fijo_configuracion (centro_costo_id)
  `);
};

const ensureDistribucionPlantillasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS distribucion_plantilla (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      centros JSONB NOT NULL DEFAULT '[]'::jsonb,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_distribucion_plantilla_nombre
      ON distribucion_plantilla (nombre)
  `);
};

const ensureEmpleadoDistribucionPlantillaTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleado_distribucion_plantilla (
      id BIGSERIAL PRIMARY KEY,
      plantilla_id BIGINT NOT NULL REFERENCES distribucion_plantilla(id) ON DELETE CASCADE,
      empleado_id TEXT NOT NULL UNIQUE,
      empleado_documento TEXT NOT NULL DEFAULT '',
      empleado_nombre_completo TEXT NOT NULL DEFAULT '',
      fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE empleado_distribucion_plantilla
    ADD COLUMN IF NOT EXISTS fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE empleado_distribucion_plantilla
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_empleado_distribucion_plantilla_plantilla
      ON empleado_distribucion_plantilla (plantilla_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_empleado_distribucion_plantilla_empleado
      ON empleado_distribucion_plantilla (empleado_id)
  `);
};

const ensureHumanaCedulaColumn = async () => {
  await pool.query(`
    ALTER TABLE medic_secure_humana
    ADD COLUMN IF NOT EXISTS cedula TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_medic_secure_humana_cedula
      ON medic_secure_humana (anio, mes, cedula)
  `);
};

const getPeriodoActual = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const parseValor = (valor) => {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : NaN;
  }

  if (typeof valor === 'string') {
    const normalized = valor.replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  return NaN;
};

const parseCentroCostoCompuesto = (valor) => {
  const raw = String(valor || '').trim();
  if (!raw) {
    return { codigoCentroCosto: '', centroCosto: '' };
  }

  const match = raw.match(/^([^\-]+?)\s*-\s*(.+)$/);
  if (!match) {
    return { codigoCentroCosto: '', centroCosto: raw };
  }

  return {
    codigoCentroCosto: String(match[1] || '').trim(),
    centroCosto: String(match[2] || '').trim(),
  };
};

const mapDbRowToDescuento = (row) => ({
  id: Number(row.id),
  periodo: String(row.periodo || ''),
  nombre: String(row.nombre || ''),
  valor: Number(row.valor || 0),
  codigo_centro_costo: String(row.codigo_centro_costo || ''),
  centro_costo: String(row.centro_costo || ''),
  observacion: String(row.observacion || ''),
  estado: String(row.estado || 'pendiente revision'),
  recurrencia: Number(row.recurrencia || 1),
  fecha_creacion: row.fecha_creacion,
});

const mapDbRowToExentoPagoSeguro = (row) => ({
  id: Number(row.id),
  cedula: String(row.cedula || ''),
  nombre: String(row.nombre || ''),
  porcentaje_exento: Number(row.porcentaje_exento || 0),
  fecha_creacion: row.fecha_creacion,
  fecha_actualizacion: row.fecha_actualizacion,
});

const formatoFechaIso = (date) => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseFechaIso = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [y, m, d] = raw.split('-').map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) return null;
  return date;
};

const parseHora24AMinutos = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;

  const [h, m] = raw.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return (h * 60) + m;
};

const horariosSeSolapan = (inicioA, finA, inicioB, finB) => {
  return inicioA < finB && inicioB < finA;
};

const mapDbRowToValetFijoEmpleado = (row) => ({
  id: `${String(row.centro_costo_id || '')}-${String(row.empleado_cedula || '')}`,
  centroCostoId: String(row.centro_costo_id || ''),
  centroCostoNombre: String(row.centro_costo_nombre || ''),
  empleadoCedula: String(row.empleado_cedula || ''),
  empleadoNombre: String(row.empleado_nombre || ''),
  valorFijo: Number(row.valor_fijo || 0),
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion,
});

const mapDbRowToValetFijoHorario = (row) => ({
  id: String(row.id || ''),
  centroCostoId: String(row.centro_costo_id || ''),
  centroCostoNombre: String(row.centro_costo_nombre || ''),
  empleadoCedula: String(row.empleado_cedula || ''),
  empleadoNombre: String(row.empleado_nombre || ''),
  fechaTurno: row.fecha_turno ? formatoFechaIso(new Date(row.fecha_turno)) : '',
  horaEntrada: String(row.hora_entrada || ''),
  horaSalida: String(row.hora_salida || ''),
  esAdicional: Boolean(row.es_adicional),
  aprobado: row.aprobado === null || row.aprobado === undefined ? true : Boolean(row.aprobado),
  recurrencia: Boolean(row.recurrencia ?? false),
  finRecurrencia: row.fin_recurrencia ? formatoFechaIso(new Date(row.fin_recurrencia)) : '',
  observacion: String(row.observacion || ''),
  evidenciaMimeType: String(row.evidencia_mime_type || ''),
  evidenciaNombreArchivo: String(row.evidencia_nombre_archivo || ''),
  evidenciaBase64: row.evidencia_blob ? Buffer.from(row.evidencia_blob).toString('base64') : '',
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion,
});

const mapDbRowToValetFijoCentro = (row) => ({
  id: Number(row.id || 0),
  centroCostoId: String(row.centro_costo_id || ''),
  centroCostoNombre: String(row.centro_costo_nombre || ''),
  activo: Boolean(row.activo),
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion,
});

const mapDbRowToValetFijoConfiguracion = (row) => ({
  id: Number(row.id || 0),
  centroCostoId: String(row.centro_costo_id || ''),
  horasNormalLimite: Number(row.horas_normal_limite || 0),
  valorNormal: Number(row.valor_normal || 0),
  valorAdicional: Number(row.valor_adicional || 0),
  valorDomingo: Number(row.valor_domingo || 0),
  valorDomingoAdicional: Number(row.valor_domingo_adicional || 0),
  metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion,
});

const mapDbRowToDistribucionPlantilla = (row) => {
  const centrosRaw = Array.isArray(row.centros) ? row.centros : [];

  return {
    id: Number(row.id || 0),
    nombre: String(row.nombre || '').trim(),
    centros: centrosRaw.map((centro) => ({
      centroCostoId: String(centro?.centroCostoId || centro?.centro_costo_id || '').trim(),
      centroCostoNombre: String(centro?.centroCostoNombre || centro?.centro_costo_nombre || '').trim(),
      porcentaje: Number(centro?.porcentaje || 0),
    })),
    totalEmpleados: Number(row.total_empleados || 0),
    fechaCreacion: row.fecha_creacion,
    fechaActualizacion: row.fecha_actualizacion,
  };
};

const separarApellidosYNombres = (nombreCompleto) => {
  const partes = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    return { apellidos: '', nombres: '' };
  }

  if (partes.length === 1) {
    return { apellidos: partes[0], nombres: '' };
  }

  if (partes.length === 2) {
    return { apellidos: partes[0], nombres: partes[1] };
  }

  return {
    apellidos: partes.slice(0, 2).join(' '),
    nombres: partes.slice(2).join(' '),
  };
};

const mapDbRowToEmpleado = (row) => ({
  ...separarApellidosYNombres(row.empleado),
  cedula: String(row.cedula || ''),
  centroCosto: String(row.centro || ''),
  fechaNacimiento: '',
  estadoCivil: '',
  tarifa: String(row.tarifa || ''),
  parentesco: '',
  genero: '',
  fechaSolicitud: '',
  fechaInclusion: String(row.f_ingreso || ''),
  fechaExclusion: String(row.f_exclusion || ''),
  plan: String(row.plan || ''),
  cobertura: 0,
  prima: Number(row.prima || 0),
  ajuste: Number(row.ajuste || 0),
  humanaAssist: Number(row.assist || 0),
  seguroCampesino: Number(row.seguro || 0),
  urbapark: Number(row.urbapark || 0),
  sssCampesino: 0,
  totalUrbapark: 0,
  trabajador: Number(row.trabajador_rol || 0),
  total: 0,
  diferencia: 0,
});

app.get('/health', async (_req, res) => {
  try {
    await checkPostgresConnection();
    res.status(200).json({ ok: true, service: 'humana-backend' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/health/databases', async (_req, res) => {
  const status = {
    postgresql: { ok: false },
    sqlserver: { ok: false, enabled: isSqlServerEnabled() },
  };

  try {
    await checkPostgresConnection();
    status.postgresql = { ok: true };
  } catch (error) {
    status.postgresql = {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  try {
    const sqlStatus = await checkSqlServerConnection();
    status.sqlserver = {
      ...status.sqlserver,
      ...sqlStatus,
    };
  } catch (error) {
    status.sqlserver = {
      ...status.sqlserver,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const ok = status.postgresql.ok && (status.sqlserver.ok || status.sqlserver.enabled === false);
  res.status(ok ? 200 : 500).json({ ok, service: 'humana-backend', databases: status });
});

app.get('/api/contabilidad/pyg/configuracion-cuenta', async (req, res) => {
  const codigoCuenta = String(req.query.codigoCuenta || '').trim();

  if (!isSqlServerEnabled()) {
    res.status(503).json({ error: 'SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true' });
    return;
  }

  if (!codigoCuenta) {
    res.status(400).json({ error: 'El parametro codigoCuenta es requerido' });
    return;
  }

  try {
    const sqlServerPool = await getSqlServerPool();

    const result = await sqlServerPool
      .request()
      .input('codigo_cuenta', codigoCuenta)
      .query(`
        SELECT TOP (1)
          CAST([codigoAgrupacion] AS varchar(50)) AS codigoAgrupacion,
          CAST([nombreAgrupacion] AS varchar(255)) AS nombreAgrupacion,
          CAST([codigoGrupoCuenta] AS varchar(50)) AS codigoGrupoCuenta,
          CAST([nombreGrupoCuenta] AS varchar(255)) AS nombreGrupoCuenta,
          CAST([codigoCuenta] AS varchar(50)) AS codigoCuenta,
          CAST([nombreCuenta] AS varchar(255)) AS nombreCuenta
        FROM [BONES].[dbo].[cuentaConfiguracionGrupoCC]
        WHERE CAST([codigoCuenta] AS varchar(50)) = @codigo_cuenta
      `);

    const row = Array.isArray(result.recordset) && result.recordset.length > 0
      ? result.recordset[0]
      : null;

    const configuracion = row
      ? {
          codigoAgrupacion: String(row.codigoAgrupacion || '').trim(),
          nombreAgrupacion: String(row.nombreAgrupacion || '').trim(),
          codigoGrupoCuenta: String(row.codigoGrupoCuenta || '').trim(),
          nombreGrupoCuenta: String(row.nombreGrupoCuenta || '').trim(),
          codigoCuenta: String(row.codigoCuenta || '').trim(),
          nombreCuenta: String(row.nombreCuenta || '').trim(),
        }
      : null;

    console.log('[GET /api/contabilidad/pyg/configuracion-cuenta] configuracion cargada', {
      codigoCuenta,
      encontrada: Boolean(configuracion),
    });

    res.status(200).json({ ok: true, codigoCuenta, configuracion });
  } catch (error) {
    console.error('[GET /api/contabilidad/pyg/configuracion-cuenta] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar cuentaConfiguracionGrupoCC',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/contabilidad/pyg/rubros-periodo', async (req, res) => {
  const centroCostoRaw = String(req.query.centroCosto || '').trim();
  const periodo = String(req.query.periodo || '').trim();
  const tipo = String(req.query.tipo || '').trim().toLowerCase();

  const centroCosto = centroCostoRaw.includes('-')
    ? String(centroCostoRaw.split('-')[0] || '').trim()
    : centroCostoRaw;

  if (!isSqlServerEnabled()) {
    res.status(503).json({ error: 'SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true' });
    return;
  }

  if (!centroCosto || !periodo || (tipo !== 'ingresos' && tipo !== 'gastos')) {
    res.status(400).json({ error: 'Los parametros centroCosto, periodo y tipo (ingresos|gastos) son requeridos' });
    return;
  }

  const [anioRaw, mesRaw] = periodo.split('-');
  const anio = String(anioRaw || '').trim();
  const mes = String(mesRaw || '').trim();

  if (!/^\d{4}$/.test(anio) || !/^\d{2}$/.test(mes)) {
    res.status(400).json({ error: 'El parametro periodo debe tener formato YYYY-MM' });
    return;
  }

  const codeRange = tipo === 'ingresos'
    ? { min: 40, max: 49 }
    : { min: 50, max: 59 };

  try {
    const sqlServerPool = await getSqlServerPool();

    const result = await sqlServerPool
      .request()
      .input('cc_codigo', centroCosto)
      .input('periodo', periodo)
      .input('mes', mes)
      .input('anio', anio)
      .input('min_code', codeRange.min)
      .input('max_code', codeRange.max)
      .query(`
        SELECT
          CAST([cu_codigo] AS varchar(50)) AS cu_codigo,
          MAX(CAST([cu_nombre] AS varchar(255))) AS cu_nombre,
          SUM(TRY_CONVERT(decimal(18, 2), [Costo])) AS valor
        FROM [BONES].[dbo].[PyG_Gastos_Data]
        WHERE [cc_codigo] = @cc_codigo
          AND (
            CAST([periodo_Gasto] AS varchar(20)) = @periodo
            OR (
              RIGHT('0' + CAST([mes_Gasto] AS varchar(2)), 2) = @mes
              AND CAST([AnioOrigen] AS varchar(4)) = @anio
            )
            OR CONVERT(varchar(7), TRY_CONVERT(date, [co_fecha]), 23) = @periodo
          )
          AND TRY_CONVERT(int, LEFT(CAST([cu_codigo] AS varchar(50)), 2)) BETWEEN @min_code AND @max_code
        GROUP BY CAST([cu_codigo] AS varchar(50))
        ORDER BY CAST([cu_codigo] AS varchar(50)) ASC
      `);

    const rubros = (Array.isArray(result.recordset) ? result.recordset : []).map((row) => ({
      codigoCuenta: String(row.cu_codigo || '').trim(),
      nombreCuenta: String(row.cu_nombre || '').trim(),
      valor: Number(row.valor || 0),
    }));

    console.log('[GET /api/contabilidad/pyg/rubros-periodo] rubros cargados', {
      centroCosto,
      periodo,
      tipo,
      total: rubros.length,
      rango: `${codeRange.min}-${codeRange.max}`,
    });

    res.status(200).json({ ok: true, centroCosto, periodo, tipo, rubros });
  } catch (error) {
    console.error('[GET /api/contabilidad/pyg/rubros-periodo] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar rubros de PyG_Gastos_Data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/contabilidad/pyg/configuracion-centro-costo', async (req, res) => {
  const centroCostoRaw = String(req.body?.centroCosto || '').trim();
  const periodo = String(req.body?.periodo || '').trim();
  const tipoCalculoRaw = String(req.body?.tipoCalculo || 'V').trim().toUpperCase();
  const configuraciones = Array.isArray(req.body?.configuraciones) ? req.body.configuraciones : [];

  const normalizeTipoCalculo = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'P') return 'P';
    if (normalized === 'V') return 'V';
    if (normalized === 'PORCENTAJE' || normalized === 'PERCENT' || normalized === '%') return 'P';
    return 'V';
  };

  const tipoCalculoDefault = normalizeTipoCalculo(tipoCalculoRaw);

  const centroCosto = centroCostoRaw.includes('-')
    ? String(centroCostoRaw.split('-')[0] || '').trim()
    : centroCostoRaw;

  if (!isSqlServerEnabled()) {
    res.status(503).json({ error: 'SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true' });
    return;
  }

  if (!centroCosto || !periodo) {
    res.status(400).json({ error: 'Los campos centroCosto y periodo son requeridos' });
    return;
  }

  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    res.status(400).json({ error: 'El campo periodo debe tener formato YYYY-MM' });
    return;
  }

  if (configuraciones.length === 0) {
    res.status(400).json({ error: 'Debe enviar al menos una configuracion para guardar' });
    return;
  }

  const fecha = `${periodo}-01`;

  try {
    const sqlServerPool = await getSqlServerPool();

    let procesadas = 0;
    for (const item of configuraciones) {
      const codigo = String(item?.codigo || '').trim();
      const nombre = String(item?.nombre || '').trim();
      const grupoCuenta = String(item?.grupoCuenta || '').trim();
      const nombreGrupoCuenta = String(item?.nombreGrupoCuenta || '').trim();
      const valor = Number(item?.valor || 0);
      const tipoCalculo = normalizeTipoCalculo(item?.tipoCalculo ?? tipoCalculoDefault);

      if (!codigo) {
        continue;
      }

      await sqlServerPool
        .request()
        .input('CENTRO_COSTO', centroCosto)
        .input('FECHA', fecha)
        .input('CODIGO', codigo)
        .input('NOMBRE', nombre)
        .input('GRUPO_CUENTA', grupoCuenta)
        .input('NOMBRE_GRUPO_CUENTA', nombreGrupoCuenta)
        .input('TIPO_CALCULO', tipoCalculo)
        .input('VALOR', Number.isFinite(valor) ? valor : 0)
        .query(`
          IF EXISTS (
            SELECT 1
            FROM [BONES].[dbo].[Cfg_PyG_CentroCosto]
            WHERE [CODIGO] = @CODIGO
          )
          BEGIN
            UPDATE [BONES].[dbo].[Cfg_PyG_CentroCosto]
            SET
              [CENTRO_COSTO] = @CENTRO_COSTO,
              [FECHA] = @FECHA,
              [NOMBRE] = @NOMBRE,
              [GRUPO_CUENTA] = @GRUPO_CUENTA,
              [NOMBRE_GRUPO_CUENTA] = @NOMBRE_GRUPO_CUENTA,
              [TIPO_CALCULO] = @TIPO_CALCULO,
              [VALOR] = @VALOR
            WHERE [CODIGO] = @CODIGO;
          END
          ELSE
          BEGIN
            INSERT INTO [BONES].[dbo].[Cfg_PyG_CentroCosto]
            (
              [CENTRO_COSTO],
              [FECHA],
              [CODIGO],
              [NOMBRE],
              [GRUPO_CUENTA],
              [NOMBRE_GRUPO_CUENTA],
              [TIPO_CALCULO],
              [VALOR]
            )
            VALUES
            (
              @CENTRO_COSTO,
              @FECHA,
              @CODIGO,
              @NOMBRE,
              @GRUPO_CUENTA,
              @NOMBRE_GRUPO_CUENTA,
              @TIPO_CALCULO,
              @VALOR
            );
          END
        `);

      procesadas += 1;
    }

    console.log('[POST /api/contabilidad/pyg/configuracion-centro-costo] configuraciones guardadas', {
      centroCosto,
      periodo,
      totalRecibidas: configuraciones.length,
      totalProcesadas: procesadas,
    });

    res.status(200).json({
      ok: true,
      centroCosto,
      periodo,
      totalRecibidas: configuraciones.length,
      totalProcesadas: procesadas,
    });
  } catch (error) {
    console.error('[POST /api/contabilidad/pyg/configuracion-centro-costo] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar configuracion en Cfg_PyG_CentroCosto',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/contabilidad/pyg/configuracion-centro-costo', async (req, res) => {
  const centroCostoRaw = String(req.query.centroCosto || '').trim();
  const periodo = String(req.query.periodo || '').trim();
  const tipo = String(req.query.tipo || '').trim().toLowerCase();

  const centroCosto = centroCostoRaw.includes('-')
    ? String(centroCostoRaw.split('-')[0] || '').trim()
    : centroCostoRaw;

  if (!isSqlServerEnabled()) {
    res.status(503).json({ error: 'SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true' });
    return;
  }

  if (!centroCosto || !periodo || (tipo !== 'ingresos' && tipo !== 'gastos')) {
    res.status(400).json({ error: 'Los parametros centroCosto, periodo y tipo (ingresos|gastos) son requeridos' });
    return;
  }

  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    res.status(400).json({ error: 'El parametro periodo debe tener formato YYYY-MM' });
    return;
  }

  const grupoPrefix = tipo === 'ingresos' ? '4.%' : '5.%';

  try {
    const sqlServerPool = await getSqlServerPool();

    const result = await sqlServerPool
      .request()
      .input('CENTRO_COSTO', centroCosto)
      .input('PERIODO', periodo)
      .input('GRUPO_PREFIX', grupoPrefix)
      .query(`
        SELECT
          CAST([CODIGO] AS varchar(50)) AS codigo,
          CAST([NOMBRE] AS varchar(255)) AS nombre,
          CAST([GRUPO_CUENTA] AS varchar(50)) AS grupoCuenta,
          CAST([NOMBRE_GRUPO_CUENTA] AS varchar(255)) AS nombreGrupoCuenta,
          CAST([TIPO_CALCULO] AS varchar(10)) AS tipoCalculo,
          TRY_CONVERT(decimal(18, 4), [VALOR]) AS valor
        FROM [BONES].[dbo].[Cfg_PyG_CentroCosto]
        WHERE CAST([CENTRO_COSTO] AS varchar(50)) = @CENTRO_COSTO
          AND CONVERT(varchar(7), TRY_CONVERT(date, [FECHA]), 23) = @PERIODO
          AND CAST([GRUPO_CUENTA] AS varchar(50)) LIKE @GRUPO_PREFIX
        ORDER BY CAST([GRUPO_CUENTA] AS varchar(50)) ASC
      `);

    const configuraciones = (Array.isArray(result.recordset) ? result.recordset : []).map((row) => ({
      codigo: String(row.codigo || '').trim(),
      nombre: String(row.nombre || '').trim(),
      grupoCuenta: String(row.grupoCuenta || '').trim(),
      nombreGrupoCuenta: String(row.nombreGrupoCuenta || '').trim(),
      tipoCalculo: String(row.tipoCalculo || 'V').trim().toUpperCase() === 'P' ? 'P' : 'V',
      valor: Number(row.valor || 0),
    }));

    console.log('[GET /api/contabilidad/pyg/configuracion-centro-costo] configuraciones cargadas', {
      centroCosto,
      periodo,
      tipo,
      total: configuraciones.length,
    });

    res.status(200).json({ ok: true, centroCosto, periodo, tipo, configuraciones });
  } catch (error) {
    console.error('[GET /api/contabilidad/pyg/configuracion-centro-costo] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar configuracion en Cfg_PyG_CentroCosto',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/contabilidad/pyg/ejecutar-sp', async (req, res) => {
  const centroCostoRaw = String(req.body?.centroCosto || '').trim();
  const fechaIni = String(req.body?.fechaIni || '').trim();
  const fechaFin = String(req.body?.fechaFin || '').trim();
  const anio = String(req.body?.anio || '').trim();
  const periodoGasto = fechaIni.slice(0, 7);
  const mesGasto = periodoGasto.includes('-') ? String(periodoGasto.split('-')[1] || '').trim() : '';

  const centroCosto = centroCostoRaw.includes('-')
    ? String(centroCostoRaw.split('-')[0] || '').trim()
    : centroCostoRaw;

  if (!isSqlServerEnabled()) {
    res.status(503).json({ error: 'SQL Server no esta habilitado. Configure SQLSERVER_ENABLED=true' });
    return;
  }

  if (!centroCosto || !fechaIni || !fechaFin || !anio) {
    res.status(400).json({ error: 'Los campos centroCosto, fechaIni, fechaFin y anio son requeridos' });
    return;
  }

  console.log('[POST /api/contabilidad/pyg/ejecutar-sp] Evaluando si el periodo ya esta registrado', {
    centroCosto,
    fechaIni,
    fechaFin,
    anio,
    periodoGasto,
    mesGasto,
  });

  try {
    const sqlServerPool = await getSqlServerPool();

    const existsResult = await sqlServerPool
      .request()
      .input('cc_codigo', centroCosto)
      .input('fecha_ini', fechaIni)
      .input('fecha_fin', fechaFin)
      .input('periodo_gasto', periodoGasto)
      .input('mes_gasto', mesGasto)
      .input('anio_origen', anio)
      .query(`
        SELECT TOP (1) 1 AS existe
        FROM [BONES].[dbo].[PyG_Gastos_Data]
        WHERE cc_codigo = @cc_codigo
          AND (
            (TRY_CONVERT(date, co_fecha) >= TRY_CONVERT(date, @fecha_ini)
              AND TRY_CONVERT(date, co_fecha) < TRY_CONVERT(date, @fecha_fin))
            OR (CONVERT(varchar(7), TRY_CONVERT(date, co_fecha), 23) = @periodo_gasto)
            OR (CAST(periodo_Gasto AS varchar(20)) = @periodo_gasto)
            OR (
              RIGHT('0' + CAST(mes_Gasto AS varchar(2)), 2) = @mes_gasto
              AND CAST(AnioOrigen AS varchar(4)) = @anio_origen
            )
          )
      `);

    const yaRegistrado = Array.isArray(existsResult.recordset) && existsResult.recordset.length > 0;

    if (yaRegistrado) {
      console.log('[POST /api/contabilidad/pyg/ejecutar-sp] ya registrado', {
        centroCosto,
        periodoGasto,
      });

      res.status(200).json({
        ok: true,
        mode: 'ya_registrado',
        message: 'ya registrado',
      });
      return;
    }

    const result = await sqlServerPool
      .request()
      .input('cc_codigo', centroCosto)
      .input('fecha_ini', fechaIni)
      .input('fecha_fin', fechaFin)
      .input('anio', anio)
      .execute('dbo.sp_reporte_pyg_filtrado');

    const rowsCount = Array.isArray(result.recordset) ? result.recordset.length : 0;

    console.log('[POST /api/contabilidad/pyg/ejecutar-sp] sp utilizado', {
      centroCosto,
      fechaIni,
      fechaFin,
      anio,
      returnValue: result.returnValue,
      rowsCount,
    });

    res.status(200).json({
      ok: true,
      mode: 'sp_utilizado',
      message: 'sp utilizado',
      returnValue: result.returnValue,
      rowsCount,
    });
  } catch (error) {
    console.error('[POST /api/contabilidad/pyg/ejecutar-sp] Error al ejecutar SP:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo ejecutar sp_reporte_pyg_filtrado',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const TABLAS_LIQUIDACION_BANCOS = {
  pichincha: 'Banco_Pichincha',
  pichincha_ahorros: 'Banco_Pichincha_Ahorros',
  internacional: 'Banco_Internacional',
  internacional_pp: 'Banco_Internacional_PP',
};

const NOMBRES_LIQUIDACION_BANCOS = {
  pichincha: 'Banco Pichincha',
  pichincha_ahorros: 'Banco Pichincha Ahorros',
  internacional: 'Banco Internacional',
  internacional_pp: 'Banco Internacional PP',
};

// Numeros de cuenta fijos por banco; se guardan como texto para no perder
// los ceros a la izquierda de los bancos internacionales.
const NUM_CUENTA_LIQUIDACION_BANCOS = {
  pichincha: '3395938904',
  pichincha_ahorros: '2212752593',
  internacional: '0800141807',
  internacional_pp: '0800633276',
};

const ensureColumnaBancoLiquidacion = async (tabla) => {
  await pool.query(`ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS banco VARCHAR(50)`);
  await pool.query(`ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS num_cuenta VARCHAR(20)`);
};

const ensureHistorialLiquidacionBancosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Historial_Liquidacion_Bancos" (
      id BIGSERIAL PRIMARY KEY,
      banco VARCHAR(30) NOT NULL,
      archivo VARCHAR(255) NOT NULL,
      fecha_carga TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total INTEGER NOT NULL DEFAULT 0,
      duplicados INTEGER NOT NULL DEFAULT 0,
      cargados INTEGER NOT NULL DEFAULT 0,
      estado VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const registrarHistorialLiquidacionBanco = async ({ banco, archivo, total, duplicados, cargados, estado }) => {
  await ensureHistorialLiquidacionBancosTable();
  const result = await pool.query(
    `INSERT INTO "Historial_Liquidacion_Bancos" (banco, archivo, total, duplicados, cargados, estado)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, banco, archivo, fecha_carga, total, duplicados, cargados, estado`,
    [banco, archivo, total, duplicados, cargados, estado]
  );
  return result.rows[0];
};

const parseFechaDDMMYYYYaISO = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const claveDuplicadoLiquidacionBanco = (fecha, documento, monto) => `${fecha}|${documento}|${monto.toFixed(2)}`;

const procesarCargaLiquidacionBanco = async (tabla, filasInput, nombreBanco, numCuenta) => {
  await ensureColumnaBancoLiquidacion(tabla);

  const filas = (Array.isArray(filasInput) ? filasInput : [])
    .map((fila) => {
      const monto = Number(Number(fila?.monto || 0).toFixed(2));
      return {
        fecha: parseFechaDDMMYYYYaISO(fila?.fecha),
        codigo: String(fila?.codigo ?? '').trim(),
        concepto: String(fila?.concepto ?? '').trim(),
        tipo: String(fila?.tipo ?? '').trim(),
        documento: String(fila?.documento ?? '').trim(),
        oficina: String(fila?.oficina ?? '').trim(),
        monto,
      };
    })
    .filter((fila) => fila.fecha && fila.documento && Number.isFinite(fila.monto));

  const total = filas.length;

  if (total === 0) {
    return { total: 0, duplicados: 0, cargados: 0, estado: 'error' };
  }

  const existentes = await pool.query(
    `SELECT t.fecha::text AS fecha, t.documento, t.monto
     FROM "${tabla}" AS t
     JOIN (
       SELECT unnest($1::date[]) AS fecha, unnest($2::text[]) AS documento, unnest($3::numeric[]) AS monto
     ) AS input USING (fecha, documento, monto)`,
    [filas.map((f) => f.fecha), filas.map((f) => f.documento), filas.map((f) => f.monto)]
  );

  const vistos = new Set(
    existentes.rows.map((row) => claveDuplicadoLiquidacionBanco(row.fecha, row.documento, Number(row.monto)))
  );

  let duplicados = 0;
  let cargados = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const fila of filas) {
      const key = claveDuplicadoLiquidacionBanco(fila.fecha, fila.documento, fila.monto);
      if (vistos.has(key)) {
        duplicados += 1;
        continue;
      }

      await client.query(
        `INSERT INTO "${tabla}" (fecha, codigo, concepto, tipo, documento, oficina, monto, banco, num_cuenta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [fila.fecha, fila.codigo, fila.concepto, fila.tipo, fila.documento, fila.oficina, fila.monto, nombreBanco, numCuenta]
      );
      vistos.add(key);
      cargados += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const estado = cargados === total ? 'exito' : cargados === 0 ? 'error' : 'parcial';

  return { total, duplicados, cargados, estado };
};

const registrarUploadLiquidacionBanco = (ruta, tabla, etiqueta, bancoKey) => {
  app.post(ruta, async (req, res) => {
    const nombreArchivo = String(req.body?.nombreArchivo || '').trim();
    const filas = req.body?.filas;

    if (!nombreArchivo) {
      res.status(400).json({ error: 'El campo nombreArchivo es requerido' });
      return;
    }

    try {
      const resultado = await procesarCargaLiquidacionBanco(tabla, filas, NOMBRES_LIQUIDACION_BANCOS[bancoKey], NUM_CUENTA_LIQUIDACION_BANCOS[bancoKey]);
      const registro = await registrarHistorialLiquidacionBanco({
        banco: bancoKey,
        archivo: nombreArchivo,
        total: resultado.total,
        duplicados: resultado.duplicados,
        cargados: resultado.cargados,
        estado: resultado.estado,
      });
      res.status(200).json({
        id: registro.id,
        nombreArchivo,
        fecha: registro.fecha_carga.toISOString(),
        ...resultado,
      });
    } catch (error) {
      console.error(`[POST ${ruta}] Error:`, error instanceof Error ? error.message : String(error));
      res.status(500).json({
        error: `No se pudo procesar la carga de ${etiqueta}`,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};

registrarUploadLiquidacionBanco(
  '/api/contabilidad/liquidacion-bancos/pichincha/upload',
  TABLAS_LIQUIDACION_BANCOS.pichincha,
  'Banco Pichincha',
  'pichincha'
);

registrarUploadLiquidacionBanco(
  '/api/contabilidad/liquidacion-bancos/pichincha-ahorros/upload',
  TABLAS_LIQUIDACION_BANCOS.pichincha_ahorros,
  'Banco Pichincha Ahorros',
  'pichincha_ahorros'
);

// Banco Internacional / Internacional PP: el archivo trae 3 filas de metadata,
// encabezados reales en la fila 4 (indice 3) y datos desde la fila 5 (indice 4).
// La columna A siempre esta vacia y "Descripcion" / "Referencia Adicional" son
// celdas combinadas que dejan una columna vacia intermedia, por lo que se lee
// todo como array de arrays (header:1) y se accede por posicion fija, no por nombre:
//   0: (vacia)  1: Fecha  2: Cod.  3: Descripcion  4: (vacia, merge)
//   5: Referencia Adicional  6: (vacia, merge)  7: Debito  8: Credito  9: Ciudad
// La columna "Descripcion" trae documento y concepto juntos ("00000326634 DEPOSITO M/E").
const quitarDiacriticos = (value) => value
  .normalize('NFD')
  .split('')
  .filter((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x0300 || code > 0x036f;
  })
  .join('');

const normalizarTextoEncabezado = (value) => quitarDiacriticos(String(value ?? ''))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const validarEncabezadoBancoInternacional = (filasCrudas) => {
  const filaEncabezado = filasCrudas[3];
  if (!Array.isArray(filaEncabezado) || filaEncabezado.length < 4) {
    return false;
  }
  return normalizarTextoEncabezado(filaEncabezado[1]) === 'fecha'
    && normalizarTextoEncabezado(filaEncabezado[3]) === 'descripcion';
};

const parseNumeroCelda = (valor) => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number(valor.toFixed(2));
  }

  const texto = String(valor ?? '').trim().replace(/[^0-9,.-]/g, '');
  if (!texto) return 0;

  const normalizado = texto.includes(',') && !texto.includes('.')
    ? texto.replace(',', '.')
    : texto.replace(/,/g, '');

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0;
};

const claveDuplicadoBancoInternacional = (fecha, documento, debito, credito) =>
  `${fecha}|${documento}|${debito.toFixed(2)}|${credito.toFixed(2)}`;

// Solo para Banco Internacional / Internacional PP: el documento se sube sin
// ceros a la izquierda (ej. "00000136636" -> "136636"). Se conserva al menos
// un digito si el numero es todo ceros.
const quitarCerosIzquierda = (valor) => {
  const texto = String(valor ?? '').trim();
  return texto.replace(/^0+(?=\d)/, '');
};

const procesarCargaBancoInternacional = async (tabla, filasCrudas, nombreBanco, numCuenta) => {
  if (!Array.isArray(filasCrudas) || !validarEncabezadoBancoInternacional(filasCrudas)) {
    const error = new Error('Estructura de archivo no válida para BANCO INTERNACIONAL');
    error.esErrorEstructura = true;
    throw error;
  }

  await ensureColumnaBancoLiquidacion(tabla);

  const filas = filasCrudas
    .slice(4)
    .filter((fila) => Array.isArray(fila) && fila.some((celda) => String(celda ?? '').trim() !== ''))
    .map((fila) => {
      const fechaTexto = String(fila[1] ?? '').trim();
      const descripcion = String(fila[3] ?? '').trim();
      const primerEspacio = descripcion.indexOf(' ');
      const documentoCrudo = (primerEspacio === -1 ? descripcion : descripcion.slice(0, primerEspacio)).trim();
      const documento = quitarCerosIzquierda(documentoCrudo);
      const concepto = (primerEspacio === -1 ? '' : descripcion.slice(primerEspacio + 1)).trim();
      const referenciaAdicional = String(fila[5] ?? '').trim();

      return {
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ? fechaTexto : null,
        cod: String(fila[2] ?? '').trim(),
        documento,
        concepto,
        referencia_adicional: referenciaAdicional || null,
        debito: parseNumeroCelda(fila[7]),
        credito: parseNumeroCelda(fila[8]),
        ciudad: String(fila[9] ?? '').trim(),
      };
    })
    .filter((fila) => fila.fecha && fila.documento);

  const total = filas.length;

  if (total === 0) {
    return { total: 0, duplicados: 0, cargados: 0, estado: 'error' };
  }

  const existentes = await pool.query(
    `SELECT t.fecha::text AS fecha, t.documento, t.debito, t.credito
     FROM "${tabla}" AS t
     JOIN (
       SELECT unnest($1::date[]) AS fecha, unnest($2::text[]) AS documento,
              unnest($3::numeric[]) AS debito, unnest($4::numeric[]) AS credito
     ) AS input USING (fecha, documento, debito, credito)`,
    [
      filas.map((f) => f.fecha),
      filas.map((f) => f.documento),
      filas.map((f) => f.debito),
      filas.map((f) => f.credito),
    ]
  );

  const vistos = new Set(
    existentes.rows.map((row) =>
      claveDuplicadoBancoInternacional(row.fecha, row.documento, Number(row.debito), Number(row.credito))
    )
  );

  let duplicados = 0;
  let cargados = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const fila of filas) {
      const key = claveDuplicadoBancoInternacional(fila.fecha, fila.documento, fila.debito, fila.credito);
      if (vistos.has(key)) {
        duplicados += 1;
        continue;
      }

      await client.query(
        `INSERT INTO "${tabla}" (fecha, cod, documento, concepto, referencia_adicional, debito, credito, ciudad, banco, num_cuenta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [fila.fecha, fila.cod, fila.documento, fila.concepto, fila.referencia_adicional, fila.debito, fila.credito, fila.ciudad, nombreBanco, numCuenta]
      );
      vistos.add(key);
      cargados += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const estado = cargados === total ? 'exito' : cargados === 0 ? 'error' : 'parcial';

  return { total, duplicados, cargados, estado };
};

const registrarUploadBancoInternacional = (ruta, tabla, etiqueta, bancoKey) => {
  app.post(ruta, async (req, res) => {
    const nombreArchivo = String(req.body?.nombreArchivo || '').trim();
    const filas = req.body?.filas;

    if (!nombreArchivo) {
      res.status(400).json({ error: 'El campo nombreArchivo es requerido' });
      return;
    }

    try {
      const resultado = await procesarCargaBancoInternacional(tabla, filas, NOMBRES_LIQUIDACION_BANCOS[bancoKey], NUM_CUENTA_LIQUIDACION_BANCOS[bancoKey]);
      const registro = await registrarHistorialLiquidacionBanco({
        banco: bancoKey,
        archivo: nombreArchivo,
        total: resultado.total,
        duplicados: resultado.duplicados,
        cargados: resultado.cargados,
        estado: resultado.estado,
      });
      res.status(200).json({
        id: registro.id,
        nombreArchivo,
        fecha: registro.fecha_carga.toISOString(),
        ...resultado,
      });
    } catch (error) {
      if (error && error.esErrorEstructura) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error(`[POST ${ruta}] Error:`, error instanceof Error ? error.message : String(error));
      res.status(500).json({
        error: `No se pudo procesar la carga de ${etiqueta}`,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};

registrarUploadBancoInternacional(
  '/api/contabilidad/liquidacion-bancos/internacional/upload',
  TABLAS_LIQUIDACION_BANCOS.internacional,
  'Banco Internacional',
  'internacional'
);

registrarUploadBancoInternacional(
  '/api/contabilidad/liquidacion-bancos/internacional-pp/upload',
  TABLAS_LIQUIDACION_BANCOS.internacional_pp,
  'Banco Internacional PP',
  'internacional_pp'
);

app.get('/api/contabilidad/liquidacion-bancos/historial', async (_req, res) => {
  try {
    await ensureHistorialLiquidacionBancosTable();

    const result = await pool.query(
      `SELECT id, banco, archivo, fecha_carga, total, duplicados, cargados, estado
       FROM "Historial_Liquidacion_Bancos"
       ORDER BY fecha_carga DESC
       LIMIT 20`
    );

    res.status(200).json({
      historial: result.rows.map((row) => ({
        id: row.id,
        banco: row.banco,
        archivo: row.archivo,
        fecha: row.fecha_carga.toISOString(),
        total: row.total,
        duplicados: row.duplicados,
        cargados: row.cargados,
        estado: row.estado,
      })),
    });
  } catch (error) {
    console.error('[GET /api/contabilidad/liquidacion-bancos/historial] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo obtener el historial de cargas',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/humana/periods', async (_req, res) => {
  try {
    console.log('[GET /api/humana/periods] Obteniendo periodos disponibles');
    const result = await pool.query(
      `SELECT anio, mes, MAX(fecha_carga) AS fecha_carga
       FROM medic_secure_humana
       GROUP BY anio, mes
       ORDER BY anio DESC, mes DESC, MAX(fecha_carga) DESC`
    );

    console.log(`[GET /api/humana/periods] Encontrados ${result.rowCount} periodos`);
    res.status(200).json(result.rows.map((row) => ({
      anio: row.anio,
      mes: row.mes,
      archivo: '',
      fechaCarga: new Date(row.fecha_carga).getTime(),
    })));
  } catch (error) {
    console.error('[GET /api/humana/periods] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      error: 'No se pudo cargar periodos', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/api/humana/periods/:anio/:mes', async (req, res) => {
  const anio = Number(req.params.anio);
  const mes = String(req.params.mes || '');

  if (!Number.isInteger(anio) || !mes) {
    res.status(400).json({ error: 'Parametros invalidos' });
    return;
  }

  try {
    console.log(`[GET /api/humana/periods] Consultando anio=${anio}, mes=${mes}`);
    const result = await pool.query(
      `SELECT *
       FROM medic_secure_humana
       WHERE anio = $1 AND mes = $2
       ORDER BY empleado ASC`,
      [anio, mes]
    );

    console.log(`[GET /api/humana/periods] Encontrados ${result.rowCount} registros`);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Periodo no encontrado' });
      return;
    }

    const first = result.rows[0];
    const empleados = result.rows.map(mapDbRowToEmpleado);
    res.status(200).json({
      anio,
      mes,
      archivo: '',
      fechaCarga: new Date(first.fecha_carga).getTime(),
      empleados,
    });
  } catch (error) {
    console.error('[GET /api/humana/periods] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      error: 'No se pudo cargar el periodo', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

app.get('/api/humana/employee-latest', async (req, res) => {
  const empleado = String(req.query.empleado || '').trim();

  if (!empleado) {
    res.status(400).json({ error: 'Parametro empleado es requerido' });
    return;
  }

  try {
    const hoy = new Date();
    const inicioRango = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 20);
    const finRango = new Date(hoy.getFullYear(), hoy.getMonth(), 20);
    const toIsoDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const inicioRangoIso = toIsoDate(inicioRango);
    const finRangoIso = toIsoDate(finRango);

    const nombreNormalizado = empleado.replace(/\s+/g, ' ').trim().toLowerCase();

    let result = await pool.query(
      `WITH candidatos AS (
         SELECT
           empleado, plan, tarifa, fecha_carga, anio, mes, f_ingreso, f_exclusion,
           CASE
             WHEN (
               CASE
                 WHEN COALESCE(f_ingreso, '') ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date(f_ingreso, 'DD-MM-YYYY')
                 WHEN COALESCE(f_ingreso, '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(f_ingreso, 'YYYY-MM-DD')
                 ELSE NULL
               END
             ) BETWEEN $2::date AND $3::date THEN 1
             WHEN (
               CASE
                 WHEN COALESCE(f_exclusion, '') ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date(f_exclusion, 'DD-MM-YYYY')
                 WHEN COALESCE(f_exclusion, '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(f_exclusion, 'YYYY-MM-DD')
                 ELSE NULL
               END
             ) BETWEEN $2::date AND $3::date THEN 1
             ELSE 0
           END AS prioridad_movimiento
         FROM medic_secure_humana
         WHERE LOWER(REGEXP_REPLACE(TRIM(empleado), '\\s+', ' ', 'g')) = $1
       )
       SELECT empleado, plan, tarifa, fecha_carga, anio, mes, prioridad_movimiento
       FROM candidatos
       ORDER BY prioridad_movimiento DESC, fecha_carga DESC, anio DESC, mes DESC
       LIMIT 1`,
      [nombreNormalizado, inicioRangoIso, finRangoIso]
    );

    // Fallback: coincidencia flexible por todas las palabras del nombre
    if (result.rowCount === 0) {
      const tokens = nombreNormalizado.split(' ').filter(Boolean);
      if (tokens.length > 0) {
        const whereTokens = tokens.map((_, idx) => `LOWER(empleado) LIKE $${idx + 1}`).join(' AND ');
        const params = tokens.map((t) => `%${t}%`);
        result = await pool.query(
          `WITH candidatos AS (
             SELECT
               empleado, plan, tarifa, fecha_carga, anio, mes, f_ingreso, f_exclusion,
               CASE
                 WHEN (
                   CASE
                     WHEN COALESCE(f_ingreso, '') ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date(f_ingreso, 'DD-MM-YYYY')
                     WHEN COALESCE(f_ingreso, '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(f_ingreso, 'YYYY-MM-DD')
                     ELSE NULL
                   END
                 ) BETWEEN $${tokens.length + 1}::date AND $${tokens.length + 2}::date THEN 1
                 WHEN (
                   CASE
                     WHEN COALESCE(f_exclusion, '') ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date(f_exclusion, 'DD-MM-YYYY')
                     WHEN COALESCE(f_exclusion, '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(f_exclusion, 'YYYY-MM-DD')
                     ELSE NULL
                   END
                 ) BETWEEN $${tokens.length + 1}::date AND $${tokens.length + 2}::date THEN 1
                 ELSE 0
               END AS prioridad_movimiento
             FROM medic_secure_humana
             WHERE ${whereTokens}
           )
           SELECT empleado, plan, tarifa, fecha_carga, anio, mes, prioridad_movimiento
           FROM candidatos
           ORDER BY prioridad_movimiento DESC, fecha_carga DESC, anio DESC, mes DESC
           LIMIT 1`,
          [...params, inicioRangoIso, finRangoIso]
        );
      }
    }

    if (result.rowCount === 0) {
      res.status(200).json({
        found: false,
        empleado,
        plan: '',
        tarifa: '',
        fechaCarga: null,
        anio: null,
        mes: null,
      });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      found: true,
      empleado: String(row.empleado || ''),
      plan: String(row.plan || ''),
      tarifa: String(row.tarifa || ''),
      prioridadMovimiento: Number(row.prioridad_movimiento || 0),
      rangoMovimientos: { inicio: inicioRangoIso, fin: finRangoIso },
      fechaCarga: row.fecha_carga ? new Date(row.fecha_carga).getTime() : null,
      anio: Number(row.anio || 0),
      mes: String(row.mes || ''),
    });
  } catch (error) {
    console.error('[GET /api/humana/employee-latest] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo consultar el empleado en medic_secure_humana',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.put('/api/humana/periods/:anio/:mes', async (req, res) => {
  const anio = Number(req.params.anio);
  const mes = String(req.params.mes || '');
  const archivo = String(req.body?.archivo || '');
  const empleados = Array.isArray(req.body?.empleados) ? req.body.empleados : [];

  if (!Number.isInteger(anio) || !mes) {
    res.status(400).json({ error: 'Parametros invalidos' });
    return;
  }

  try {
    console.log(`[PUT /api/humana/periods] Guardando anio=${anio}, mes=${mes}, empleados=${empleados.length}`);

    await pool.query('BEGIN');
    await pool.query('DELETE FROM medic_secure_humana WHERE anio = $1 AND mes = $2', [anio, mes]);

    for (const emp of empleados) {
      const apellidos = String(emp?.apellidos || '').trim();
      const nombres = String(emp?.nombres || '').trim();
      const empleado = `${apellidos} ${nombres}`.trim();

      await pool.query(
        `INSERT INTO medic_secure_humana (
          anio, mes,
          empleado, cedula, centro, plan, tarifa,
          trabajador_rol, urbapark, prima, ajuste, assist, seguro,
          f_ingreso, f_exclusion
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15
        )`,
        [
          anio, mes,
          empleado, String(emp?.cedula || ''), String(emp?.centroCosto || ''), String(emp?.plan || ''), String(emp?.tarifa || ''),
          Number(emp?.trabajador || 0), Number(emp?.urbapark || 0), Number(emp?.prima || 0), Number(emp?.ajuste || 0), Number(emp?.humanaAssist || 0), Number(emp?.seguroCampesino || 0),
          String(emp?.fechaInclusion || ''), String(emp?.fechaExclusion || ''),
        ]
      );
    }

    await pool.query('COMMIT');

    console.log(`[PUT /api/humana/periods] Guardado exitoso: ${empleados.length} empleados`);
    res.status(200).json({
      ok: true,
      anio,
      mes,
      archivo,
      fechaCarga: Date.now(),
      totalEmpleados: empleados.length,
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[PUT /api/humana/periods] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      error: 'No se pudo guardar el periodo', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/api/descuentos/incidentes-caja-chica', async (_req, res) => {
  try {
    await ensureDescuentosTable();
    const result = await pool.query(
      `SELECT id, periodo, nombre, valor, codigo_centro_costo, centro_costo, observacion, estado,
              COUNT(*) OVER (PARTITION BY nombre) AS recurrencia,
              fecha_creacion
       FROM incidents_discount_nomina
       ORDER BY fecha_creacion DESC, id DESC`
    );

    res.status(200).json({
      ok: true,
      descuentos: result.rows.map(mapDbRowToDescuento),
    });
  } catch (error) {
    console.error('[GET /api/descuentos/incidentes-caja-chica] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar descuentos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/descuentos/incidentes-caja-chica', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const centroCostoInput = String(req.body?.centroCosto || '').trim();
  const observacion = String(req.body?.observacion || '').trim();
  const valor = parseValor(req.body?.valor);
  const periodo = getPeriodoActual();
  const { codigoCentroCosto, centroCosto } = parseCentroCostoCompuesto(centroCostoInput);

  if (!nombre) {
    res.status(400).json({ error: 'El campo nombre es requerido' });
    return;
  }

  if (!centroCostoInput) {
    res.status(400).json({ error: 'El campo centroCosto es requerido' });
    return;
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    res.status(400).json({ error: 'El campo valor debe ser numerico y mayor a 0' });
    return;
  }

  try {
    await ensureDescuentosTable();

    const result = await pool.query(
      `INSERT INTO incidents_discount_nomina (periodo, nombre, valor, codigo_centro_costo, centro_costo, observacion, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, periodo, nombre, valor, codigo_centro_costo, centro_costo, observacion, estado, fecha_creacion`,
      [periodo, nombre, valor, codigoCentroCosto, centroCosto, observacion, 'pendiente revision']
    );

    const recurrenciaResult = await pool.query(
      `SELECT COUNT(*)::int AS recurrencia
       FROM incidents_discount_nomina
       WHERE nombre = $1`,
      [nombre]
    );

    const descuentoConRecurrencia = {
      ...result.rows[0],
      recurrencia: Number(recurrenciaResult.rows[0]?.recurrencia || 1),
    };

    res.status(201).json({
      ok: true,
      descuento: mapDbRowToDescuento(descuentoConRecurrencia),
    });
  } catch (error) {
    console.error('[POST /api/descuentos/incidentes-caja-chica] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar el descuento',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.patch('/api/descuentos/incidentes-caja-chica/:id/estado', async (req, res) => {
  const id = Number(req.params.id);
  const estado = String(req.body?.estado || '').trim().toLowerCase();

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parametro id es invalido' });
    return;
  }

  if (!estado) {
    res.status(400).json({ error: 'El campo estado es requerido' });
    return;
  }

  try {
    await ensureDescuentosTable();

    const result = await pool.query(
      `UPDATE incidents_discount_nomina
       SET estado = $2
       WHERE id = $1
       RETURNING id, periodo, nombre, valor, codigo_centro_costo, centro_costo, observacion, estado, fecha_creacion`,
      [id, estado]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Descuento no encontrado' });
      return;
    }

    const recurrenciaResult = await pool.query(
      `SELECT COUNT(*)::int AS recurrencia
       FROM incidents_discount_nomina
       WHERE nombre = $1`,
      [String(result.rows[0]?.nombre || '')]
    );

    res.status(200).json({
      ok: true,
      descuento: mapDbRowToDescuento({
        ...result.rows[0],
        recurrencia: Number(recurrenciaResult.rows[0]?.recurrencia || 1),
      }),
    });
  } catch (error) {
    console.error('[PATCH /api/descuentos/incidentes-caja-chica/:id/estado] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo actualizar el estado del descuento',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/descuentos/exentos-pago-seguro', async (_req, res) => {
  try {
    await ensureExentosPagoSeguroTable();

    const result = await pool.query(
      `SELECT id, cedula, nombre, porcentaje_exento, fecha_creacion, fecha_actualizacion
       FROM humana_exentos_pago_seguro
       ORDER BY fecha_actualizacion DESC, id DESC`
    );

    res.status(200).json({
      ok: true,
      registros: result.rows.map(mapDbRowToExentoPagoSeguro),
    });
  } catch (error) {
    console.error('[GET /api/descuentos/exentos-pago-seguro] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar exentos de pago seguro',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/descuentos/exentos-pago-seguro', async (req, res) => {
  const cedula = String(req.body?.cedula || '').trim();
  const nombre = String(req.body?.nombre || '').trim();
  const porcentajeExento = parseValor(req.body?.porcentajeExento);

  if (!cedula) {
    res.status(400).json({ error: 'El campo cedula es requerido' });
    return;
  }

  if (!nombre) {
    res.status(400).json({ error: 'El campo nombre es requerido' });
    return;
  }

  if (!Number.isFinite(porcentajeExento) || porcentajeExento < 0 || porcentajeExento > 100) {
    res.status(400).json({ error: 'El campo porcentajeExento debe estar entre 0 y 100' });
    return;
  }

  try {
    await ensureExentosPagoSeguroTable();

    const result = await pool.query(
      `INSERT INTO humana_exentos_pago_seguro (cedula, nombre, porcentaje_exento)
       VALUES ($1, $2, $3)
       ON CONFLICT (cedula)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         porcentaje_exento = EXCLUDED.porcentaje_exento,
         fecha_actualizacion = NOW()
       RETURNING id, cedula, nombre, porcentaje_exento, fecha_creacion, fecha_actualizacion`,
      [cedula, nombre, porcentajeExento]
    );

    res.status(201).json({
      ok: true,
      registro: mapDbRowToExentoPagoSeguro(result.rows[0]),
    });
  } catch (error) {
    console.error('[POST /api/descuentos/exentos-pago-seguro] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar exento de pago seguro',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/valets/centros', async (req, res) => {
  const activoRaw = String(req.query.activo || '').trim().toLowerCase();

  try {
    await ensureValetFijoCentroTable();

    const filtros = [];
    const params = [];

    if (activoRaw === 'true' || activoRaw === 'false') {
      params.push(activoRaw === 'true');
      filtros.push(`activo = $${params.length}`);
    }

    const whereSql = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, centro_costo_id, centro_costo_nombre, activo, fecha_creacion, fecha_actualizacion
       FROM valet_fijo_centro
       ${whereSql}
       ORDER BY centro_costo_nombre ASC, centro_costo_id ASC`,
      params,
    );

    res.status(200).json({
      ok: true,
      registros: result.rows.map(mapDbRowToValetFijoCentro),
    });
  } catch (error) {
    console.error('[GET /api/valets/centros] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudieron cargar centros de valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/valets/centros', async (req, res) => {
  const centroCostoId = String(req.body?.centroCostoId || '').trim();
  const centroCostoNombre = String(req.body?.centroCostoNombre || '').trim();
  const activo = req.body?.activo === undefined ? true : Boolean(req.body?.activo);

  if (!centroCostoId) {
    res.status(400).json({ error: 'El campo centroCostoId es requerido' });
    return;
  }

  try {
    await ensureValetFijoCentroTable();

    const result = await pool.query(
      `INSERT INTO valet_fijo_centro (centro_costo_id, centro_costo_nombre, activo, fecha_actualizacion)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (centro_costo_id)
       DO UPDATE SET
         centro_costo_nombre = EXCLUDED.centro_costo_nombre,
         activo = EXCLUDED.activo,
         fecha_actualizacion = NOW()
       RETURNING id, centro_costo_id, centro_costo_nombre, activo, fecha_creacion, fecha_actualizacion`,
      [centroCostoId, centroCostoNombre, activo],
    );

    res.status(201).json({
      ok: true,
      registro: mapDbRowToValetFijoCentro(result.rows[0]),
    });
  } catch (error) {
    console.error('[POST /api/valets/centros] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar centro de valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/valets/centros', async (req, res) => {
  const centroCostoId = String(req.query.centroCostoId || '').trim();

  if (!centroCostoId) {
    res.status(400).json({ error: 'El parametro centroCostoId es requerido' });
    return;
  }

  try {
    await ensureValetFijoCentroTable();

    const result = await pool.query(
      `DELETE FROM valet_fijo_centro
       WHERE centro_costo_id = $1
       RETURNING id, centro_costo_id, centro_costo_nombre, activo, fecha_creacion, fecha_actualizacion`,
      [centroCostoId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'No se encontro el centro de valet fijo' });
      return;
    }

    res.status(200).json({
      ok: true,
      registro: mapDbRowToValetFijoCentro(result.rows[0]),
    });
  } catch (error) {
    console.error('[DELETE /api/valets/centros] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo eliminar centro de valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/valets/configuracion', async (req, res) => {
  const centroCostoId = String(req.query.centroCostoId || '').trim();

  try {
    await ensureValetFijoConfiguracionTable();

    const filtros = [];
    const params = [];

    if (centroCostoId) {
      params.push(centroCostoId);
      filtros.push(`centro_costo_id = $${params.length}`);
    }

    const whereSql = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, centro_costo_id, horas_normal_limite, valor_normal, valor_adicional,
              valor_domingo, valor_domingo_adicional, metadata, fecha_creacion, fecha_actualizacion
       FROM valet_fijo_configuracion
       ${whereSql}
       ORDER BY centro_costo_id ASC`,
      params,
    );

    res.status(200).json({
      ok: true,
      registros: result.rows.map(mapDbRowToValetFijoConfiguracion),
    });
  } catch (error) {
    console.error('[GET /api/valets/configuracion] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar configuracion de valets fijos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/valets/configuracion', async (req, res) => {
  const centroCostoId = String(req.body?.centroCostoId || '').trim();
  const horasNormalLimite = parseValor(req.body?.horasNormalLimite);
  const valorNormal = parseValor(req.body?.valorNormal);
  const valorAdicional = parseValor(req.body?.valorAdicional);
  const valorDomingo = parseValor(req.body?.valorDomingo);
  const valorDomingoAdicional = parseValor(req.body?.valorDomingoAdicional);
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

  if (!centroCostoId) {
    res.status(400).json({ error: 'El campo centroCostoId es requerido' });
    return;
  }

  if (!Number.isFinite(horasNormalLimite) || horasNormalLimite < 0) {
    res.status(400).json({ error: 'horasNormalLimite debe ser numerico y mayor o igual a 0' });
    return;
  }

  if (!Number.isFinite(valorNormal) || valorNormal < 0) {
    res.status(400).json({ error: 'valorNormal debe ser numerico y mayor o igual a 0' });
    return;
  }

  if (!Number.isFinite(valorAdicional) || valorAdicional < 0) {
    res.status(400).json({ error: 'valorAdicional debe ser numerico y mayor o igual a 0' });
    return;
  }

  if (!Number.isFinite(valorDomingo) || valorDomingo < 0) {
    res.status(400).json({ error: 'valorDomingo debe ser numerico y mayor o igual a 0' });
    return;
  }

  if (!Number.isFinite(valorDomingoAdicional) || valorDomingoAdicional < 0) {
    res.status(400).json({ error: 'valorDomingoAdicional debe ser numerico y mayor o igual a 0' });
    return;
  }

  try {
    await ensureValetFijoConfiguracionTable();

    const result = await pool.query(
      `INSERT INTO valet_fijo_configuracion (
         centro_costo_id,
         horas_normal_limite,
         valor_normal,
         valor_adicional,
         valor_domingo,
         valor_domingo_adicional,
         metadata,
         fecha_actualizacion
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
       ON CONFLICT (centro_costo_id)
       DO UPDATE SET
         horas_normal_limite = EXCLUDED.horas_normal_limite,
         valor_normal = EXCLUDED.valor_normal,
         valor_adicional = EXCLUDED.valor_adicional,
         valor_domingo = EXCLUDED.valor_domingo,
         valor_domingo_adicional = EXCLUDED.valor_domingo_adicional,
         metadata = EXCLUDED.metadata,
         fecha_actualizacion = NOW()
       RETURNING id, centro_costo_id, horas_normal_limite, valor_normal, valor_adicional,
                 valor_domingo, valor_domingo_adicional, metadata, fecha_creacion, fecha_actualizacion`,
      [
        centroCostoId,
        horasNormalLimite,
        valorNormal,
        valorAdicional,
        valorDomingo,
        valorDomingoAdicional,
        JSON.stringify(metadata),
      ],
    );

    res.status(201).json({
      ok: true,
      registro: mapDbRowToValetFijoConfiguracion(result.rows[0]),
    });
  } catch (error) {
    console.error('[POST /api/valets/configuracion] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar configuracion de valets fijos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/valets/empleados', async (_req, res) => {
  try {
    await ensureValetFijoEmpleadoTable();

    const result = await pool.query(
      `SELECT id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre, valor_fijo,
              fecha_creacion, fecha_actualizacion
       FROM valet_fijo_empleado
       ORDER BY centro_costo_id ASC, empleado_nombre ASC`
    );

    res.status(200).json({
      ok: true,
      registros: result.rows.map(mapDbRowToValetFijoEmpleado),
    });
  } catch (error) {
    console.error('[GET /api/valets/empleados] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar empleados valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/valets/empleados', async (req, res) => {
  const centroCostoId = String(req.body?.centroCostoId || '').trim();
  const centroCostoNombre = String(req.body?.centroCostoNombre || '').trim();
  const empleadoCedula = String(req.body?.empleadoCedula || '').trim();
  const empleadoNombre = String(req.body?.empleadoNombre || '').trim();
  const valorFijo = parseValor(req.body?.valorFijo);

  if (!centroCostoId || !empleadoCedula) {
    res.status(400).json({ error: 'Los campos centroCostoId y empleadoCedula son requeridos' });
    return;
  }

  if (!Number.isFinite(valorFijo) || valorFijo < 0) {
    res.status(400).json({ error: 'El campo valorFijo debe ser numerico y mayor o igual a 0' });
    return;
  }

  try {
    await ensureValetFijoEmpleadoTable();

    const result = await pool.query(
      `INSERT INTO valet_fijo_empleado (
         centro_costo_id,
         centro_costo_nombre,
         empleado_cedula,
         empleado_nombre,
         valor_fijo,
         fecha_actualizacion
       )
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (centro_costo_id, empleado_cedula)
       DO UPDATE SET
         centro_costo_nombre = EXCLUDED.centro_costo_nombre,
         empleado_nombre = EXCLUDED.empleado_nombre,
         valor_fijo = EXCLUDED.valor_fijo,
         fecha_actualizacion = NOW()
       RETURNING id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre, valor_fijo,
                 fecha_creacion, fecha_actualizacion`,
      [centroCostoId, centroCostoNombre, empleadoCedula, empleadoNombre, valorFijo]
    );

    res.status(201).json({
      ok: true,
      registro: mapDbRowToValetFijoEmpleado(result.rows[0]),
    });
  } catch (error) {
    console.error('[POST /api/valets/empleados] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar empleado valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/valets/empleados', async (req, res) => {
  const centroCostoId = String(req.query.centroCostoId || '').trim();
  const empleadoCedula = String(req.query.empleadoCedula || '').trim();

  if (!centroCostoId || !empleadoCedula) {
    res.status(400).json({ error: 'Los parametros centroCostoId y empleadoCedula son requeridos' });
    return;
  }

  try {
    await ensureValetFijoEmpleadoTable();

    const result = await pool.query(
      `DELETE FROM valet_fijo_empleado
       WHERE centro_costo_id = $1 AND empleado_cedula = $2
       RETURNING id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre, valor_fijo,
                 fecha_creacion, fecha_actualizacion`,
      [centroCostoId, empleadoCedula]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'No se encontro el empleado en ese centro de costo' });
      return;
    }

    res.status(200).json({
      ok: true,
      registro: mapDbRowToValetFijoEmpleado(result.rows[0]),
    });
  } catch (error) {
    console.error('[DELETE /api/valets/empleados] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo eliminar empleado valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/valets/horarios', async (req, res) => {
  const centroCostoId = String(req.query.centroCostoId || '').trim();
  const empleadoCedula = String(req.query.empleadoCedula || '').trim();
  const fechaTurno = String(req.query.fechaTurno || '').trim();

  try {
    await ensureValetFijoHorarioTable();

    const filtros = [];
    const params = [];

    if (centroCostoId) {
      params.push(centroCostoId);
      filtros.push(`centro_costo_id = $${params.length}`);
    }

    if (empleadoCedula) {
      params.push(empleadoCedula);
      filtros.push(`empleado_cedula = $${params.length}`);
    }

    if (fechaTurno) {
      params.push(fechaTurno);
      filtros.push(`fecha_turno = $${params.length}::date`);
    }

    const whereSql = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre,
              fecha_turno, hora_entrada, hora_salida, es_adicional, aprobado, recurrencia, fin_recurrencia,
              observacion, evidencia_blob, evidencia_mime_type, evidencia_nombre_archivo,
              fecha_creacion, fecha_actualizacion
       FROM valet_fijo_horario
       ${whereSql}
       ORDER BY fecha_turno DESC, empleado_nombre ASC`,
      params
    );

    res.status(200).json({
      ok: true,
      registros: result.rows.map(mapDbRowToValetFijoHorario),
    });
  } catch (error) {
    console.error('[GET /api/valets/horarios] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar horarios valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});


app.post('/api/valets/horarios', async (req, res) => {
  const centroCostoId = String(req.body?.centroCostoId || '').trim();
  const centroCostoNombre = String(req.body?.centroCostoNombre || '').trim();
  const empleadoCedula = String(req.body?.empleadoCedula || '').trim();
  const empleadoNombre = String(req.body?.empleadoNombre || '').trim();
  const fechaTurnoRaw = String(req.body?.fechaTurno || req.body?.fecha || '').trim();
  const horaEntrada = String(req.body?.horaEntrada || '').trim();
  const horaSalida = String(req.body?.horaSalida || '').trim();
  const esAdicional = Boolean(req.body?.esAdicional || req.body?.adicional);
  const aprobado = req.body?.aprobado === undefined ? !esAdicional : Boolean(req.body?.aprobado);
  const recurrencia = Boolean(req.body?.recurrencia);
  const finRecurrenciaRaw = String(req.body?.finRecurrencia || '').trim();
  const observacion = String(req.body?.observacion || '').trim();
  const evidenciaBase64 = String(req.body?.evidenciaBase64 || '').trim();
  const evidenciaMimeType = String(req.body?.evidenciaMimeType || '').trim();
  const evidenciaNombreArchivo = String(req.body?.evidenciaNombreArchivo || '').trim();

  let finRecurrencia = null;
  if (finRecurrenciaRaw) {
    finRecurrencia = parseFechaIso(finRecurrenciaRaw);
    if (!finRecurrencia) {
      res.status(400).json({ error: 'finRecurrencia debe tener formato YYYY-MM-DD' });
      return;
    }
  }

  let evidenciaBlob = null;
  if (evidenciaBase64) {
    try {
      evidenciaBlob = Buffer.from(evidenciaBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'La evidencia enviada no tiene base64 valido' });
      return;
    }
  }

  if (!centroCostoId || !empleadoCedula) {
    res.status(400).json({ error: 'Los campos centroCostoId y empleadoCedula son requeridos' });
    return;
  }

  const fechaTurnoDate = parseFechaIso(fechaTurnoRaw);
  if (!fechaTurnoDate) {
    res.status(400).json({ error: 'Debe enviar fechaTurno valida con formato YYYY-MM-DD' });
    return;
  }

  if (!horaEntrada || !horaSalida) {
    res.status(400).json({ error: 'Los campos horaEntrada y horaSalida son requeridos' });
    return;
  }

  const horaEntradaMin = parseHora24AMinutos(horaEntrada);
  const horaSalidaMin = parseHora24AMinutos(horaSalida);

  if (horaEntradaMin === null || horaSalidaMin === null) {
    res.status(400).json({ error: 'horaEntrada y horaSalida deben tener formato HH:MM en 24 horas' });
    return;
  }

  if (horaSalidaMin <= horaEntradaMin) {
    res.status(400).json({ error: 'La hora de salida debe ser mayor que la hora de entrada' });
    return;
  }

  try {
    await ensureValetFijoHorarioTable();

    const fechaTurnoIso = formatoFechaIso(fechaTurnoDate);
    const existentesResult = await pool.query(
      `SELECT id, hora_entrada, hora_salida
       FROM valet_fijo_horario
       WHERE centro_costo_id = $1
         AND empleado_cedula = $2
         AND fecha_turno = $3::date`,
      [centroCostoId, empleadoCedula, fechaTurnoIso]
    );

    const tieneSolape = existentesResult.rows.some((row) => {
      const inicioExistente = parseHora24AMinutos(row.hora_entrada);
      const finExistente = parseHora24AMinutos(row.hora_salida);

      if (inicioExistente === null || finExistente === null) {
        return false;
      }

      return horariosSeSolapan(horaEntradaMin, horaSalidaMin, inicioExistente, finExistente);
    });

    if (tieneSolape) {
      res.status(409).json({
        error: 'El horario se cruza con otro turno existente para el mismo empleado en ese dia',
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO valet_fijo_horario (
         centro_costo_id,
         centro_costo_nombre,
         empleado_cedula,
         empleado_nombre,
         fecha_turno,
         hora_entrada,
         hora_salida,
         es_adicional,
         aprobado,
         recurrencia,
         fin_recurrencia,
         observacion,
         evidencia_blob,
         evidencia_mime_type,
         evidencia_nombre_archivo,
         fecha_actualizacion
       )
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11::date, $12, $13, $14, $15, NOW())
       RETURNING id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre,
                 fecha_turno, hora_entrada, hora_salida, es_adicional, aprobado, recurrencia, fin_recurrencia,
                 observacion, evidencia_blob, evidencia_mime_type, evidencia_nombre_archivo,
                 fecha_creacion, fecha_actualizacion`,
      [
        centroCostoId,
        centroCostoNombre,
        empleadoCedula,
        empleadoNombre,
        fechaTurnoIso,
        horaEntrada,
        horaSalida,
        esAdicional,
        aprobado,
        recurrencia,
        finRecurrencia ? formatoFechaIso(finRecurrencia) : null,
        observacion,
        evidenciaBlob,
        evidenciaMimeType,
        evidenciaNombreArchivo,
      ]
    );

    res.status(201).json({
      ok: true,
      registro: mapDbRowToValetFijoHorario(result.rows[0]),
    });
  } catch (error) {
    console.error('[POST /api/valets/horarios] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar horario valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.patch('/api/valets/horarios', async (req, res) => {
  const id = Number(req.body?.id);
  const finRecurrenciaRaw = String(req.body?.finRecurrencia || '').trim();

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El campo id es requerido y debe ser numerico' });
    return;
  }

  const finRecurrencia = parseFechaIso(finRecurrenciaRaw);
  if (!finRecurrencia) {
    res.status(400).json({ error: 'finRecurrencia debe tener formato YYYY-MM-DD' });
    return;
  }

  try {
    await ensureValetFijoHorarioTable();

    const result = await pool.query(
      `UPDATE valet_fijo_horario
       SET fin_recurrencia = $2::date,
           fecha_actualizacion = NOW()
       WHERE id = $1
       RETURNING id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre,
                 fecha_turno, hora_entrada, hora_salida, es_adicional, aprobado, recurrencia, fin_recurrencia,
                 observacion, evidencia_blob, evidencia_mime_type, evidencia_nombre_archivo,
                 fecha_creacion, fecha_actualizacion`,
      [id, formatoFechaIso(finRecurrencia)]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'No se encontro el horario solicitado' });
      return;
    }

    res.status(200).json({ ok: true, registro: mapDbRowToValetFijoHorario(result.rows[0]) });
  } catch (error) {
    console.error('[PATCH /api/valets/horarios] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo actualizar el fin de recurrencia del horario valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/valets/horarios', async (req, res) => {
  const idRaw = String(req.query.id || '').trim();
  const id = Number(idRaw);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parametro id es requerido y debe ser numerico' });
    return;
  }

  try {
    await ensureValetFijoHorarioTable();

    const result = await pool.query(
      `DELETE FROM valet_fijo_horario
       WHERE id = $1
       RETURNING id, centro_costo_id, centro_costo_nombre, empleado_cedula, empleado_nombre,
                 fecha_turno, hora_entrada, hora_salida, es_adicional, aprobado, recurrencia, fin_recurrencia,
                 observacion, evidencia_blob, evidencia_mime_type, evidencia_nombre_archivo,
                 fecha_creacion, fecha_actualizacion`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'No se encontro el horario solicitado' });
      return;
    }

    res.status(200).json({
      ok: true,
      registro: mapDbRowToValetFijoHorario(result.rows[0]),
    });
  } catch (error) {
    console.error('[DELETE /api/valets/horarios] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo eliminar horario valet fijo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/nomina/distribucion-plantillas', async (_req, res) => {
  try {
    await ensureDistribucionPlantillasTable();
    await ensureEmpleadoDistribucionPlantillaTable();

    const result = await pool.query(
      `SELECT
         p.id,
         p.nombre,
         p.centros,
         p.fecha_creacion,
         p.fecha_actualizacion,
         COALESCE(COUNT(ep.id), 0) AS total_empleados
       FROM distribucion_plantilla p
       LEFT JOIN empleado_distribucion_plantilla ep ON ep.plantilla_id = p.id
       GROUP BY p.id
       ORDER BY p.nombre ASC`
    );

    res.status(200).json({
      ok: true,
      plantillas: result.rows.map(mapDbRowToDistribucionPlantilla),
    });
  } catch (error) {
    console.error('[GET /api/nomina/distribucion-plantillas] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudieron cargar las plantillas de distribucion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/nomina/distribucion-plantillas', async (req, res) => {
  const plantillaId = Number(req.body?.plantillaId || 0);
  const nombre = String(req.body?.nombre || '').trim();
  const centros = Array.isArray(req.body?.centros) ? req.body.centros : [];

  if (!nombre) {
    res.status(400).json({ error: 'El campo nombre es requerido' });
    return;
  }

  if (centros.length === 0) {
    res.status(400).json({ error: 'Debe enviar al menos un centro de costo' });
    return;
  }

  const normalizados = [];
  const idsVistos = new Set();

  for (const item of centros) {
    const centroCostoId = String(item?.centroCostoId || item?.centro_costo_id || '').trim();
    const centroCostoNombre = String(item?.centroCostoNombre || item?.centro_costo_nombre || '').trim();
    const porcentaje = parseValor(item?.porcentaje);

    if (!centroCostoId || !centroCostoNombre) {
      res.status(400).json({ error: 'Cada centro debe incluir centroCostoId y centroCostoNombre' });
      return;
    }

    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      res.status(400).json({ error: 'Cada porcentaje debe ser numerico entre 0 y 100' });
      return;
    }

    if (idsVistos.has(centroCostoId)) {
      res.status(400).json({ error: 'No se permiten centros duplicados en la misma plantilla' });
      return;
    }

    idsVistos.add(centroCostoId);
    normalizados.push({ centroCostoId, centroCostoNombre, porcentaje });
  }

  const total = normalizados.reduce((acumulado, item) => acumulado + item.porcentaje, 0);
  if (Math.abs(total - 100) > 0.01) {
    res.status(400).json({ error: 'La suma de porcentajes debe ser 100%' });
    return;
  }

  try {
    await ensureDistribucionPlantillasTable();

    let result;
    if (Number.isFinite(plantillaId) && plantillaId > 0) {
      result = await pool.query(
        `UPDATE distribucion_plantilla
         SET nombre = $2,
             centros = $3::jsonb,
             fecha_actualizacion = NOW()
         WHERE id = $1
         RETURNING id, nombre, centros, fecha_creacion, fecha_actualizacion`,
        [plantillaId, nombre, JSON.stringify(normalizados)]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Plantilla no encontrada' });
        return;
      }
    } else {
      result = await pool.query(
        `INSERT INTO distribucion_plantilla (nombre, centros, fecha_actualizacion)
         VALUES ($1, $2::jsonb, NOW())
         RETURNING id, nombre, centros, fecha_creacion, fecha_actualizacion`,
        [nombre, JSON.stringify(normalizados)]
      );
    }

    const plantilla = mapDbRowToDistribucionPlantilla({
      ...result.rows[0],
      total_empleados: 0,
    });

    res.status(200).json({ ok: true, plantilla });
  } catch (error) {
    console.error('[POST /api/nomina/distribucion-plantillas] Error:', error instanceof Error ? error.message : String(error));
    const message = error instanceof Error ? error.message : '';
    if (message.includes('distribucion_plantilla_nombre_key')) {
      res.status(409).json({ error: 'Ya existe una plantilla con ese nombre' });
      return;
    }

    res.status(500).json({
      error: 'No se pudo guardar la plantilla de distribucion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/nomina/distribucion-plantillas/:plantillaId', async (req, res) => {
  const plantillaId = Number(req.params.plantillaId || 0);

  if (!Number.isFinite(plantillaId) || plantillaId <= 0) {
    res.status(400).json({ error: 'El parametro plantillaId es invalido' });
    return;
  }

  try {
    await ensureDistribucionPlantillasTable();

    const result = await pool.query(
      `DELETE FROM distribucion_plantilla
       WHERE id = $1`,
      [plantillaId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Plantilla no encontrada' });
      return;
    }

    res.status(200).json({ ok: true, plantillaId });
  } catch (error) {
    console.error('[DELETE /api/nomina/distribucion-plantillas/:plantillaId] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo eliminar la plantilla',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/nomina/distribucion-plantillas-empleados', async (_req, res) => {
  try {
    await ensureDistribucionPlantillasTable();
    await ensureEmpleadoDistribucionPlantillaTable();

    const result = await pool.query(
      `SELECT
         p.id AS plantilla_id,
         p.nombre AS plantilla_nombre,
         ep.empleado_id,
         ep.empleado_documento,
         ep.empleado_nombre_completo,
         ep.fecha_asignacion
       FROM distribucion_plantilla p
       LEFT JOIN empleado_distribucion_plantilla ep ON ep.plantilla_id = p.id
       ORDER BY p.nombre ASC, ep.empleado_nombre_completo ASC, ep.empleado_id ASC`
    );

    const map = new Map();
    for (const row of result.rows) {
      const plantillaId = Number(row.plantilla_id || 0);
      if (!plantillaId) continue;

      if (!map.has(plantillaId)) {
        map.set(plantillaId, {
          plantillaId,
          plantillaNombre: String(row.plantilla_nombre || '').trim(),
          empleados: [],
        });
      }

      if (row.empleado_id) {
        map.get(plantillaId).empleados.push({
          empleadoId: String(row.empleado_id || '').trim(),
          empleadoDocumento: String(row.empleado_documento || '').trim(),
          empleadoNombreCompleto: String(row.empleado_nombre_completo || '').trim(),
          fechaAsignacion: row.fecha_asignacion,
        });
      }
    }

    res.status(200).json({ ok: true, plantillas: Array.from(map.values()) });
  } catch (error) {
    console.error('[GET /api/nomina/distribucion-plantillas-empleados] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudieron cargar las asignaciones por plantilla',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/nomina/distribucion-plantillas-empleados', async (req, res) => {
  const plantillaId = Number(req.body?.plantillaId || 0);
  const empleadoId = String(req.body?.empleadoId || '').trim();
  const empleadoDocumento = String(req.body?.empleadoDocumento || '').trim();
  const empleadoNombreCompleto = String(req.body?.empleadoNombreCompleto || '').trim();

  if (!Number.isFinite(plantillaId) || plantillaId <= 0) {
    res.status(400).json({ error: 'El campo plantillaId es invalido' });
    return;
  }
  if (!empleadoId) {
    res.status(400).json({ error: 'El campo empleadoId es requerido' });
    return;
  }
  if (!empleadoNombreCompleto) {
    res.status(400).json({ error: 'El campo empleadoNombreCompleto es requerido' });
    return;
  }

  try {
    await ensureDistribucionPlantillasTable();
    await ensureEmpleadoDistribucionPlantillaTable();

    const plantillaExiste = await pool.query(
      `SELECT id, nombre FROM distribucion_plantilla WHERE id = $1`,
      [plantillaId]
    );

    if (plantillaExiste.rowCount === 0) {
      res.status(404).json({ error: 'Plantilla no encontrada' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO empleado_distribucion_plantilla (
         plantilla_id,
         empleado_id,
         empleado_documento,
         empleado_nombre_completo,
         fecha_actualizacion
       )
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (empleado_id)
       DO UPDATE SET
         plantilla_id = EXCLUDED.plantilla_id,
         empleado_documento = EXCLUDED.empleado_documento,
         empleado_nombre_completo = EXCLUDED.empleado_nombre_completo,
         fecha_actualizacion = NOW()
       RETURNING plantilla_id, empleado_id, empleado_documento, empleado_nombre_completo, fecha_asignacion, fecha_actualizacion`,
      [plantillaId, empleadoId, empleadoDocumento, empleadoNombreCompleto]
    );

    res.status(200).json({
      ok: true,
      asignacion: {
        plantillaId: Number(result.rows[0].plantilla_id || 0),
        empleadoId: String(result.rows[0].empleado_id || '').trim(),
        empleadoDocumento: String(result.rows[0].empleado_documento || '').trim(),
        empleadoNombreCompleto: String(result.rows[0].empleado_nombre_completo || '').trim(),
        fechaAsignacion: result.rows[0].fecha_asignacion,
        fechaActualizacion: result.rows[0].fecha_actualizacion,
      },
    });
  } catch (error) {
    console.error('[POST /api/nomina/distribucion-plantillas-empleados] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar la asignacion del empleado',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/nomina/distribucion-plantillas-empleados/:plantillaId/:empleadoId', async (req, res) => {
  const plantillaId = Number(req.params.plantillaId || 0);
  const empleadoId = String(req.params.empleadoId || '').trim();

  if (!Number.isFinite(plantillaId) || plantillaId <= 0) {
    res.status(400).json({ error: 'El parametro plantillaId es invalido' });
    return;
  }
  if (!empleadoId) {
    res.status(400).json({ error: 'El parametro empleadoId es requerido' });
    return;
  }

  try {
    await ensureEmpleadoDistribucionPlantillaTable();

    const result = await pool.query(
      `DELETE FROM empleado_distribucion_plantilla
       WHERE plantilla_id = $1
         AND empleado_id = $2`,
      [plantillaId, empleadoId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Asignacion no encontrada' });
      return;
    }

    res.status(200).json({ ok: true, plantillaId, empleadoId });
  } catch (error) {
    console.error('[DELETE /api/nomina/distribucion-plantillas-empleados/:plantillaId/:empleadoId] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo eliminar la asignacion del empleado',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================================================
// ENDPOINTS Y FUNCIONES PARA ÓRDENES DE ACCESORIOS
// =====================================================

const ensureAccesoriosTable = async () => {
  // Tabla de solicitudes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_accesorios (
      id VARCHAR(50) PRIMARY KEY,
      fecha TIMESTAMP NOT NULL,
      estado VARCHAR(50) NOT NULL CHECK (estado IN ('creada', 'orden_generada', 'pedido_realizado')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_solicitudes_accesorios_fecha
      ON solicitudes_accesorios (fecha DESC)
  `);

  // Tabla de líneas de solicitud
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lineas_solicitud (
      id VARCHAR(50) PRIMARY KEY,
      solicitud_id VARCHAR(50) NOT NULL REFERENCES solicitudes_accesorios(id) ON DELETE CASCADE,
      empleado_nombre VARCHAR(255) NOT NULL,
      empleado_cedula VARCHAR(20) NOT NULL,
      centro_costo VARCHAR(100) NOT NULL,
      accesorio VARCHAR(50) NOT NULL CHECK (accesorio IN ('botas', 'auriculares')),
      talla VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS acta BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS cuotas VARCHAR(50)
  `);

  await pool.query(`
    ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS valor NUMERIC(18,4)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lineas_solicitud_solicitud
      ON lineas_solicitud (solicitud_id)
  `);

  await pool.query('DROP TABLE IF EXISTS ordenes_accesorios CASCADE');

  // Tabla de metadata de archivos subidos (sin contenido)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS archivos_accesorios (
      id BIGSERIAL PRIMARY KEY,
      solicitud_id VARCHAR(50) NOT NULL REFERENCES solicitudes_accesorios(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('orden', 'acta')),
      nombre_archivo VARCHAR(255) NOT NULL,
      ruta_archivo TEXT,
      accesorio VARCHAR(50) CHECK (accesorio IN ('botas', 'auriculares')),
      empleado_cedula VARCHAR(20),
      numero_orden VARCHAR(100),
      total_valor NUMERIC(18, 4) NOT NULL DEFAULT 0,
      fecha_carga TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_archivos_accesorios_solicitud
      ON archivos_accesorios (solicitud_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_archivos_accesorios_tipo
      ON archivos_accesorios (tipo)
  `);

  await pool.query(`
    ALTER TABLE archivos_accesorios
    ADD COLUMN IF NOT EXISTS ruta_archivo TEXT
  `);
};

// Endpoints para solicitudes
app.get('/api/accesorios/solicitudes', async (req, res) => {
  try {
    await ensureAccesoriosTable();
    
    const result = await pool.query(`
      SELECT 
        s.id, s.fecha, s.estado,
        COALESCE(
          json_agg(
            json_build_object(
              'id', l.id,
              'empleadoNombre', l.empleado_nombre,
              'empleadoCedula', l.empleado_cedula,
              'centroCosto', l.centro_costo,
              'accesorio', l.accesorio,
              'talla', l.talla,
              'acta', l.acta,
              'numeroFactura', l.numero_factura,
              'cuotas', l.cuotas,
              'valor', l.valor
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) as filas
      FROM solicitudes_accesorios s
      LEFT JOIN lineas_solicitud l ON l.solicitud_id = s.id
      GROUP BY s.id
      ORDER BY s.fecha DESC
    `);

    res.status(200).json({
      ok: true,
      solicitudes: result.rows.map(row => ({
        id: row.id,
        fecha: row.fecha.toLocaleDateString('es-ES'),
        filas: Array.isArray(row.filas) ? row.filas : [],
        estado: row.estado,
      })),
    });
  } catch (error) {
    console.error('[GET /api/accesorios/solicitudes] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar las solicitudes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/accesorios/solicitudes', async (req, res) => {
  const solicitudId = String(req.body?.id || '').trim();
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
  const estado = String(req.body?.estado || 'creada').trim();

  if (!solicitudId || filas.length === 0) {
    res.status(400).json({ error: 'Se requiere id y al menos una fila' });
    return;
  }

  try {
    await ensureAccesoriosTable();
    
    // Verificar si ya existe
    const existe = await pool.query(
      'SELECT id FROM solicitudes_accesorios WHERE id = $1',
      [solicitudId]
    );

    if (existe.rows.length > 0) {
      res.status(400).json({ error: 'La solicitud ya existe' });
      return;
    }

    await pool.query('BEGIN');

    // Insertar solicitud
    await pool.query(
      `INSERT INTO solicitudes_accesorios (id, fecha, estado)
       VALUES ($1, $2, $3)`,
      [solicitudId, new Date(), estado]
    );

    // Insertar filas
    for (const fila of filas) {
      await pool.query(
        `INSERT INTO lineas_solicitud 
         (id, solicitud_id, empleado_nombre, empleado_cedula, centro_costo, accesorio, talla)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          fila.id,
          solicitudId,
          String(fila.empleadoNombre || ''),
          String(fila.empleadoCedula || ''),
          String(fila.centroCosto || ''),
          String(fila.accesorio || ''),
          String(fila.talla || ''),
        ]
      );
    }

    await pool.query('COMMIT');

    res.status(201).json({
      ok: true,
      solicitudId,
      filasGuardadas: filas.length,
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/accesorios/solicitudes] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar la solicitud',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.put('/api/accesorios/solicitudes/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const estado = String(req.body?.estado || '').trim();

  if (!id || !estado) {
    res.status(400).json({ error: 'Se requiere id y estado' });
    return;
  }

  try {
    await ensureAccesoriosTable();
    
    const result = await pool.query(
      `UPDATE solicitudes_accesorios 
       SET estado = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitud no encontrada' });
      return;
    }

    res.status(200).json({
      ok: true,
      solicitud: result.rows[0],
    });
  } catch (error) {
    console.error('[PUT /api/accesorios/solicitudes/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo actualizar la solicitud',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoints para órdenes de compra
app.get('/api/accesorios/ordenes', async (req, res) => {
  try {
    await ensureAccesoriosTable();
    const archivosResult = await pool.query(`
      SELECT
        solicitud_id,
        accesorio,
        LOWER(TRIM(tipo)) AS tipo,
        nombre_archivo,
        numero_orden,
        total_valor,
        fecha_carga
      FROM archivos_accesorios
      WHERE LOWER(TRIM(tipo)) IN ('orden', 'acta')
        AND NULLIF(TRIM(COALESCE(accesorio, '')), '') IS NOT NULL
      ORDER BY fecha_carga DESC
    `);

    const grouped = new Map();

    for (const row of archivosResult.rows) {
      const solicitudId = String(row.solicitud_id || '').trim();
      const accesorio = String(row.accesorio || '').trim();
      const tipo = String(row.tipo || '').trim();

      if (!solicitudId || !accesorio || (tipo !== 'orden' && tipo !== 'acta')) {
        continue;
      }

      if (!grouped.has(solicitudId)) {
        grouped.set(solicitudId, {
          solicitudId,
          numeroOrden: '',
          totalValor: 0,
          fecha: '',
          filas: [],
          archivoOrdenNombre: undefined,
          ordenesPorAccesorio: {},
          numeroFactura: undefined,
          cuotasPorAccesorio: {},
        });
      }

      const current = grouped.get(solicitudId);
      const detalleActual = current.ordenesPorAccesorio[accesorio] || {
        numeroOrden: '',
        totalValor: 0,
        fecha: row.fecha_carga ? new Date(row.fecha_carga).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES'),
      };

      const nombreArchivo = String(row.nombre_archivo || '').trim();
      const numeroOrden = String(row.numero_orden || '').trim();
      const totalValor = Number(row.total_valor || 0);

      if (tipo === 'orden') {
        if (!detalleActual.archivoOrdenNombre && nombreArchivo) {
          detalleActual.archivoOrdenNombre = nombreArchivo;
        }
        if (!detalleActual.numeroOrden && numeroOrden) {
          detalleActual.numeroOrden = numeroOrden;
        }
        if ((!detalleActual.totalValor || Number(detalleActual.totalValor) <= 0) && Number.isFinite(totalValor) && totalValor > 0) {
          detalleActual.totalValor = totalValor;
        }
      }

      current.ordenesPorAccesorio[accesorio] = detalleActual;
    }

    const ordenes = Array.from(grouped.values()).map((item) => {
      const detalles = Object.values(item.ordenesPorAccesorio || {});
      const numerosOrden = detalles
        .map((detalle) => String(detalle?.numeroOrden || '').trim())
        .filter(Boolean);
      const totalValor = detalles.reduce((acc, detalle) => acc + Number(detalle?.totalValor || 0), 0);
      const fecha = String(detalles[0]?.fecha || '');
      const totalOrdenesConArchivo = detalles.filter((detalle) => Boolean(detalle?.archivoOrdenNombre)).length;

      return {
        ...item,
        numeroOrden: numerosOrden.join(' / '),
        totalValor,
        fecha,
        archivoOrdenNombre:
          totalOrdenesConArchivo > 0
            ? totalOrdenesConArchivo === 1
              ? detalles.find((detalle) => detalle?.archivoOrdenNombre)?.archivoOrdenNombre
              : `${totalOrdenesConArchivo} ordenes cargadas`
            : undefined,
      };
    });

    // Adjuntamos filas de empleados por solicitud para que RevisionView tenga detalle
    const solicitudIds = ordenes.map((item) => String(item.solicitudId || '').trim()).filter(Boolean);
    if (solicitudIds.length > 0) {
      const filasResult = await pool.query(
        `SELECT
           id,
           solicitud_id,
           empleado_nombre,
           empleado_cedula,
           centro_costo,
           accesorio,
           talla,
           acta,
           numero_factura,
           cuotas,
           valor
         FROM lineas_solicitud
         WHERE solicitud_id = ANY($1::varchar[])
         ORDER BY solicitud_id ASC, created_at ASC`,
        [solicitudIds]
      );

      const filasPorSolicitud = new Map();
      for (const fila of filasResult.rows) {
        const solicitudId = String(fila.solicitud_id || '').trim();
        if (!solicitudId) {
          continue;
        }

        if (!filasPorSolicitud.has(solicitudId)) {
          filasPorSolicitud.set(solicitudId, []);
        }

        filasPorSolicitud.get(solicitudId).push({
          id: String(fila.id || ''),
          empleadoNombre: String(fila.empleado_nombre || ''),
          empleadoCedula: String(fila.empleado_cedula || ''),
          centroCosto: String(fila.centro_costo || ''),
          accesorio: String(fila.accesorio || ''),
          talla: String(fila.talla || ''),
          acta: Boolean(fila.acta),
          numeroFactura: String(fila.numero_factura || '').trim() || undefined,
          cuotas: String(fila.cuotas || '').trim() || undefined,
          valor: fila.valor != null ? Number(fila.valor) : undefined,
        });
      }

      for (const orden of ordenes) {
        const filasOrden = filasPorSolicitud.get(String(orden.solicitudId || '').trim()) || [];
        orden.filas = filasOrden;

        const facturasPorAccesorio = {};
        for (const fila of filasOrden) {
          const acc = String(fila.accesorio || '').trim();
          const factura = String(fila.numeroFactura || '').trim();
          if (acc && factura && !facturasPorAccesorio[acc]) {
            facturasPorAccesorio[acc] = factura;
          }
        }
        orden.facturasPorAccesorio = Object.keys(facturasPorAccesorio).length > 0 ? facturasPorAccesorio : undefined;

        const cuotasPorAccesorio = {};
        for (const fila of filasOrden) {
          if (String(fila.cuotas || '').trim()) {
            cuotasPorAccesorio[fila.id] = String(fila.cuotas || '').trim();
          }
        }
        orden.cuotasPorAccesorio = cuotasPorAccesorio;
      }
    }

    res.status(200).json({
      ok: true,
      ordenes,
    });
  } catch (error) {
    console.error('[GET /api/accesorios/ordenes] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar las órdenes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/accesorios/ordenes', async (req, res) => {
  const solicitudId = String(req.body?.solicitudId || '').trim();
  const facturasPorAccesorio = req.body?.facturasPorAccesorio || {};
  const cuotasPorAccesorio = req.body?.cuotasPorAccesorio || {};

  const facturasValidas = Object.entries(facturasPorAccesorio).filter(([, v]) => String(v || '').trim());

  if (!solicitudId || facturasValidas.length === 0) {
    res.status(400).json({ error: 'Se requiere solicitudId y al menos un numero de factura' });
    return;
  }

  try {
    await ensureAccesoriosTable();

    await pool.query('BEGIN');

    const solicitudExiste = await pool.query(
      `SELECT id FROM solicitudes_accesorios WHERE id = $1`,
      [solicitudId]
    );

    if (solicitudExiste.rows.length === 0) {
      await pool.query('ROLLBACK');
      res.status(404).json({ error: 'Solicitud no encontrada' });
      return;
    }

    for (const [accesorio, factura] of facturasValidas) {
      await pool.query(
        `UPDATE lineas_solicitud
         SET numero_factura = $1
         WHERE solicitud_id = $2
           AND accesorio = $3`,
        [String(factura).trim(), solicitudId, String(accesorio)]
      );
    }

    for (const [lineaId, cuota] of Object.entries(cuotasPorAccesorio)) {
      const cuotaNormalizada = String(cuota || '').trim();
      if (!cuotaNormalizada) {
        continue;
      }

      await pool.query(
        `UPDATE lineas_solicitud
         SET cuotas = $1
         WHERE id = $2
           AND solicitud_id = $3`,
        [cuotaNormalizada, String(lineaId), solicitudId]
      );
    }

    await pool.query('COMMIT');

    res.status(201).json({
      ok: true,
      solicitudId,
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/accesorios/ordenes] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar la revision',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/accesorios/archivos', async (req, res) => {
  const solicitudId = String(req.body?.solicitudId || '').trim();
  const tipo = String(req.body?.tipo || '').trim();
  const nombreArchivo = String(req.body?.nombreArchivo || '').trim();
  const rutaArchivo = String(req.body?.rutaArchivo || '').trim();
  const accesorio = String(req.body?.accesorio || '').trim();
  const empleadoCedula = String(req.body?.empleadoCedula || '').trim();
  const numeroOrden = String(req.body?.numeroOrden || '').trim();
  const totalValor = parseValor(req.body?.totalValor);

  if (!solicitudId || !tipo || !nombreArchivo) {
    res.status(400).json({ error: 'Se requiere solicitudId, tipo y nombreArchivo' });
    return;
  }

  if (tipo === 'orden' && !rutaArchivo) {
    res.status(400).json({ error: 'Para ordenes de compra se requiere rutaArchivo (Supabase)' });
    return;
  }

  try {
    await ensureAccesoriosTable();

    const result = await pool.query(
      `INSERT INTO archivos_accesorios
       (solicitud_id, tipo, nombre_archivo, ruta_archivo, accesorio, empleado_cedula, numero_orden, total_valor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, solicitud_id, tipo, nombre_archivo, ruta_archivo, accesorio, empleado_cedula, numero_orden, total_valor, fecha_carga`,
      [
        solicitudId,
        tipo,
        nombreArchivo,
        rutaArchivo || null,
        accesorio || null,
        empleadoCedula || null,
        numeroOrden || null,
        Number.isFinite(totalValor) ? totalValor : 0,
      ]
    );

    if (tipo === 'acta' && empleadoCedula) {
      await pool.query(
        `UPDATE lineas_solicitud
         SET acta = TRUE
         WHERE solicitud_id = $1
           AND empleado_cedula = $2`,
        [
          solicitudId,
          empleadoCedula,
        ]
      );
    }

    if (tipo === 'orden' && accesorio && Number.isFinite(totalValor) && totalValor > 0) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM lineas_solicitud
         WHERE solicitud_id = $1
           AND accesorio = $2`,
        [solicitudId, accesorio]
      );
      const count = Number(countResult.rows[0]?.cnt || 0);
      if (count > 0) {
        const valorPorPersona = totalValor / count;
        await pool.query(
          `UPDATE lineas_solicitud
           SET valor = $1
           WHERE solicitud_id = $2
             AND accesorio = $3`,
          [valorPorPersona, solicitudId, accesorio]
        );
      }
    }

    res.status(201).json({
      ok: true,
      registro: result.rows[0],
    });
  } catch (error) {
    console.error('[POST /api/accesorios/archivos] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo guardar metadata de archivo',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/accesorios/archivos/:solicitudId', async (req, res) => {
  const solicitudId = String(req.params.solicitudId || '').trim();

  if (!solicitudId) {
    res.status(400).json({ error: 'Se requiere solicitudId' });
    return;
  }

  try {
    await ensureAccesoriosTable();

    const result = await pool.query(
      `SELECT
         id,
         solicitud_id,
         tipo,
         nombre_archivo,
         ruta_archivo,
         accesorio,
         empleado_cedula,
         numero_orden,
         total_valor,
         fecha_carga
       FROM archivos_accesorios
       WHERE solicitud_id = $1
       ORDER BY fecha_carga DESC`,
      [solicitudId]
    );

    res.status(200).json({
      ok: true,
      archivos: result.rows,
    });
  } catch (error) {
    console.error('[GET /api/accesorios/archivos/:solicitudId] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'No se pudo cargar metadata de archivos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/* ─────────────────────── PROYECTOS: PLANTILLA PROVEEDOR ─────────────────────── */

const ensurePlantillaProveedorTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor_Categorias" (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      proveedor VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor" (
      id BIGSERIAL PRIMARY KEY,
      codigo VARCHAR(30) NOT NULL,
      categoria_id BIGINT NOT NULL REFERENCES "Plantilla_Proveedor_Categorias"(id) ON DELETE RESTRICT,
      nombre_equipo VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor_Componentes" (
      id BIGSERIAL PRIMARY KEY,
      equipo_id BIGINT NOT NULL REFERENCES "Plantilla_Proveedor"(id) ON DELETE CASCADE,
      nombre VARCHAR(150) NOT NULL,
      costo NUMERIC(14,2),
      moneda VARCHAR(3),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const generarCodigoEquipo = (proveedor, categoriaNombre, nombreEquipo) => {
  const prefijo = (texto) => String(texto || '').trim().substring(0, 3).toUpperCase() || '---';
  return `${prefijo(proveedor)}-${prefijo(categoriaNombre)}-${prefijo(nombreEquipo)}`;
};

app.get('/api/proyectos/plantilla-proveedor/categorias', async (_req, res) => {
  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(
      `SELECT id, nombre, proveedor, created_at FROM "Plantilla_Proveedor_Categorias" ORDER BY nombre ASC`
    );
    res.status(200).json({ categorias: result.rows });
  } catch (error) {
    console.error('[GET /api/proyectos/plantilla-proveedor/categorias] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudieron obtener las categorías', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/proyectos/plantilla-proveedor/categorias', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const proveedor = String(req.body?.proveedor || '').trim();

  if (!nombre || !proveedor) {
    res.status(400).json({ error: 'Los campos nombre y proveedor son requeridos' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(
      `INSERT INTO "Plantilla_Proveedor_Categorias" (nombre, proveedor) VALUES ($1, $2) RETURNING id, nombre, proveedor, created_at`,
      [nombre, proveedor]
    );
    res.status(201).json({ categoria: result.rows[0] });
  } catch (error) {
    console.error('[POST /api/proyectos/plantilla-proveedor/categorias] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo crear la categoría', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/proyectos/plantilla-proveedor/categorias/:id', async (req, res) => {
  const id = Number(req.params.id);
  const nombre = String(req.body?.nombre || '').trim();
  const proveedor = String(req.body?.proveedor || '').trim();

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parámetro id es inválido' });
    return;
  }
  if (!nombre || !proveedor) {
    res.status(400).json({ error: 'Los campos nombre y proveedor son requeridos' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(
      `UPDATE "Plantilla_Proveedor_Categorias" SET nombre = $2, proveedor = $3 WHERE id = $1 RETURNING id, nombre, proveedor, created_at`,
      [id, nombre, proveedor]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }
    res.status(200).json({ categoria: result.rows[0] });
  } catch (error) {
    console.error('[PUT /api/proyectos/plantilla-proveedor/categorias/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo actualizar la categoría', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/proyectos/plantilla-proveedor/categorias/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parámetro id es inválido' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(`DELETE FROM "Plantilla_Proveedor_Categorias" WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    if (error && error.code === '23503') {
      res.status(409).json({ error: 'No se puede eliminar: hay equipos que usan esta categoría' });
      return;
    }
    console.error('[DELETE /api/proyectos/plantilla-proveedor/categorias/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo eliminar la categoría', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/proyectos/plantilla-proveedor/equipos', async (_req, res) => {
  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(`
      SELECT
        e.id, e.codigo, e.nombre_equipo, e.created_at,
        c.id AS categoria_id, c.nombre AS categoria_nombre, c.proveedor,
        COUNT(comp.id)::int AS componentes_count,
        COALESCE(SUM(comp.costo), 0) AS costo_total,
        MIN(comp.moneda) AS moneda
      FROM "Plantilla_Proveedor" e
      JOIN "Plantilla_Proveedor_Categorias" c ON c.id = e.categoria_id
      LEFT JOIN "Plantilla_Proveedor_Componentes" comp ON comp.equipo_id = e.id
      GROUP BY e.id, e.codigo, e.nombre_equipo, e.created_at, c.id, c.nombre, c.proveedor
      ORDER BY e.created_at DESC
    `);
    res.status(200).json({ equipos: result.rows });
  } catch (error) {
    console.error('[GET /api/proyectos/plantilla-proveedor/equipos] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudieron obtener los equipos', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/proyectos/plantilla-proveedor/equipos', async (req, res) => {
  const categoriaId = Number(req.body?.categoriaId);
  const nombreEquipo = String(req.body?.nombreEquipo || '').trim();

  if (!Number.isInteger(categoriaId) || categoriaId <= 0 || !nombreEquipo) {
    res.status(400).json({ error: 'Los campos categoriaId y nombreEquipo son requeridos' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();

    const categoria = await pool.query(
      `SELECT id, nombre, proveedor FROM "Plantilla_Proveedor_Categorias" WHERE id = $1`,
      [categoriaId]
    );
    if (categoria.rowCount === 0) {
      res.status(404).json({ error: 'La categoría seleccionada no existe' });
      return;
    }

    const codigo = generarCodigoEquipo(categoria.rows[0].proveedor, categoria.rows[0].nombre, nombreEquipo);

    const result = await pool.query(
      `INSERT INTO "Plantilla_Proveedor" (codigo, categoria_id, nombre_equipo) VALUES ($1, $2, $3)
       RETURNING id, codigo, nombre_equipo, categoria_id, created_at`,
      [codigo, categoriaId, nombreEquipo]
    );

    res.status(201).json({
      equipo: {
        ...result.rows[0],
        categoria_nombre: categoria.rows[0].nombre,
        proveedor: categoria.rows[0].proveedor,
        componentes_count: 0,
        costo_total: 0,
        moneda: null,
      },
    });
  } catch (error) {
    console.error('[POST /api/proyectos/plantilla-proveedor/equipos] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo crear el equipo', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/proyectos/plantilla-proveedor/equipos/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parámetro id es inválido' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();

    const equipo = await pool.query(`
      SELECT e.id, e.codigo, e.nombre_equipo, e.created_at,
             c.id AS categoria_id, c.nombre AS categoria_nombre, c.proveedor
      FROM "Plantilla_Proveedor" e
      JOIN "Plantilla_Proveedor_Categorias" c ON c.id = e.categoria_id
      WHERE e.id = $1
    `, [id]);

    if (equipo.rowCount === 0) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }

    const componentes = await pool.query(
      `SELECT id, nombre, costo, moneda, created_at FROM "Plantilla_Proveedor_Componentes" WHERE equipo_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    res.status(200).json({ equipo: equipo.rows[0], componentes: componentes.rows });
  } catch (error) {
    console.error('[GET /api/proyectos/plantilla-proveedor/equipos/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo obtener el detalle del equipo', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/proyectos/plantilla-proveedor/equipos/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parámetro id es inválido' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(`DELETE FROM "Plantilla_Proveedor" WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/proyectos/plantilla-proveedor/equipos/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo eliminar el equipo', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/proyectos/plantilla-proveedor/equipos/:id/componentes', async (req, res) => {
  const equipoId = Number(req.params.id);
  const nombre = String(req.body?.nombre || '').trim();
  const tieneCosto = req.body?.costo !== undefined && req.body?.costo !== null && req.body?.costo !== '';
  const costo = tieneCosto ? Number(req.body.costo) : null;
  const moneda = tieneCosto ? String(req.body?.moneda || '').trim().toUpperCase() : null;

  if (!Number.isInteger(equipoId) || equipoId <= 0 || !nombre) {
    res.status(400).json({ error: 'Los campos nombre son requeridos' });
    return;
  }
  if (tieneCosto && (!Number.isFinite(costo) || costo < 0)) {
    res.status(400).json({ error: 'El costo debe ser un número válido' });
    return;
  }
  if (tieneCosto && !moneda) {
    res.status(400).json({ error: 'Debe indicar la moneda del costo' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();

    const equipoExiste = await pool.query(`SELECT id FROM "Plantilla_Proveedor" WHERE id = $1`, [equipoId]);
    if (equipoExiste.rowCount === 0) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }

    if (tieneCosto) {
      const monedaExistente = await pool.query(
        `SELECT DISTINCT moneda FROM "Plantilla_Proveedor_Componentes" WHERE equipo_id = $1 AND moneda IS NOT NULL LIMIT 1`,
        [equipoId]
      );
      const monedaActual = monedaExistente.rows[0]?.moneda;
      if (monedaActual && monedaActual !== moneda) {
        res.status(409).json({
          error: `Este equipo ya tiene componentes en ${monedaActual}. Debe usar la misma moneda (${monedaActual}) para todos los componentes del equipo.`,
        });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO "Plantilla_Proveedor_Componentes" (equipo_id, nombre, costo, moneda) VALUES ($1, $2, $3, $4)
       RETURNING id, equipo_id, nombre, costo, moneda, created_at`,
      [equipoId, nombre, costo, moneda]
    );

    res.status(201).json({ componente: result.rows[0] });
  } catch (error) {
    console.error('[POST /api/proyectos/plantilla-proveedor/equipos/:id/componentes] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo agregar el componente', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/proyectos/plantilla-proveedor/componentes/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El parámetro id es inválido' });
    return;
  }

  try {
    await ensurePlantillaProveedorTables();
    const result = await pool.query(`DELETE FROM "Plantilla_Proveedor_Componentes" WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Componente no encontrado' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/proyectos/plantilla-proveedor/componentes/:id] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo eliminar el componente', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/* ─────────────────────── PROYECTOS: INVERSIONES ─────────────────────── */

const ensureInversionesProyectosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Inversiones_Proyectos" (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      moneda VARCHAR(3) NOT NULL,
      conversion NUMERIC(14,4),
      desaduanizacion NUMERIC(14,2),
      utilidad NUMERIC(6,2),
      estado VARCHAR(30) NOT NULL DEFAULT 'Creado',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

app.get('/api/proyectos/inversiones', async (_req, res) => {
  try {
    await ensureInversionesProyectosTable();
    const result = await pool.query(
      `SELECT id, nombre, moneda, conversion, desaduanizacion, utilidad, estado, created_at
       FROM "Inversiones_Proyectos" ORDER BY created_at DESC`
    );
    res.status(200).json({ inversiones: result.rows });
  } catch (error) {
    console.error('[GET /api/proyectos/inversiones] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudieron obtener las inversiones', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/proyectos/inversiones', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const moneda = String(req.body?.moneda || '').trim().toUpperCase();
  const conversion = req.body?.conversion !== undefined && req.body?.conversion !== '' ? Number(req.body.conversion) : null;
  const desaduanizacion = req.body?.desaduanizacion !== undefined && req.body?.desaduanizacion !== '' ? Number(req.body.desaduanizacion) : null;
  const utilidad = req.body?.utilidad !== undefined && req.body?.utilidad !== '' ? Number(req.body.utilidad) : null;

  if (!nombre) {
    res.status(400).json({ error: 'El campo nombre es requerido' });
    return;
  }
  if (!moneda) {
    res.status(400).json({ error: 'El campo moneda es requerido' });
    return;
  }

  try {
    await ensureInversionesProyectosTable();
    const result = await pool.query(
      `INSERT INTO "Inversiones_Proyectos" (nombre, moneda, conversion, desaduanizacion, utilidad, estado)
       VALUES ($1, $2, $3, $4, $5, 'Creado')
       RETURNING id, nombre, moneda, conversion, desaduanizacion, utilidad, estado, created_at`,
      [nombre, moneda, conversion, desaduanizacion, utilidad]
    );
    res.status(201).json({ inversion: result.rows[0] });
  } catch (error) {
    console.error('[POST /api/proyectos/inversiones] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'No se pudo crear la inversión', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const startServer = async () => {
  try {
    const connInfo = getDatabaseConnectionInfo();
    console.log(`DB connection host: ${connInfo.host} (${connInfo.usingPooler ? 'pooler' : 'direct'})`);

    await checkPostgresConnection();

    if (isSqlServerEnabled()) {
      await checkSqlServerConnection();
      console.log('Conexion SQL Server OK');
    } else {
      console.log('SQL Server deshabilitado (SQLSERVER_ENABLED=false)');
    }

    await ensureHumanaCedulaColumn();
    await ensureDescuentosTable();
    await ensureExentosPagoSeguroTable();
    await ensureValetFijoEmpleadoTable();
    await ensureValetFijoHorarioTable();
    await ensureValetFijoCentroTable();
    await ensureValetFijoConfiguracionTable();
    await ensureDistribucionPlantillasTable();
    await ensureEmpleadoDistribucionPlantillaTable();
    await ensureAccesoriosTable();
    await ensurePlantillaProveedorTables();
    await ensureInversionesProyectosTable();
    app.listen(PORT, () => {
      console.log(`humana-backend escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo inicializar backend:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

if (process.env.VERCEL !== '1') {
  void startServer();
} else {
  const connInfo = getDatabaseConnectionInfo();
  console.log(`DB connection host: ${connInfo.host} (${connInfo.usingPooler ? 'pooler' : 'direct'})`);
}

export default app;