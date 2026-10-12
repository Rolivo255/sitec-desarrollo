import { authenticatedFetch } from './authenticatedFetch';
import type { HumanaDataByPeriod, HumanaEmployeeData } from '../types/humana';

export const DB_API_CATALOG = {
  humanaPeriods: '/api/humana/periods',
  humanaEmployeeLatest: '/api/humana/employee-latest',
  valetsEmpleados: '/api/valets/empleados',
  valetsHorarios: '/api/valets/horarios',
  valetsCentros: '/api/valets/centros',
  valetsConfiguracion: '/api/valets/configuracion',
  descuentosIncidentesCajaChica: '/api/descuentos/incidentes-caja-chica',
  descuentosExentosPagoSeguro: '/api/descuentos/exentos-pago-seguro',
  distribucionPlantillas: '/api/nomina/distribucion-plantillas',
  distribucionPlantillasEmpleados: '/api/nomina/distribucion-plantillas-empleados',
  contabilidadPygEjecutarSp: '/api/contabilidad/pyg/ejecutar-sp',
  contabilidadPygConfiguracionCuenta: '/api/contabilidad/pyg/configuracion-cuenta',
  contabilidadPygRubrosPeriodo: '/api/contabilidad/pyg/rubros-periodo',
  contabilidadPygSaveConfiguracionCentroCosto: '/api/contabilidad/pyg/configuracion-centro-costo',
  accesoriosSolicitudes: '/api/accesorios/solicitudes',
  accesoriasOrdenes: '/api/accesorios/ordenes',
  accesoriasArchivos: '/api/accesorios/archivos',
} as const;

interface PeriodSummary {
  anio: number;
  mes: string;
  archivo: string;
  fechaCarga: number;
}

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
};

const parseDbErrorMessage = async (response: Response): Promise<string> => {
  const fallback = response.statusText || `HTTP ${response.status}`;
  try {
    const payload = await response.json() as { error?: string; details?: string };
    return payload?.error || payload?.details || fallback;
  } catch {
    try {
      const text = (await response.text()).trim();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
};

interface DbApiFetchInput {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  allow404?: boolean;
  headers?: Record<string, string>;
}

export const dbApiFetch = async <T = unknown>(input: DbApiFetchInput): Promise<T | null> => {
  const response = await authenticatedFetch(input.endpoint, {
    method: input.method ?? 'GET',
    headers: {
      ...defaultJsonHeaders,
      ...(input.headers ?? {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  if (input.allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseDbErrorMessage(response));
  }

  return await response.json() as T;
};

const withQuery = (base: string, params: Record<string, string>) => {
  const search = new URLSearchParams(params).toString();
  return search ? `${base}?${search}` : base;
};

const requireData = async <T>(promise: Promise<T | null>): Promise<T> => {
  const data = await promise;
  return data as T;
};

const listResource = async <T = unknown>(endpoint: string): Promise<T> => {
  return await requireData(dbApiFetch<T>({ endpoint }));
};

const getResource = async <T = unknown>(endpoint: string, allow404 = false): Promise<T | null> => {
  return await dbApiFetch<T>({ endpoint, allow404 });
};

const saveResource = async <T = unknown>(endpoint: string, payload: unknown): Promise<T> => {
  return await requireData(dbApiFetch<T>({
    endpoint,
    method: 'POST',
    body: payload,
  }));
};

const putResource = async <T = unknown>(endpoint: string, payload: unknown): Promise<T> => {
  return await requireData(dbApiFetch<T>({
    endpoint,
    method: 'PUT',
    body: payload,
  }));
};

const deleteResource = async <T = unknown>(endpoint: string): Promise<T> => {
  return await requireData(dbApiFetch<T>({
    endpoint,
    method: 'DELETE',
  }));
};

const patchResource = async <T = unknown>(endpoint: string, payload: unknown): Promise<T> => {
  return await requireData(dbApiFetch<T>({
    endpoint,
    method: 'PATCH',
    body: payload,
  }));
};

const withDbContextError = async <T>(operation: () => Promise<T>, prefix: string): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${prefix}: ${error.message}`);
    }
    throw new Error(`${prefix}: no hay conexion con el backend de Humana`);
  }
};

export const dbApi = {
  contabilidad: {
    pyg: {
      getConfiguracionCuenta: async <T = unknown>(codigoCuenta: string): Promise<T> => {
        return await withDbContextError(
          async () => await listResource<T>(withQuery(DB_API_CATALOG.contabilidadPygConfiguracionCuenta, { codigoCuenta })),
          'No se pudo cargar configuracion de cuenta de PyG',
        );
      },

      getRubrosPeriodo: async <T = unknown>(payload: {
        centroCosto: string;
        periodo: string;
        tipo: 'ingresos' | 'gastos';
      }): Promise<T> => {
        return await withDbContextError(
          async () => await listResource<T>(withQuery(DB_API_CATALOG.contabilidadPygRubrosPeriodo, {
            centroCosto: payload.centroCosto,
            periodo: payload.periodo,
            tipo: payload.tipo,
          })),
          'No se pudo cargar rubros de PyG por periodo',
        );
      },

      saveConfiguracionCentroCosto: async <T = unknown>(payload: {
        centroCosto: string;
        periodo: string;
        tipoCalculo?: string;
        configuraciones: Array<{
          codigo: string;
          nombre: string;
          grupoCuenta: string;
          nombreGrupoCuenta: string;
          tipoCalculo?: 'V' | 'P';
          valor: number;
        }>;
      }): Promise<T> => {
        return await withDbContextError(
          async () => await saveResource<T>(DB_API_CATALOG.contabilidadPygSaveConfiguracionCentroCosto, payload),
          'No se pudo guardar configuracion de PyG',
        );
      },

      getConfiguracionCentroCosto: async <T = unknown>(payload: {
        centroCosto: string;
        periodo: string;
        tipo: 'ingresos' | 'gastos';
      }): Promise<T> => {
        return await withDbContextError(
          async () => await listResource<T>(withQuery(DB_API_CATALOG.contabilidadPygSaveConfiguracionCentroCosto, {
            centroCosto: payload.centroCosto,
            periodo: payload.periodo,
            tipo: payload.tipo,
          })),
          'No se pudo cargar configuracion de PyG por centro de costo',
        );
      },

      ejecutarSpFiltrado: async <T = unknown>(payload: {
        centroCosto: string;
        fechaIni: string;
        fechaFin: string;
        anio: string;
      }): Promise<T> => {
        return await withDbContextError(
          async () => await saveResource<T>(DB_API_CATALOG.contabilidadPygEjecutarSp, payload),
          'No se pudo ejecutar SP de PyG',
        );
      },
    },
  },

  humana: {
    saveData: async (anio: number, mes: string, empleados: HumanaEmployeeData[], archivo: string) => {
      return await withDbContextError(
        async () => await putResource(
          `${DB_API_CATALOG.humanaPeriods}/${anio}/${encodeURIComponent(mes)}`,
          { archivo, empleados },
        ),
        'No se pudo guardar en BD',
      );
    },

    getData: async (anio: number, mes: string): Promise<HumanaDataByPeriod | null> => {
      return await withDbContextError(
        async () => await getResource<HumanaDataByPeriod>(
          `${DB_API_CATALOG.humanaPeriods}/${anio}/${encodeURIComponent(mes)}`,
          true,
        ),
        'No se pudo consultar periodo',
      );
    },

    getAvailablePeriods: async (): Promise<PeriodSummary[]> => {
      return await withDbContextError(async () => {
        const data = await listResource<PeriodSummary[]>(DB_API_CATALOG.humanaPeriods);
        return Array.isArray(data) ? data : [];
      }, 'No se pudieron consultar periodos');
    },

    getEmployeeLatest: async <T = unknown>(empleadoNombre: string): Promise<T> => {
      return await withDbContextError(async () => {
        return await listResource<T>(withQuery(DB_API_CATALOG.humanaEmployeeLatest, {
          empleado: empleadoNombre,
        }));
      }, 'No se pudo consultar empleado');
    },
  },

  valets: {
    centros: {
      list: async <T = unknown>(activo?: boolean): Promise<T> => {
        if (typeof activo !== 'boolean') {
          return await listResource<T>(DB_API_CATALOG.valetsCentros);
        }

        return await listResource<T>(withQuery(DB_API_CATALOG.valetsCentros, {
          activo: String(activo),
        }));
      },

      save: async <T = unknown>(payload: unknown): Promise<T> => {
        return await saveResource<T>(DB_API_CATALOG.valetsCentros, payload);
      },

      delete: async <T = unknown>(centroCostoId: string): Promise<T> => {
        return await deleteResource<T>(withQuery(DB_API_CATALOG.valetsCentros, {
          centroCostoId,
        }));
      },
    },

    configuracion: {
      list: async <T = unknown>(centroCostoId?: string): Promise<T> => {
        if (!centroCostoId) {
          return await listResource<T>(DB_API_CATALOG.valetsConfiguracion);
        }

        return await listResource<T>(withQuery(DB_API_CATALOG.valetsConfiguracion, {
          centroCostoId,
        }));
      },

      save: async <T = unknown>(payload: unknown): Promise<T> => {
        return await saveResource<T>(DB_API_CATALOG.valetsConfiguracion, payload);
      },
    },

    empleados: {
      list: async <T = unknown>(): Promise<T> => {
        return await listResource<T>(DB_API_CATALOG.valetsEmpleados);
      },

      save: async <T = unknown>(payload: unknown): Promise<T> => {
        return await saveResource<T>(DB_API_CATALOG.valetsEmpleados, payload);
      },

      delete: async <T = unknown>(centroCostoId: string, empleadoCedula: string): Promise<T> => {
        return await deleteResource<T>(withQuery(DB_API_CATALOG.valetsEmpleados, {
          centroCostoId,
          empleadoCedula,
        }));
      },
    },

    horarios: {
      list: async <T = unknown>(): Promise<T> => {
        return await listResource<T>(DB_API_CATALOG.valetsHorarios);
      },

      save: async <T = unknown>(payload: unknown): Promise<T> => {
        return await saveResource<T>(DB_API_CATALOG.valetsHorarios, payload);
      },

      update: async <T = unknown>(payload: unknown): Promise<T> => {
        return await patchResource<T>(DB_API_CATALOG.valetsHorarios, payload);
      },

      delete: async <T = unknown>(id: string): Promise<T> => {
        return await deleteResource<T>(withQuery(DB_API_CATALOG.valetsHorarios, {
          id,
        }));
      },
    },
  },

  descuentos: {
    incidentesCajaChica: {
      list: async <T = unknown>(): Promise<T> => {
        return await listResource<T>(DB_API_CATALOG.descuentosIncidentesCajaChica);
      },

      save: async <T = unknown>(payload: unknown): Promise<T> => {
        return await saveResource<T>(DB_API_CATALOG.descuentosIncidentesCajaChica, payload);
      },

      approve: async <T = unknown>(id: number): Promise<T> => {
        return await patchResource<T>(`${DB_API_CATALOG.descuentosIncidentesCajaChica}/${id}/estado`, {
          estado: 'certificado',
        });
      },
    },
  },

  distribucionPlantillas: {
    list: async <T = unknown>(): Promise<T> => {
      return await requireData(dbApiFetch<T>({ endpoint: DB_API_CATALOG.distribucionPlantillas }));
    },

    save: async <T = unknown>(payload: unknown): Promise<T> => {
      return await requireData(dbApiFetch<T>({
        endpoint: DB_API_CATALOG.distribucionPlantillas,
        method: 'POST',
        body: payload,
      }));
    },

    delete: async <T = unknown>(plantillaId: number): Promise<T> => {
      return await requireData(dbApiFetch<T>({
        endpoint: `${DB_API_CATALOG.distribucionPlantillas}/${encodeURIComponent(String(plantillaId))}`,
        method: 'DELETE',
      }));
    },
  },

  distribucionPlantillasEmpleados: {
    list: async <T = unknown>(): Promise<T> => {
      return await requireData(dbApiFetch<T>({ endpoint: DB_API_CATALOG.distribucionPlantillasEmpleados }));
    },

    save: async <T = unknown>(payload: unknown): Promise<T> => {
      return await requireData(dbApiFetch<T>({
        endpoint: DB_API_CATALOG.distribucionPlantillasEmpleados,
        method: 'POST',
        body: payload,
      }));
    },

    delete: async <T = unknown>(plantillaId: number, empleadoId: string): Promise<T> => {
      return await requireData(dbApiFetch<T>({
        endpoint: `${DB_API_CATALOG.distribucionPlantillasEmpleados}/${encodeURIComponent(String(plantillaId))}/${encodeURIComponent(empleadoId)}`,
        method: 'DELETE',
      }));
    },
  },

  exentosPagoSeguro: {
    list: async <T = unknown>(): Promise<T> => {
      return await requireData(dbApiFetch<T>({ endpoint: DB_API_CATALOG.descuentosExentosPagoSeguro }));
    },

    save: async <T = unknown>(payload: unknown): Promise<T> => {
      return await requireData(dbApiFetch<T>({
        endpoint: DB_API_CATALOG.descuentosExentosPagoSeguro,
        method: 'POST',
        body: payload,
      }));
    },
  },
};

export const humanaApi = dbApi.humana;
