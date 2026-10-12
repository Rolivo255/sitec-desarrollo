import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Download, Eye, FileText, Upload, X } from 'lucide-react';
import { dbApiFetch, DB_API_CATALOG } from '../../services/dbApi';
import { extraerOrdenCompraDesdeImagenN8n } from '../../services/n8nApi';
import { getStorageDownloadUrl, uploadToSupabaseStorage } from '../../services/supaBase';
import type {
  AccesorioTipo,
  FilaEmpleado,
  OrdenAccesorioResumen,
  OrdenCompraResumen,
  SolicitudGuardada,
} from './SolicitudAccesoriosTabsView';

interface OrdenCompraViewProps {
  solicitudes: SolicitudGuardada[];
  ordenesCompra: OrdenCompraResumen[];
  onUpdateEstado: (solicitudId: string, estado: SolicitudGuardada['estado']) => void;
  onOrdenCompraSubida: (orden: OrdenCompraResumen) => void;
}

interface ArchivoSubido {
  solicitudId: string;
  tipo: 'orden' | 'acta';
  nombre: string;
  fecha: string;
  accesorio?: AccesorioTipo;
  empleadoCedula?: string;
  file?: File;
}

interface ArchivoRegistrado {
  solicitudId: string;
  tipo: 'orden' | 'acta';
  nombreArchivo: string;
  rutaArchivo?: string;
  accesorio?: AccesorioTipo;
  empleadoCedula?: string;
  numeroOrden?: string;
  totalValor?: number;
}

const SUPABASE_BUCKET = 'OC test';

interface FilaSeleccionadaContext {
  solicitudId: string;
  fila: FilaEmpleado;
}

const ACCESORIOS_CONFIG: Record<AccesorioTipo, { label: string; badgeClassName: string }> = {
  botas: {
    label: 'Botas',
    badgeClassName: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  auriculares: {
    label: 'Auriculares',
    badgeClassName: 'bg-violet-50 text-violet-700 border border-violet-200',
  },
};

const obtenerTiposAccesorio = (filas: FilaEmpleado[]): AccesorioTipo[] => {
  return Array.from(new Set(filas.map((fila) => fila.accesorio)));
};

const getAccesorioLabel = (accesorio: AccesorioTipo) => ACCESORIOS_CONFIG[accesorio].label;

const extraerCedulaDesdeNombreActa = (nombre: string): string => {
  const raw = String(nombre || '').trim();
  const match = raw.match(/^Acta_([^_]+)_/i);
  return match ? String(match[1] || '').trim() : '';
};

const sanitizeToken = (value: string): string => {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
};

const uploadOrdenImageToSupabase = async (params: {
  solicitudId: string;
  accesorio: AccesorioTipo;
  file: File;
}): Promise<string> => {
  const extension = params.file.type === 'image/png' ? 'png' : 'jpg';
  const objectPath = `ordenes/${sanitizeToken(params.solicitudId)}/${sanitizeToken(params.accesorio)}_${Date.now()}.${extension}`;

  const publicUrl = String(await uploadToSupabaseStorage({
    bucket: SUPABASE_BUCKET,
    objectPath,
    file: params.file,
    upsert: true,
  }) || '').trim();
  if (!publicUrl) {
    throw new Error('No se pudo obtener la URL publica del archivo en Supabase.');
  }

  return publicUrl;
};

const construirResumenOrden = (
  solicitud: SolicitudGuardada,
  ordenActual: OrdenCompraResumen | undefined,
  ordenesPorAccesorio: Partial<Record<AccesorioTipo, OrdenAccesorioResumen>>,
): OrdenCompraResumen => {
  const detalles = Object.values(ordenesPorAccesorio).filter(Boolean) as OrdenAccesorioResumen[];
  const numeroOrden = detalles.map((detalle) => detalle.numeroOrden).filter(Boolean).join(' / ');
  const totalValor = detalles.reduce((total, detalle) => total + Number(detalle.totalValor || 0), 0);
  const fecha = detalles[0]?.fecha || new Date().toLocaleDateString('es-ES');
  const totalOrdenes = detalles.filter((detalle) => detalle.archivoOrdenNombre).length;
  const cantidadPorAccesorio = solicitud.filas.reduce<Record<AccesorioTipo, number>>(
    (acc, fila) => {
      acc[fila.accesorio] = (acc[fila.accesorio] || 0) + 1;
      return acc;
    },
    { botas: 0, auriculares: 0 },
  );

  const filasConValor = solicitud.filas.map((fila) => {
    const totalAccesorio = Number(ordenesPorAccesorio[fila.accesorio]?.totalValor || 0);
    const cantidad = Number(cantidadPorAccesorio[fila.accesorio] || 0);
    const valorCalculado = cantidad > 0 && totalAccesorio > 0 ? totalAccesorio / cantidad : fila.valor;

    return {
      ...fila,
      valor: Number.isFinite(Number(valorCalculado)) ? Number(valorCalculado) : fila.valor,
    };
  });

  return {
    solicitudId: solicitud.id,
    numeroOrden,
    totalValor,
    fecha,
    filas: filasConValor,
    archivoOrdenNombre:
      totalOrdenes > 0
        ? totalOrdenes === 1
          ? detalles.find((detalle) => detalle.archivoOrdenNombre)?.archivoOrdenNombre
          : `${totalOrdenes} ordenes cargadas`
        : undefined,
    ordenesPorAccesorio,
    facturasPorAccesorio: ordenActual?.facturasPorAccesorio,
    cuotasPorAccesorio: ordenActual?.cuotasPorAccesorio,
  };
};

const OrdenCompraView = ({ solicitudes, ordenesCompra, onUpdateEstado, onOrdenCompraSubida }: OrdenCompraViewProps) => {
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [archivosRegistrados, setArchivosRegistrados] = useState<ArchivoRegistrado[]>([]);
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaSeleccionadaContext | null>(null);
  const [generandoActaPersonal, setGenerandoActaPersonal] = useState(false);
  const [expandedSolicitud, setExpandedSolicitud] = useState<string | null>(null);

  useEffect(() => {
    const cargarArchivosRegistrados = async () => {
      if (solicitudes.length === 0) {
        setArchivosRegistrados([]);
        return;
      }

      try {
        const respuestas = await Promise.all(
          solicitudes.map(async (solicitud) => {
            const response = await dbApiFetch<{ ok: boolean; archivos?: Array<Record<string, unknown>> }>({
              endpoint: `${DB_API_CATALOG.accesoriasArchivos}/${solicitud.id}`,
              method: 'GET',
              allow404: true,
            });

            return Array.isArray(response?.archivos) ? response.archivos : [];
          }),
        );

        const normalizados = respuestas.flat().map((item) => ({
          solicitudId: String(item.solicitud_id ?? item.solicitudId ?? ''),
          tipo: String(item.tipo ?? '') as ArchivoRegistrado['tipo'],
          nombreArchivo: String(item.nombre_archivo ?? item.nombreArchivo ?? ''),
          rutaArchivo: String(item.ruta_archivo ?? item.rutaArchivo ?? '').trim() || undefined,
          accesorio: item.accesorio ? String(item.accesorio) as AccesorioTipo : undefined,
          empleadoCedula: item.empleado_cedula ? String(item.empleado_cedula) : item.empleadoCedula ? String(item.empleadoCedula) : undefined,
          numeroOrden: item.numero_orden ? String(item.numero_orden) : item.numeroOrden ? String(item.numeroOrden) : undefined,
          totalValor: Number(item.total_valor ?? item.totalValor ?? 0),
        })).filter((item) => item.solicitudId && item.tipo && item.nombreArchivo);

        setArchivosRegistrados(normalizados);
      } catch (error) {
        console.error('Error cargando metadata de archivos:', error);
      }
    };

    void cargarArchivosRegistrados();
  }, [solicitudes]);

  if (solicitudes.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[340px] text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
            <FileText size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Sin solicitudes</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            Crea una solicitud en la pestaña "Solicitar" para ver el resumen aquí.
          </p>
        </div>
      </div>
    );
  }

  const getOrden = (solicitudId: string) => ordenesCompra.find((orden) => orden.solicitudId === solicitudId);

  const getArchivoSolicitud = (solicitudId: string, tipo: 'orden', accesorio: AccesorioTipo) => {
    return [...archivos]
      .reverse()
      .find((archivo) => archivo.solicitudId === solicitudId && archivo.tipo === tipo && archivo.accesorio === accesorio);
  };

  const getActaArchivo = (solicitudId: string, empleadoCedula: string) => {
    return [...archivos]
      .reverse()
      .find(
        (archivo) => {
          if (archivo.tipo !== 'acta' || archivo.solicitudId !== solicitudId) {
            return false;
          }
          const cedulaArchivo = String(archivo.empleadoCedula || '').trim() || extraerCedulaDesdeNombreActa(archivo.nombre);
          return cedulaArchivo === empleadoCedula;
        },
      );
  };

  const getActaRegistrada = (solicitudId: string, empleadoCedula: string) => {
    return [...archivosRegistrados]
      .reverse()
      .find(
        (archivo) => {
          if (archivo.tipo !== 'acta' || archivo.solicitudId !== solicitudId) {
            return false;
          }
          const cedulaArchivo = String(archivo.empleadoCedula || '').trim() || extraerCedulaDesdeNombreActa(archivo.nombreArchivo);
          return cedulaArchivo === empleadoCedula;
        },
      );
  };

  const getActasCompletas = (solicitudId: string) => {
    const cedulasRegistradas = archivosRegistrados
      .filter((archivo) => archivo.tipo === 'acta' && archivo.solicitudId === solicitudId)
      .map((archivo) => String(archivo.empleadoCedula || '').trim() || extraerCedulaDesdeNombreActa(archivo.nombreArchivo))
      .filter(Boolean);

    return new Set(cedulasRegistradas).size;
  };

  const existeArchivoRegistrado = (
    solicitudId: string,
    tipo: 'orden',
    accesorio: AccesorioTipo,
  ) => {
    return archivosRegistrados.some(
      (archivo) =>
        archivo.solicitudId === solicitudId
        && archivo.tipo === tipo
        && String(archivo.accesorio || '').trim() === accesorio,
    );
  };

  const getTotalPersonasSolicitud = (solicitud: SolicitudGuardada) => {
    return new Set(
      solicitud.filas
        .map((fila) => fila.empleadoCedula)
        .filter((cedula) => Boolean(cedula && cedula.trim())),
    ).size;
  };

  const getDetalleOrdenVisual = (
    solicitudId: string,
    accesorio: AccesorioTipo,
    ordenActual?: OrdenCompraResumen,
  ): { archivoOrdenNombre?: string; numeroOrden: string; totalValor: number } | null => {
    const detalleOrden = ordenActual?.ordenesPorAccesorio?.[accesorio];
    if (detalleOrden) {
      return {
        archivoOrdenNombre: detalleOrden.archivoOrdenNombre,
        numeroOrden: String(detalleOrden.numeroOrden || '').trim(),
        totalValor: Number(detalleOrden.totalValor || 0),
      };
    }

    const registro = [...archivosRegistrados]
      .reverse()
      .find((item) => item.solicitudId === solicitudId && item.tipo === 'orden' && item.accesorio === accesorio);

    if (!registro) {
      return null;
    }

    return {
      archivoOrdenNombre: registro.nombreArchivo,
      numeroOrden: String(registro.numeroOrden || '').trim(),
      totalValor: Number(registro.totalValor || 0),
    };
  };

  const registrarArchivoEnBD = async (payload: {
    solicitudId: string;
    tipo: 'orden' | 'acta';
    nombreArchivo: string;
    rutaArchivo?: string;
    accesorio?: AccesorioTipo;
    empleadoCedula?: string;
    numeroOrden?: string;
    totalValor?: number;
  }): Promise<boolean> => {
    try {
      const response = await dbApiFetch<{ ok: boolean; registro?: Record<string, unknown> }>({
        endpoint: DB_API_CATALOG.accesoriasArchivos,
        method: 'POST',
        body: {
          solicitudId: payload.solicitudId,
          tipo: payload.tipo,
          nombreArchivo: payload.nombreArchivo,
          rutaArchivo: payload.rutaArchivo,
          accesorio: payload.accesorio,
          empleadoCedula: payload.empleadoCedula,
          numeroOrden: payload.numeroOrden,
          totalValor: payload.totalValor,
        },
      });

      const registro = response?.registro;
      if (registro) {
        const normalizado: ArchivoRegistrado = {
          solicitudId: String(registro.solicitud_id ?? payload.solicitudId ?? ''),
          tipo: String(registro.tipo ?? payload.tipo ?? '') as ArchivoRegistrado['tipo'],
          nombreArchivo: String(registro.nombre_archivo ?? payload.nombreArchivo ?? ''),
          rutaArchivo: String(registro.ruta_archivo ?? registro.rutaArchivo ?? '').trim() || undefined,
          accesorio: registro.accesorio ? String(registro.accesorio) as AccesorioTipo : payload.accesorio,
          empleadoCedula: registro.empleado_cedula
            ? String(registro.empleado_cedula)
            : payload.empleadoCedula,
          numeroOrden: registro.numero_orden ? String(registro.numero_orden) : payload.numeroOrden,
          totalValor: Number(registro.total_valor ?? payload.totalValor ?? 0),
        };

        setArchivosRegistrados((prev) => {
          const yaExiste = prev.some(
            (item) =>
              item.solicitudId === normalizado.solicitudId
              && item.tipo === normalizado.tipo
              && String(item.accesorio || '') === String(normalizado.accesorio || '')
              && String(item.empleadoCedula || '') === String(normalizado.empleadoCedula || '')
              && item.nombreArchivo === normalizado.nombreArchivo,
          );
          return yaExiste ? prev : [normalizado, ...prev];
        });
      }

      return true;
    } catch (error) {
      console.error('Error guardando metadata de archivo en BD:', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo registrar el archivo en BD.');
      return false;
    }
  };

  const descargarArchivo = async (solicitudId: string, tipo: 'orden', accesorio: AccesorioTipo) => {
    const archivo = getArchivoSolicitud(solicitudId, tipo, accesorio);
    const registro = [...archivosRegistrados]
      .reverse()
      .find((item) => item.solicitudId === solicitudId && item.tipo === tipo && item.accesorio === accesorio);

    const nombreDescarga = archivo?.nombre || registro?.nombreArchivo || 'archivo';

    if (!archivo?.file && !registro?.rutaArchivo) {
      window.alert('No hay archivo disponible para descargar.');
      return;
    }

    let downloadUrl = '';
    const link = document.createElement('a');
    try {
      if (archivo?.file) {
        downloadUrl = URL.createObjectURL(archivo.file);
      } else {
        const ruta = await getStorageDownloadUrl(String(registro?.rutaArchivo || '').trim());
        const sourceUrl = /^https?:\/\//i.test(ruta)
          ? ruta
          : `/${ruta.replace(/^\//, '')}`;

        const response = await authenticatedFetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`No se pudo descargar el archivo (${response.status}).`);
        }

        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
      }

      link.href = downloadUrl;
      link.download = nombreDescarga;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Error descargando archivo:', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo descargar el archivo.');
    } finally {
      if (link.parentNode) {
        document.body.removeChild(link);
      }

      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    }
  };

  const descargarActaFirmada = (solicitudId: string, empleadoCedula: string) => {
    const archivo = getActaArchivo(solicitudId, empleadoCedula);
    const registro = getActaRegistrada(solicitudId, empleadoCedula);

    if (!archivo?.file) {
      if (registro) {
        window.alert('El acta esta registrada como subida, pero en esta maqueta no se almacena el archivo para descarga.');
      } else {
        window.alert('No hay acta firmada disponible para descargar en esta sesion.');
      }
      return;
    }

    const url = URL.createObjectURL(archivo.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = archivo.nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadArchivo = (
    tipo: 'orden' | 'acta',
    solicitud: SolicitudGuardada,
    accesorio?: AccesorioTipo,
    empleadoCedulaSeleccionada?: string,
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = tipo === 'orden' ? 'image/jpeg,image/png' : '.pdf,.doc,.docx';

    input.onchange = (event) => {
      void (async () => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || !files[0]) return;

        const file = files[0];
        const solicitudId = solicitud.id;
        const empleadoCedulaActa =
          tipo === 'acta'
            ? String(empleadoCedulaSeleccionada || filaSeleccionada?.fila.empleadoCedula || '').trim()
            : String(filaSeleccionada?.fila.empleadoCedula || '').trim();
        const ordenActual = getOrden(solicitudId);
        const tiposSolicitud = obtenerTiposAccesorio(solicitud.filas);

        if (tipo !== 'acta' && !accesorio) {
          window.alert('Seleccione el tipo de accesorio para continuar.');
          return;
        }

        if (tipo === 'orden' && !['image/jpeg', 'image/png'].includes(String(file.type || '').toLowerCase())) {
          window.alert('Las ordenes de compra solo se pueden subir como imagen JPG o PNG.');
          return;
        }

        if (tipo === 'orden' && existeArchivoRegistrado(solicitudId, 'orden', accesorio!)) {
          return;
        }

        let numeroOrden = ordenActual?.ordenesPorAccesorio?.[accesorio!]?.numeroOrden || '';
        let totalValor = ordenActual?.ordenesPorAccesorio?.[accesorio!]?.totalValor || 0;

        let rutaArchivoSupabase: string | undefined;
        if (tipo === 'orden' && accesorio) {
          rutaArchivoSupabase = await uploadOrdenImageToSupabase({
            solicitudId,
            accesorio,
            file,
          });

          const datosExtraidos = await extraerOrdenCompraDesdeImagenN8n(await getStorageDownloadUrl(rutaArchivoSupabase));
          numeroOrden = datosExtraidos.numeroOrden;
          totalValor = datosExtraidos.totalFactura;
        }

        const guardadoEnBD = await registrarArchivoEnBD({
          solicitudId,
          tipo,
          nombreArchivo: file.name,
          rutaArchivo: rutaArchivoSupabase,
          accesorio,
          empleadoCedula: empleadoCedulaActa || undefined,
          numeroOrden: tipo === 'acta' ? undefined : numeroOrden,
          totalValor: tipo === 'acta' ? 0 : Number(totalValor || 0),
        });

        if (!guardadoEnBD) {
          return;
        }

        setArchivos((prev) => [
          ...prev,
          {
            solicitudId,
            tipo,
            nombre: file.name,
            fecha: new Date().toLocaleDateString('es-ES'),
            accesorio,
            empleadoCedula: empleadoCedulaActa || undefined,
            file,
          },
        ]);

        if (tipo === 'orden') {
          const ordenesPorAccesorio: Partial<Record<AccesorioTipo, OrdenAccesorioResumen>> = {
            ...(ordenActual?.ordenesPorAccesorio ?? {}),
            [accesorio!]: {
              numeroOrden,
              totalValor,
              fecha: new Date().toLocaleDateString('es-ES'),
              archivoOrdenNombre:
                file.name,
            },
          };

          const resumenOrden = construirResumenOrden(solicitud, ordenActual, ordenesPorAccesorio);
          onOrdenCompraSubida(resumenOrden);

          const todasOrdenesSubidas = tiposSolicitud.every((tipoAccesorio) => {
            return existeArchivoRegistrado(solicitudId, 'orden', tipoAccesorio);
          });

          if (tipo === 'orden' && todasOrdenesSubidas) {
            onUpdateEstado(solicitudId, 'orden_generada');
          }

        }

        if (tipo === 'acta') {
          const actasExistentes = new Set(
            archivosRegistrados
              .filter((archivo) => archivo.solicitudId === solicitudId && archivo.tipo === 'acta')
              .map((archivo) => String(archivo.empleadoCedula || '').trim() || extraerCedulaDesdeNombreActa(archivo.nombreArchivo))
              .filter(Boolean),
          );

          if (empleadoCedulaActa) {
            actasExistentes.add(empleadoCedulaActa);
          }

          const totalPersonasSolicitud = new Set(
            solicitud.filas
              .map((fila) => String(fila.empleadoCedula || '').trim())
              .filter(Boolean),
          ).size;

          if (totalPersonasSolicitud > 0 && actasExistentes.size >= totalPersonasSolicitud) {
            onUpdateEstado(solicitudId, 'pedido_realizado');
          }
        }
      })();
    };

    input.click();
  };

  const handleGenerarActaPersonal = () => {
    if (!filaSeleccionada) return;
    setGenerandoActaPersonal(true);

    setTimeout(() => {
      setArchivos((prev) => [
        ...prev,
        {
          solicitudId: filaSeleccionada.solicitudId,
          tipo: 'acta',
          nombre: `Acta_${filaSeleccionada.fila.empleadoCedula}_${filaSeleccionada.solicitudId}.pdf`,
          fecha: new Date().toLocaleDateString('es-ES'),
          empleadoCedula: filaSeleccionada.fila.empleadoCedula,
        },
      ]);

      setGenerandoActaPersonal(false);
    }, 1500);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
        <p className="mt-1 text-sm text-slate-600">Gestiona las solicitudes de accesorios y carga sus documentos de orden y validacion por tipo de accesorio.</p>
      </div>

      <div className="bg-white divide-y divide-slate-200">
        {solicitudes.map((solicitud) => {
          const orden = getOrden(solicitud.id);
          const actasCompletas = getActasCompletas(solicitud.id);
          const totalPersonas = getTotalPersonasSolicitud(solicitud);
          const todasActasCompletas = actasCompletas === totalPersonas && totalPersonas > 0;
          const panelAbierto = expandedSolicitud === solicitud.id;
          const tiposSolicitud = obtenerTiposAccesorio(solicitud.filas);
          const todasOrdenesSubidas = tiposSolicitud.every((tipoAccesorio) => existeArchivoRegistrado(solicitud.id, 'orden', tipoAccesorio));
          const pasoPendiente = !todasOrdenesSubidas
            ? 'ordenes'
            : !todasActasCompletas
              ? 'actas'
              : 'completado';

          return (
            <div key={solicitud.id} className="bg-white overflow-hidden">
              <button
                onClick={() => setExpandedSolicitud((prev) => (prev === solicitud.id ? null : solicitud.id))}
                className={`w-full px-6 py-4 border-b border-slate-200 flex items-center justify-between transition ${
                  panelAbierto ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${panelAbierto ? 'bg-blue-100' : 'bg-blue-50'}`}>
                    <FileText size={18} className="text-blue-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-bold text-slate-700">{solicitud.id}</h3>
                    <p className="text-xs text-slate-400">Solicitud de accesorios</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      solicitud.estado === 'pedido_realizado'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : solicitud.estado === 'orden_generada'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {solicitud.estado === 'pedido_realizado'
                      ? 'Pedido realizado'
                      : solicitud.estado === 'orden_generada'
                        ? 'Orden generada'
                        : 'Solicitud creada'}
                  </span>
                  {panelAbierto ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                </div>
              </button>

              {panelAbierto && (
                <div className="p-6 space-y-6">
                  <div className="text-sm text-slate-500">
                    <p>
                      Fecha: <span className="font-medium text-slate-700">{solicitud.fecha}</span>
                    </p>
                    <p>
                      Estado actual:{' '}
                      <span className="font-medium text-slate-700">
                        {solicitud.estado === 'pedido_realizado'
                          ? 'Pedido realizado'
                          : solicitud.estado === 'orden_generada'
                            ? 'Orden generada'
                            : 'Solicitud creada'}
                      </span>
                    </p>
                    <p>
                      Paso pendiente:{' '}
                      <span className="font-medium text-slate-700">
                        {pasoPendiente === 'ordenes'
                          ? 'Subir órdenes'
                          : pasoPendiente === 'actas'
                            ? 'Subir actas'
                            : 'Flujo completo'}
                      </span>
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-6 space-y-4">
                    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                      <h4 className="text-base font-bold text-slate-700">
                        {todasOrdenesSubidas ? 'Detalle de items y actas' : 'Detalle de accesorios solicitados'}
                      </h4>
                      {todasOrdenesSubidas ? (
                        <p className="text-sm text-slate-500">
                          Actas subidas: <span className="font-semibold text-slate-700">{actasCompletas} de {totalPersonas}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Solo visualización de productos solicitados.</p>
                      )}
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                            <th className="px-3 py-2 text-left font-semibold">Cédula</th>
                            <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                            {solicitud.estado === 'orden_generada' && <th className="px-3 py-2 text-left font-semibold">Centro de costo</th>}
                            <th className="px-3 py-2 text-left font-semibold">Accesorio</th>
                            <th className="px-3 py-2 text-center font-semibold">Talla</th>
                            {todasOrdenesSubidas && <th className="px-3 py-2 text-center font-semibold">Acta</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {solicitud.filas.map((fila, idx) => (
                            <tr key={fila.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-3 py-2 text-slate-600">{fila.empleadoCedula}</td>
                              <td className="px-3 py-2 font-medium text-slate-700">{fila.empleadoNombre}</td>
                              {solicitud.estado === 'orden_generada' && (
                                <td className="px-3 py-2 text-slate-600 max-w-[220px] truncate">{fila.centroCosto}</td>
                              )}
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACCESORIOS_CONFIG[fila.accesorio].badgeClassName}`}>
                                  {getAccesorioLabel(fila.accesorio)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">{fila.accesorio === 'botas' ? fila.talla : '—'}</td>
                              {todasOrdenesSubidas && (
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => setFilaSeleccionada({ solicitudId: solicitud.id, fila })}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Ver/generar acta"
                                  >
                                    <Eye size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {todasOrdenesSubidas && (
                    <div className="flex flex-wrap gap-2">
                      {tiposSolicitud.map((accesorio) => {
                        const ordenSubida = existeArchivoRegistrado(solicitud.id, 'orden', accesorio);
                        const detalleOrdenVisual = getDetalleOrdenVisual(solicitud.id, accesorio, orden);
                        if (!ordenSubida) return null;

                        return (
                          <div key={`${solicitud.id}-descargar-orden-${accesorio}`} className="border border-slate-200 rounded-xl p-3 bg-white">
                            {detalleOrdenVisual && (
                              <div className="text-xs text-slate-600 mb-2">
                                <p>
                                  <span className="font-semibold text-slate-700">Orden:</span>{' '}
                                  {detalleOrdenVisual.numeroOrden || 'N/A'}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">Total:</span>{' '}
                                  ${Number(detalleOrdenVisual.totalValor || 0).toFixed(2)}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => descargarArchivo(solicitud.id, 'orden', accesorio)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                            >
                              <Download size={16} />
                              Descargar Orden de {getAccesorioLabel(accesorio)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!todasOrdenesSubidas && (
                  <div className="border-t border-slate-200 pt-6 space-y-4">
                    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                      <h4 className="text-base font-bold text-slate-700">Orden de Compra</h4>
                      <p className="text-sm text-slate-500">Sube una orden por cada tipo de accesorio solicitado.</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {tiposSolicitud.map((accesorio) => {
                        const detalle = getDetalleOrdenVisual(solicitud.id, accesorio, orden);

                        return (
                          <div key={`${solicitud.id}-orden-${accesorio}`} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                            <div className="p-4 border-b border-slate-200 bg-slate-50">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h5 className="font-bold text-slate-700 text-sm">Orden de {getAccesorioLabel(accesorio)}</h5>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ACCESORIOS_CONFIG[accesorio].badgeClassName}`}>
                                  {getAccesorioLabel(accesorio)}
                                </span>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              {detalle?.archivoOrdenNombre ? (
                                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-800 space-y-1">
                                  <p><span className="font-semibold">Archivo:</span> {detalle.archivoOrdenNombre}</p>
                                  <p><span className="font-semibold">Orden:</span> {detalle.numeroOrden || 'N/A'}</p>
                                  <p><span className="font-semibold">Total:</span> ${Number(detalle.totalValor || 0).toFixed(2)}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">Aún no se ha cargado la orden de compra para este accesorio.</p>
                              )}

                              <div className="flex flex-col sm:flex-row gap-2">
                                {detalle?.archivoOrdenNombre ? (
                                  <button
                                    onClick={() => descargarArchivo(solicitud.id, 'orden', accesorio)}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                                  >
                                    <Download size={16} />
                                    Descargar {getAccesorioLabel(accesorio)}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUploadArchivo('orden', solicitud, accesorio)}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                                  >
                                    <Upload size={16} />
                                    Subir Orden de {getAccesorioLabel(accesorio)}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}

                  {todasOrdenesSubidas && !todasActasCompletas && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      No se puede continuar con el flujo hasta que se hayan subido todas las actas de los empleados.
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>

      {filaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-6 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">Acta - {filaSeleccionada.fila.empleadoNombre}</h2>
                <p className="text-xs text-slate-500 mt-1">Cédula: {filaSeleccionada.fila.empleadoCedula}</p>
              </div>
              <button
                onClick={() => setFilaSeleccionada(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Accesorio solicitado</p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ACCESORIOS_CONFIG[filaSeleccionada.fila.accesorio].badgeClassName}`}>
                    {getAccesorioLabel(filaSeleccionada.fila.accesorio)}
                  </span>
                  {filaSeleccionada.fila.accesorio === 'botas' && (
                    <span className="text-xs text-slate-600 ml-2">
                      Talla: <span className="font-bold">{filaSeleccionada.fila.talla}</span>
                    </span>
                  )}
                </div>
              </div>

              {(() => {
                const actaArchivo = getActaArchivo(filaSeleccionada.solicitudId, filaSeleccionada.fila.empleadoCedula);
                const actaRegistrada = getActaRegistrada(filaSeleccionada.solicitudId, filaSeleccionada.fila.empleadoCedula);
                const actaSubida = Boolean(actaRegistrada || actaArchivo?.file);
                const actaGenerada = Boolean(actaArchivo && !actaArchivo.file);

                if (!actaSubida && !actaGenerada) return null;

                return (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-start gap-2">
                    <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-700">
                      <p className="font-semibold">{actaSubida ? 'Acta subida' : 'Acta generada'}</p>
                      <p className="text-emerald-600">{actaSubida ? 'Registrada para esta solicitud y cédula' : 'Pendiente de firma y carga'}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
              {(() => {
                const actaArchivo = getActaArchivo(filaSeleccionada.solicitudId, filaSeleccionada.fila.empleadoCedula);
                const actaRegistrada = getActaRegistrada(filaSeleccionada.solicitudId, filaSeleccionada.fila.empleadoCedula);
                const actaSubida = Boolean(actaRegistrada || actaArchivo?.file);
                const actaFirmadaEnSesion = Boolean(actaArchivo?.file);

                if (actaSubida) {
                  return (
                    <button
                      onClick={() => descargarActaFirmada(filaSeleccionada.solicitudId, filaSeleccionada.fila.empleadoCedula)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition"
                    >
                      <Download size={16} />
                      {actaFirmadaEnSesion ? 'Descargar Acta Firmada' : 'Descargar Acta Subida'}
                    </button>
                  );
                }

                return (
                  <>
                    <button
                      onClick={handleGenerarActaPersonal}
                      disabled={generandoActaPersonal}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition"
                    >
                      <Download size={16} />
                      {generandoActaPersonal ? 'Generando...' : 'Generar Acta'}
                    </button>

                    <button
                      onClick={() => handleUploadArchivo(
                        'acta',
                        solicitudes.find((solicitud) => solicitud.id === filaSeleccionada.solicitudId) ?? solicitudes[0],
                        undefined,
                        filaSeleccionada.fila.empleadoCedula,
                      )}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
                    >
                      <Upload size={16} />
                      Subir Acta
                    </button>
                  </>
                );
              })()}

              <button
                onClick={() => setFilaSeleccionada(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenCompraView;
