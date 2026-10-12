SET ROLE sitec_backend; SET search_path TO public;
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
    );

ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS codigo_centro_costo TEXT;

ALTER TABLE incidents_discount_nomina
    ADD COLUMN IF NOT EXISTS observacion TEXT;

UPDATE incidents_discount_nomina
    SET codigo_centro_costo = ''
    WHERE codigo_centro_costo IS NULL;

UPDATE incidents_discount_nomina
    SET observacion = ''
    WHERE observacion IS NULL;

UPDATE incidents_discount_nomina
    SET estado = 'pendiente revision'
    WHERE estado IS NULL
      OR TRIM(estado) = ''
      OR LOWER(TRIM(estado)) IN ('pendiente', 'pendiente revision');

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN estado SET DEFAULT 'pendiente revision';

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN estado SET NOT NULL;

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN codigo_centro_costo SET DEFAULT '';

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN codigo_centro_costo SET NOT NULL;

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN observacion SET DEFAULT '';

ALTER TABLE incidents_discount_nomina
    ALTER COLUMN observacion SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_discount_nomina_periodo
      ON incidents_discount_nomina (periodo DESC, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS humana_exentos_pago_seguro (
      id BIGSERIAL PRIMARY KEY,
      cedula TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      porcentaje_exento NUMERIC(5,2) NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_humana_exentos_porcentaje_rango
        CHECK (porcentaje_exento >= 0 AND porcentaje_exento <= 100)
    );

CREATE INDEX IF NOT EXISTS idx_humana_exentos_pago_seguro_nombre
      ON humana_exentos_pago_seguro (nombre);

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
    );

ALTER TABLE valet_fijo_empleado
    DROP CONSTRAINT IF EXISTS chk_valet_fijo_empleado_valor_fijo_positivo;

ALTER TABLE valet_fijo_empleado
    ADD CONSTRAINT chk_valet_fijo_empleado_valor_fijo_positivo CHECK (valor_fijo >= 0);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_empleado_centro
      ON valet_fijo_empleado (centro_costo_id);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_empleado_cedula
      ON valet_fijo_empleado (empleado_cedula);

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
    );

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS centro_costo_nombre TEXT NOT NULL DEFAULT '';

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS empleado_nombre TEXT NOT NULL DEFAULT '';

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_turno DATE;

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS aprobado BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
            WHEN COALESCE(anio::text, '') ~ '^\d{4}$' THEN anio::int
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int
          END,
          GREATEST(1, LEAST(12,
            CASE WHEN COALESCE(mes::text, '') ~ '^\d{1,2}$' THEN mes::int ELSE 1 END
          )),
          GREATEST(1, LEAST(31,
            CASE WHEN COALESCE(dia::text, '') ~ '^\d{1,2}$' THEN dia::int ELSE 1 END
          ))
        )
        WHERE fecha_turno IS NULL;
      END IF;
    END $$;

UPDATE valet_fijo_horario
    SET fecha_turno = CURRENT_DATE
    WHERE fecha_turno IS NULL;

ALTER TABLE valet_fijo_horario
    DROP COLUMN IF EXISTS anio,
    DROP COLUMN IF EXISTS mes,
    DROP COLUMN IF EXISTS semana,
    DROP COLUMN IF EXISTS dia;

ALTER TABLE valet_fijo_horario
    ALTER COLUMN fecha_turno SET NOT NULL;

ALTER TABLE valet_fijo_horario
    DROP CONSTRAINT IF EXISTS uq_valet_fijo_horario;

ALTER TABLE valet_fijo_horario
    ADD CONSTRAINT uq_valet_fijo_horario UNIQUE (centro_costo_id, empleado_cedula, fecha_turno, hora_entrada, hora_salida);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_centro
      ON valet_fijo_horario (centro_costo_id);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_empleado
      ON valet_fijo_horario (empleado_cedula);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_horario_fecha_turno
      ON valet_fijo_horario (fecha_turno);

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS recurrencia BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS fin_recurrencia DATE;

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS observacion TEXT NOT NULL DEFAULT '';

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_blob BYTEA;

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE valet_fijo_horario
    ADD COLUMN IF NOT EXISTS evidencia_nombre_archivo TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS valet_fijo_centro (
      id BIGSERIAL PRIMARY KEY,
      centro_costo_id TEXT NOT NULL,
      centro_costo_nombre TEXT NOT NULL DEFAULT '',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_valet_fijo_centro UNIQUE (centro_costo_id)
    );

CREATE INDEX IF NOT EXISTS idx_valet_fijo_centro_activo
      ON valet_fijo_centro (activo);

CREATE INDEX IF NOT EXISTS idx_valet_fijo_centro_nombre
      ON valet_fijo_centro (centro_costo_nombre);

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
    );

CREATE INDEX IF NOT EXISTS idx_valet_fijo_configuracion_centro
      ON valet_fijo_configuracion (centro_costo_id);

CREATE TABLE IF NOT EXISTS distribucion_plantilla (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      centros JSONB NOT NULL DEFAULT '[]'::jsonb,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_distribucion_plantilla_nombre
      ON distribucion_plantilla (nombre);

CREATE TABLE IF NOT EXISTS empleado_distribucion_plantilla (
      id BIGSERIAL PRIMARY KEY,
      plantilla_id BIGINT NOT NULL REFERENCES distribucion_plantilla(id) ON DELETE CASCADE,
      empleado_id TEXT NOT NULL UNIQUE,
      empleado_documento TEXT NOT NULL DEFAULT '',
      empleado_nombre_completo TEXT NOT NULL DEFAULT '',
      fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE empleado_distribucion_plantilla
    ADD COLUMN IF NOT EXISTS fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE empleado_distribucion_plantilla
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_empleado_distribucion_plantilla_plantilla
      ON empleado_distribucion_plantilla (plantilla_id);

CREATE INDEX IF NOT EXISTS idx_empleado_distribucion_plantilla_empleado
      ON empleado_distribucion_plantilla (empleado_id);

ALTER TABLE medic_secure_humana
    ADD COLUMN IF NOT EXISTS cedula TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_medic_secure_humana_cedula
      ON medic_secure_humana (anio, mes, cedula);

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
    );

CREATE TABLE IF NOT EXISTS "Presupuestos_Cuentas" (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS anio;

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS parqueadero_id;

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS parqueadero_nombre;

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS area;

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS nombre_cuenta;

ALTER TABLE "Presupuestos_Cuentas" DROP COLUMN IF EXISTS detalle_cuenta;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_parqueadero VARCHAR(200);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_centrocosto VARCHAR(50);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_area VARCHAR(100);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_codigocuenta VARCHAR(50);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_nombrecuenta VARCHAR(200);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_detallecuenta VARCHAR(255);

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_enero NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_febrero NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_marzo NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_abril NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_mayo NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_junio NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_julio NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_agosto NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_septiembre NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_octubre NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_noviembre NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_diciembre NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Presupuestos_Cuentas" ADD COLUMN IF NOT EXISTS ptp_anio INTEGER;

ALTER TABLE "Presupuestos_Cuentas" ALTER COLUMN ptp_parqueadero SET NOT NULL;

ALTER TABLE "Presupuestos_Cuentas" ALTER COLUMN ptp_centrocosto SET NOT NULL;

ALTER TABLE "Presupuestos_Cuentas" ALTER COLUMN ptp_area SET NOT NULL;

ALTER TABLE "Presupuestos_Cuentas" ALTER COLUMN ptp_anio SET NOT NULL;

ALTER TABLE "Presupuestos_Cuentas"
      ADD CONSTRAINT presupuestos_cuentas_unicidad UNIQUE (ptp_parqueadero, ptp_area, ptp_detallecuenta, ptp_anio);

CREATE TABLE IF NOT EXISTS solicitudes_accesorios (
      id VARCHAR(50) PRIMARY KEY,
      fecha TIMESTAMP NOT NULL,
      estado VARCHAR(50) NOT NULL CHECK (estado IN ('creada', 'orden_generada', 'pedido_realizado')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_solicitudes_accesorios_fecha
      ON solicitudes_accesorios (fecha DESC);

CREATE TABLE IF NOT EXISTS lineas_solicitud (
      id VARCHAR(50) PRIMARY KEY,
      solicitud_id VARCHAR(50) NOT NULL REFERENCES solicitudes_accesorios(id) ON DELETE CASCADE,
      empleado_nombre VARCHAR(255) NOT NULL,
      empleado_cedula VARCHAR(20) NOT NULL,
      centro_costo VARCHAR(100) NOT NULL,
      accesorio VARCHAR(50) NOT NULL CHECK (accesorio IN ('botas', 'auriculares')),
      talla VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS acta BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100);

ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS cuotas VARCHAR(50);

ALTER TABLE lineas_solicitud
    ADD COLUMN IF NOT EXISTS valor NUMERIC(18,4);

CREATE INDEX IF NOT EXISTS idx_lineas_solicitud_solicitud
      ON lineas_solicitud (solicitud_id);

DROP TABLE IF EXISTS ordenes_accesorios CASCADE;

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
    );

CREATE INDEX IF NOT EXISTS idx_archivos_accesorios_solicitud
      ON archivos_accesorios (solicitud_id);

CREATE INDEX IF NOT EXISTS idx_archivos_accesorios_tipo
      ON archivos_accesorios (tipo);

ALTER TABLE archivos_accesorios
    ADD COLUMN IF NOT EXISTS ruta_archivo TEXT;

CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor_Categorias" (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      proveedor VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor" (
      id BIGSERIAL PRIMARY KEY,
      codigo VARCHAR(30) NOT NULL,
      categoria_id BIGINT NOT NULL REFERENCES "Plantilla_Proveedor_Categorias"(id) ON DELETE RESTRICT,
      nombre_equipo VARCHAR(150) NOT NULL,
      utilidad_interna NUMERIC(6,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE "Plantilla_Proveedor" ADD COLUMN IF NOT EXISTS utilidad_interna NUMERIC(6,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Plantilla_Proveedor_Componentes" (
      id BIGSERIAL PRIMARY KEY,
      equipo_id BIGINT NOT NULL REFERENCES "Plantilla_Proveedor"(id) ON DELETE CASCADE,
      nombre VARCHAR(150) NOT NULL,
      costo NUMERIC(14,2),
      moneda VARCHAR(3),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS "Inversiones_Proyectos" (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      conversion NUMERIC(14,4),
      desaduanizacion NUMERIC(14,2),
      utilidad NUMERIC(6,2),
      estado VARCHAR(30) NOT NULL DEFAULT 'Creado',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE "Inversiones_Proyectos" DROP COLUMN IF EXISTS moneda;

ALTER TABLE "Inversiones_Proyectos" ADD COLUMN IF NOT EXISTS interes NUMERIC(14,2);

ALTER TABLE "Inversiones_Proyectos" ADD COLUMN IF NOT EXISTS anios_operacion INTEGER;

CREATE TABLE IF NOT EXISTS "Plantilla_Urbapark" (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      codigo VARCHAR(30) NOT NULL,
      proveedor VARCHAR(100) NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      descripcion VARCHAR(150) NOT NULL,
      costo_proveedor NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_proveedor_dolares NUMERIC(14,2) NOT NULL DEFAULT 0,
      desaduanizacion NUMERIC(14,2) NOT NULL DEFAULT 0,
      utilidad_interna NUMERIC(6,2) NOT NULL DEFAULT 0,
      utilidad NUMERIC(6,2) NOT NULL DEFAULT 0,
      costo_urbapark NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_urbapark_referencia NUMERIC(14,2) NOT NULL DEFAULT 0,
      precio_venta_inversion NUMERIC(14,2) NOT NULL DEFAULT 0,
      inversion_id BIGINT REFERENCES "Inversiones_Proyectos"(id) ON DELETE CASCADE,
      equipo_id BIGINT REFERENCES "Plantilla_Proveedor"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS "Inversiones_Proyectos_Items" (
      id BIGSERIAL PRIMARY KEY,
      proyecto VARCHAR(200) NOT NULL,
      conversion NUMERIC(14,4) NOT NULL DEFAULT 0,
      desaduanizacion NUMERIC(14,2) NOT NULL DEFAULT 0,
      utilidad NUMERIC(6,2) NOT NULL DEFAULT 0,
      utilidad_interna NUMERIC(6,2) NOT NULL DEFAULT 0,
      items VARCHAR(30) NOT NULL,
      descripcion VARCHAR(150) NOT NULL,
      precio_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
      cantidad NUMERIC(14,2) NOT NULL DEFAULT 0,
      precio_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      observacion VARCHAR(255),
      inversion_id BIGINT NOT NULL REFERENCES "Inversiones_Proyectos"(id) ON DELETE CASCADE,
      plantilla_urbapark_id BIGINT REFERENCES "Plantilla_Urbapark"(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename); END LOOP; END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
RESET ROLE;