export const N8N_API_CATALOG = {
  movimientosHumanaEmpleados: '/api/n8n/webhook/lista/empleados/nomina/entsal',
  empleadosActivos: '/api/n8n/webhook/empleados/activos',
  listaCentroCosto: '/api/n8n/webhook/centrocostos/empleados',
  listarValetsFijos: '/api/n8n/webhook/centrocostos/empleados/valet',
  listaCentroCostoFallback: '/api/n8n/webhook/centrocostos/empleados/test',
  detalleEmpleadoCentroCostos: '/api/n8n/webhook/centrocostos/empleados',
  familiaresEmpleados: '/api/n8n/webhook/detalle/familiares/nomina',
  empleadosDistribucion: '/api/n8n/webhook/empleados/distribucion',
  descuentosVariosSitec: '/api/n8n/webhook/descuentos/varios/sitec',
  reporteRecaudacionDetalle: '/api/n8n/webhook/reporte/recaudacion/detalle',
  reporteTransferenciaDetalle: '/api/n8n/webhook/reporte/transferencia/detalle',
  plantillaProveedorProveedores: '/api/n8n-desarrollo/webhook/proyectos/plantilla/proveedores',
} as const;

interface N8nOrdenCompraPayload {
  documento_valido?: unknown;
  orden_compra_numero?: unknown;
  base_iva?: unknown;
}

export interface N8nOrdenCompraExtract {
  documentoValido: boolean;
  numeroOrden: string;
  totalFactura: number;
}
export interface EmpleadoDistribucionApiItem {
  COD_MFEMP: number|string;
  DOCI_MFEMP: string;
  NOMBRES: string;
  APELLIDOS: string;
  COD_MFCC: string;
  DSC_MFCC: string;
  DSC_MFDPT: string;
  COD_DISTRIBUCION: string;
}

export const getEmpleadosDistribucion = async <T = EmpleadoDistribucionApiItem[]>(): Promise<T> => {
  const response = await fetch(N8N_API_CATALOG.empleadosDistribucion, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return await parseJsonResponse<T>(response, [] as unknown as T);
};

const N8N_DEFAULT_API_KEY = 'u37KhX9gYj2Ns5rPAWq4EtZcLVtMoF16';

interface N8nCostCenterRawItem {
  COD_CCOSTO?: string;
  NOMBRE?: string;
  estado?: string;
  Acuerdo_Horas?: string;
  Acuerdo_Movilizacion?: string;
  Tipo?: string;
}

export interface NominaCostCenter {
  IDCENTROCOSTO: string;
  CENTROCOSTO: string;
  estado?: string;
  Acuerdo_Horas?: string;
  Acuerdo_Movilizacion?: string;
  Tipo?: string;
}

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
};

const buildHeaders = (apiKey?: string): Record<string, string> => {
  const key = String(apiKey ?? N8N_DEFAULT_API_KEY).trim();
  return key
    ? { ...defaultJsonHeaders, 'x-api-key': key }
    : { ...defaultJsonHeaders };
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  const fallback = response.statusText || `HTTP ${response.status}`;
  try {
    const payload = await response.json() as { error?: string; details?: string };
    return payload?.error || payload?.details || fallback;
  } catch {
    return fallback;
  }
};

const parseJsonResponse = async <T>(response: Response, fallback: T): Promise<T> => {
  if (response.status === 204 || response.status === 205) {
    return fallback;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return fallback;
  }

  const raw = await response.text();
  if (!raw.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Respuesta JSON invalida del servicio n8n');
  }
};

const fetchGetWithRetry = async (url: string, retries = 1): Promise<Response> => {
  let lastResponse: Response | null = null;

  for (let intento = 0; intento <= retries; intento += 1) {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    });

    lastResponse = response;
    if (response.ok) {
      return response;
    }

    const status = Number(response.status || 0);
    const esErrorServidor = status >= 500 && status <= 599;
    if (!esErrorServidor || intento === retries) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return lastResponse as Response;
};

export const getNominaEmployees = async <T = unknown>(): Promise<T> => {
  const response = await fetchGetWithRetry(N8N_API_CATALOG.movimientosHumanaEmpleados);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return await parseJsonResponse<T>(response, [] as unknown as T);
};

export const getNominaEmployeesActive = async <T = unknown>(): Promise<T> => {
  const response = await fetchGetWithRetry(N8N_API_CATALOG.empleadosActivos);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return await parseJsonResponse<T>(response, [] as unknown as T);
};

export const getNominaCostCentersRaw = async <T = N8nCostCenterRawItem[]>(): Promise<T> => {
  const response = await fetchGetWithRetry(N8N_API_CATALOG.listaCentroCosto);

  if (!response.ok) {
    const responseFallback = await fetchGetWithRetry(N8N_API_CATALOG.listaCentroCostoFallback);
    if (!responseFallback.ok) {
      throw new Error(await parseErrorMessage(responseFallback));
    }
    return await parseJsonResponse<T>(responseFallback, [] as unknown as T);
  }

  const data = await parseJsonResponse<T>(response, [] as unknown as T);
  if (Array.isArray(data) && data.length === 0) {
    const responseFallback = await fetchGetWithRetry(N8N_API_CATALOG.listaCentroCostoFallback);
    if (responseFallback.ok) {
      return await parseJsonResponse<T>(responseFallback, [] as unknown as T);
    }
  }

  return data;
};

export const getNominaCostCenters = async (): Promise<NominaCostCenter[]> => {
  const data = await getNominaCostCentersRaw<N8nCostCenterRawItem[]>();
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      IDCENTROCOSTO: String(item?.COD_CCOSTO || '').trim(),
      CENTROCOSTO: String(item?.NOMBRE || '').trim(),
      estado: String(item?.estado || '').trim(),
      Acuerdo_Horas: String(item?.Acuerdo_Horas || '').trim(),
      Acuerdo_Movilizacion: String(item?.Acuerdo_Movilizacion || '').trim(),
      Tipo: String(item?.Tipo || '').trim(),
    }))
    .filter((item) => item.IDCENTROCOSTO || item.CENTROCOSTO);
};

export const ListarValetsFijos = async (): Promise<NominaCostCenter[]> => {
  const response = await fetchGetWithRetry(N8N_API_CATALOG.listarValetsFijos);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await parseJsonResponse<N8nCostCenterRawItem[]>(response, []);
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      IDCENTROCOSTO: String(item?.COD_CCOSTO || '').trim(),
      CENTROCOSTO: String(item?.NOMBRE || '').trim(),
      estado: String(item?.estado || '').trim(),
      Acuerdo_Horas: String(item?.Acuerdo_Horas || '').trim(),
      Acuerdo_Movilizacion: String(item?.Acuerdo_Movilizacion || '').trim(),
      Tipo: String(item?.Tipo || '').trim(),
    }))
    .filter((item) => item.IDCENTROCOSTO || item.CENTROCOSTO);
};

interface N8nDirectPostInput {
  url: string;
  payload?: unknown;
  apiKey?: string;
}

export const n8nPostDirect = async <T = unknown>(input: N8nDirectPostInput): Promise<T> => {
  const response = await fetch(input.url, {
    method: 'POST',
    headers: buildHeaders(input.apiKey),
    body: JSON.stringify(input.payload ?? {}),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return await parseJsonResponse<T>(response, {} as T);
};

export interface ReporteRecaudacionDetalleItem {
  estado?: string | null;
  id?: number | string | null;
  fecha?: string | null;
  codigo?: string | null;
  concepto?: string | null;
  tipo?: string | null;
  documento?: string | null;
  oficina?: string | null;
  monto?: number | string | null;
  created_at?: string | null;
  fecha_registro?: string | null;
  parqueadero?: string | null;
  centro_costo?: string | null;
  total_deposito?: string | null;
  total_transferencia?: string | null;
  banco?: string | null;
  comprobante?: string | null;
  num_cuenta?: string | null;
}

const postReporteDetalle = async <T extends object>(
  endpoint: string,
  trOtro: string,
  fechaReporte: string
): Promise<T[]> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ trOtro, fechaReporte }),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  // Estos webhooks de n8n pueden responder con codigos HTTP no estandar (ej. 442)
  // aun cuando el workflow corrio bien y devolvio datos validos, por lo que
  // se confia primero en el cuerpo JSON en vez del status HTTP; solo se trata
  // como error real cuando no hay nada parseable o el cuerpo trae un "error".
  const esObjetoConError = Boolean(
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in (parsed as Record<string, unknown>)
  );

  if (parsed === null || esObjetoConError) {
    const mensaje = esObjetoConError
      ? String((parsed as { error?: unknown }).error)
      : (response.statusText || `HTTP ${response.status}`);
    throw new Error(mensaje);
  }

  const lista = Array.isArray(parsed) ? parsed : [parsed];
  // El webhook puede omitir campos, devolver entradas nulas o un objeto vacio
  // cuando no hay datos para cruzar; se descartan esas filas y el resto se
  // completa con valores en blanco al mapear (ver DetalleBusquedaView).
  return (lista as T[]).filter(
    (item): item is T => Boolean(item) && Object.keys(item).length > 0
  );
};

export const getReporteRecaudacionDetalle = async (
  trOtro: string,
  fechaReporte: string
): Promise<ReporteRecaudacionDetalleItem[]> =>
  postReporteDetalle<ReporteRecaudacionDetalleItem>(N8N_API_CATALOG.reporteRecaudacionDetalle, trOtro, fechaReporte);

export const getReporteTransferenciaDetalle = async (
  trOtro: string,
  fechaReporte: string
): Promise<ReporteRecaudacionDetalleItem[]> =>
  postReporteDetalle<ReporteRecaudacionDetalleItem>(N8N_API_CATALOG.reporteTransferenciaDetalle, trOtro, fechaReporte);

export const getProveedoresPlantilla = async (): Promise<string[]> => {
  const response = await fetchGetWithRetry(N8N_API_CATALOG.plantillaProveedorProveedores);
  const raw = await response.text();

  let data: unknown = null;
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (data === null) {
    // El cuerpo no es JSON valido: casi siempre es la pagina HTML de Vite/Vercel
    // cuando el proxy /api/n8n-desarrollo no esta activo (falta reiniciar el
    // servidor tras agregarlo a vite.config.ts), o un error real del servicio.
    // Se incluye un fragmento del cuerpo crudo para poder diagnosticarlo.
    const fragmento = raw.trim().slice(0, 150).replace(/\s+/g, ' ');
    throw new Error(
      `Respuesta no valida del servicio de proveedores (HTTP ${response.status}). ` +
      (fragmento ? `Cuerpo recibido: "${fragmento}${raw.length > 150 ? '...' : ''}"` : 'El cuerpo llego vacio.')
    );
  }

  if (!response.ok) {
    const posibleError = data && typeof data === 'object' && !Array.isArray(data)
      ? (data as { error?: unknown; message?: unknown }).error ?? (data as { error?: unknown; message?: unknown }).message
      : undefined;
    throw new Error(posibleError ? String(posibleError) : `Error ${response.status} al obtener los proveedores`);
  }

  const lista = Array.isArray(data) ? data : [data];
  // La API devuelve un objeto con claves "proveedor1", "proveedor2", etc.
  // en vez de un array de strings; se toman todos sus valores tal cual vengan.
  const primerItem = lista.find((item) => item && typeof item === 'object') as Record<string, unknown> | undefined;
  if (!primerItem) return [];

  return Object.values(primerItem)
    .map((valor) => String(valor ?? '').trim())
    .filter(Boolean);
};

export const extraerOrdenCompraDesdeImagenN8n = async (imageUrl: string): Promise<N8nOrdenCompraExtract> => {
  const payloadRaw = await n8nPostDirect<N8nOrdenCompraPayload | N8nOrdenCompraPayload[]>({
    url: N8N_API_CATALOG.descuentosVariosSitec,
    payload: {
      url: imageUrl,
    },
  });

  const payload = Array.isArray(payloadRaw) ? (payloadRaw[0] || {}) : payloadRaw;
  const documentoValido = Boolean(payload.documento_valido);
  const numeroOrden = String(payload.orden_compra_numero ?? '').trim();
  const totalFacturaRaw = String(payload.base_iva ?? '').replace(',', '.').trim();
  const totalFactura = Number(totalFacturaRaw);

  if (!documentoValido) {
    throw new Error('El documento cargado no es valido segun n8n (documento_valido=false).');
  }

  if (!numeroOrden) {
    throw new Error('n8n no devolvio orden_compra_numero.');
  }

  if (!Number.isFinite(totalFactura) || totalFactura <= 0) {
    throw new Error('n8n no devolvio un base_iva valido para el total de la factura.');
  }

  return {
    documentoValido,
    numeroOrden,
    totalFactura,
  };
};
