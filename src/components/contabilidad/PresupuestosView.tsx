import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Building,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Download,
    FolderOpen,
    Loader2,
    Pencil,
    Plus,
    Save,
    Search,
    Table2,
    Upload,
    Wallet,
    X,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { getNominaCostCenters, type NominaCostCenter } from '../../services/n8nApi';

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;
type MesKey = typeof MESES[number];

const FILAS_POR_PAGINA = 20;

interface CuentaPresupuesto {
    id: number;
    ptp_parqueadero: string;
    ptp_centrocosto: string;
    ptp_area: string;
    ptp_codigocuenta: string | null;
    ptp_nombrecuenta: string | null;
    ptp_detallecuenta: string | null;
    ptp_enero: string | number | null;
    ptp_febrero: string | number | null;
    ptp_marzo: string | number | null;
    ptp_abril: string | number | null;
    ptp_mayo: string | number | null;
    ptp_junio: string | number | null;
    ptp_julio: string | number | null;
    ptp_agosto: string | number | null;
    ptp_septiembre: string | number | null;
    ptp_octubre: string | number | null;
    ptp_noviembre: string | number | null;
    ptp_diciembre: string | number | null;
    ptp_anio: number;
    created_at: string;
}

interface CuentaContable {
    tr_id: number;
    ptp_codigocuenta: string;
    ptp_nombrecuenta: string;
    tipo: string;
}

interface DetalleCuentaContable {
    tr_id: number;
    ptp_detalle: string;
}

interface CentroCostoMaster {
    cost_center_code: string;
    name: string;
    status: string;
}

interface FilaLogSubida {
    fila: number;
    centrocosto: string;
    codigocuenta: string;
    detallecuenta: string;
    anio: number;
    estado: 'creada' | 'actualizada' | 'error';
    mensaje: string;
}

const AREAS = ['CONTABILIDAD', 'TALENTO HUMANO', 'COMPRAS', 'COMERCIAL', 'TECNOLOGIA Y PROYECTOS', 'OPERACIONES'];

// Oculto a pedido del usuario (cambio solo visual); se deja la lógica intacta por si se
// vuelve a mostrar más adelante.
const MOSTRAR_EDICION_MASIVA = false;

const API_BASE = '/api/contabilidad/presupuestos/cuentas';
const API_CUENTAS_CONTABLES = '/api/contabilidad/presupuestos/cuentas-contables';
const API_DETALLE_CUENTA = '/api/contabilidad/presupuestos/detalle-cuenta';
const API_CENTROS_COSTO_MASTER = '/api/contabilidad/presupuestos/centros-costo-master';

// Cache a nivel de modulo (no de componente): el catalogo de parqueaderos viene de un
// webhook externo de n8n que puede tardar varios segundos. Sin esto, React.StrictMode
// (modo desarrollo) monta el efecto dos veces y dispara la misma llamada lenta por
// duplicado; con el cache, la segunda llamada reutiliza la misma promesa en vuelo (o el
// resultado ya resuelto) en vez de volver a golpear la red.
let parqueaderosCachePromise: Promise<NominaCostCenter[]> | null = null;
const cargarParqueaderosCacheado = (): Promise<NominaCostCenter[]> => {
    if (!parqueaderosCachePromise) {
        parqueaderosCachePromise = getNominaCostCenters().catch((error) => {
            parqueaderosCachePromise = null; // permite reintentar si falló
            throw error;
        });
    }
    return parqueaderosCachePromise;
};

let detallesCuentaCachePromise: Promise<DetalleCuentaContable[]> | null = null;
const cargarDetallesCuentaCacheado = (): Promise<DetalleCuentaContable[]> => {
    if (!detallesCuentaCachePromise) {
        detallesCuentaCachePromise = authenticatedFetch(API_DETALLE_CUENTA)
            .then(r => r.json())
            .then((payload: { detalles: DetalleCuentaContable[] }) => payload.detalles ?? [])
            .catch((error) => { detallesCuentaCachePromise = null; throw error; });
    }
    return detallesCuentaCachePromise;
};
// Mantiene el cache al dia cuando se crea un detalle nuevo al vuelo (ver guardarDetalleSiNuevo),
// para que un remount posterior en la misma sesion de pagina no muestre una lista desactualizada.
const agregarDetalleAlCache = (detalle: DetalleCuentaContable) => {
    if (!detallesCuentaCachePromise) return;
    detallesCuentaCachePromise = detallesCuentaCachePromise.then((lista) => (
        lista.some(d => d.tr_id === detalle.tr_id) ? lista : [...lista, detalle]
    ));
};

let catalogoCuentasContablesCachePromise: Promise<CuentaContable[]> | null = null;
const cargarCatalogoCuentasContablesCacheado = (): Promise<CuentaContable[]> => {
    if (!catalogoCuentasContablesCachePromise) {
        catalogoCuentasContablesCachePromise = authenticatedFetch(API_CUENTAS_CONTABLES)
            .then(r => r.json())
            .then((payload: { cuentas: CuentaContable[] }) => payload.cuentas ?? [])
            .catch((error) => { catalogoCuentasContablesCachePromise = null; throw error; });
    }
    return catalogoCuentasContablesCachePromise;
};

let centrosCostoMasterCachePromise: Promise<CentroCostoMaster[]> | null = null;
const cargarCentrosCostoMasterCacheado = (): Promise<CentroCostoMaster[]> => {
    if (!centrosCostoMasterCachePromise) {
        centrosCostoMasterCachePromise = authenticatedFetch(API_CENTROS_COSTO_MASTER)
            .then(r => r.json())
            .then((payload: { centros: CentroCostoMaster[] }) => payload.centros ?? [])
            .catch((error) => { centrosCostoMasterCachePromise = null; throw error; });
    }
    return centrosCostoMasterCachePromise;
};

const obtenerValorMes = (cuenta: CuentaPresupuesto, mes: MesKey): string | number | null => {
    switch (mes) {
        case 'enero': return cuenta.ptp_enero;
        case 'febrero': return cuenta.ptp_febrero;
        case 'marzo': return cuenta.ptp_marzo;
        case 'abril': return cuenta.ptp_abril;
        case 'mayo': return cuenta.ptp_mayo;
        case 'junio': return cuenta.ptp_junio;
        case 'julio': return cuenta.ptp_julio;
        case 'agosto': return cuenta.ptp_agosto;
        case 'septiembre': return cuenta.ptp_septiembre;
        case 'octubre': return cuenta.ptp_octubre;
        case 'noviembre': return cuenta.ptp_noviembre;
        case 'diciembre': return cuenta.ptp_diciembre;
        default: return null;
    }
};

const tipoDeParqueadero = (parqueadero: NominaCostCenter | null): string =>
    parqueadero && parqueadero.CENTROCOSTO.trim().toUpperCase() === 'ADMINISTRACION' ? 'Administracion' : 'Operacion';

interface SelectorCuentaDetalleProps {
    habilitado: boolean;
    tipoCuenta: string;
    catalogoCuentasContables: CuentaContable[];
    detallesCuenta: DetalleCuentaContable[];
    nombreCuentaBusqueda: string;
    nombreCuentaSeleccionada: CuentaContable | null;
    onSeleccionarCuenta: (cuenta: CuentaContable | null, texto: string) => void;
    detalleBusqueda: string;
    onCambiarDetalle: (texto: string) => void;
}

function SelectorCuentaDetalle({
    habilitado, tipoCuenta, catalogoCuentasContables, detallesCuenta,
    nombreCuentaBusqueda, nombreCuentaSeleccionada, onSeleccionarCuenta,
    detalleBusqueda, onCambiarDetalle,
}: SelectorCuentaDetalleProps) {
    const [mostrarListaCuentas, setMostrarListaCuentas] = useState(false);
    const [mostrarListaDetalles, setMostrarListaDetalles] = useState(false);

    // El catalogo completo ya viene cargado una sola vez desde el componente padre;
    // aqui solo se filtra en memoria (por tipo y por texto de busqueda), sin red.
    const cuentasContablesFiltradas = useMemo(() => {
        const base = tipoCuenta ? catalogoCuentasContables.filter(c => c.tipo === tipoCuenta) : catalogoCuentasContables;
        const busqueda = nombreCuentaBusqueda.trim().toLowerCase();
        if (!busqueda) return base.slice(0, 30);
        return base.filter(c => c.ptp_nombrecuenta.toLowerCase().includes(busqueda)).slice(0, 30);
    }, [catalogoCuentasContables, tipoCuenta, nombreCuentaBusqueda]);

    const detallesFiltrados = useMemo(() => {
        const busqueda = detalleBusqueda.trim().toLowerCase();
        if (!busqueda) return detallesCuenta.slice(0, 30);
        return detallesCuenta.filter(d => d.ptp_detalle.toLowerCase().includes(busqueda)).slice(0, 30);
    }, [detallesCuenta, detalleBusqueda]);

    return (
        <>
            <div className="relative">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre de la cuenta</label>
                <input
                    type="text"
                    placeholder="Busca una opción"
                    value={nombreCuentaBusqueda}
                    onChange={(e) => { onSeleccionarCuenta(null, e.target.value); setMostrarListaCuentas(true); }}
                    onFocus={() => setMostrarListaCuentas(true)}
                    onBlur={() => setTimeout(() => setMostrarListaCuentas(false), 150)}
                    disabled={!habilitado}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {mostrarListaCuentas && habilitado && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                        {cuentasContablesFiltradas.length === 0 ? (
                            <p className="px-4 py-2.5 text-[12px] text-slate-400">Sin resultados</p>
                        ) : (
                            cuentasContablesFiltradas.map(c => (
                                <button
                                    key={c.tr_id}
                                    type="button"
                                    onClick={() => {
                                        onSeleccionarCuenta(c, c.ptp_nombrecuenta);
                                        setMostrarListaCuentas(false);
                                        onCambiarDetalle('');
                                    }}
                                    className="block w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-blue-50"
                                >
                                    {c.ptp_nombrecuenta} <span className="text-slate-400 font-mono text-[11px]">({c.ptp_codigocuenta})</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="relative">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Detalle de la cuenta</label>
                <input
                    type="text"
                    placeholder="Busca una opción"
                    value={detalleBusqueda}
                    onChange={(e) => { onCambiarDetalle(e.target.value); setMostrarListaDetalles(true); }}
                    onFocus={() => setMostrarListaDetalles(true)}
                    onBlur={() => setTimeout(() => setMostrarListaDetalles(false), 150)}
                    disabled={!nombreCuentaSeleccionada}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {mostrarListaDetalles && nombreCuentaSeleccionada && detalleBusqueda.trim() && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                        {detallesFiltrados.length === 0 ? (
                            <p className="px-4 py-2.5 text-[12px] text-slate-400">Sin coincidencias — se creará "{detalleBusqueda.trim()}" al guardar</p>
                        ) : (
                            detallesFiltrados.map(d => (
                                <button
                                    key={d.tr_id}
                                    type="button"
                                    onClick={() => { onCambiarDetalle(d.ptp_detalle); setMostrarListaDetalles(false); }}
                                    className="block w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-blue-50"
                                >
                                    {d.ptp_detalle}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default function PresupuestosView() {
    const anioActivo = new Date().getFullYear();
    const aniosDisponibles = useMemo(
        () => [anioActivo + 1, anioActivo, anioActivo - 1],
        [anioActivo]
    );

    const [anioSeleccionado, setAnioSeleccionado] = useState(anioActivo);
    const [cuentas, setCuentas] = useState<CuentaPresupuesto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [parqueaderos, setParqueaderos] = useState<NominaCostCenter[]>([]);
    const [isLoadingParqueaderos, setIsLoadingParqueaderos] = useState(false);

    const [filtroParqueaderoId, setFiltroParqueaderoId] = useState('');
    const [filtroArea, setFiltroArea] = useState('');
    const [filtroNombreCuenta, setFiltroNombreCuenta] = useState('');
    const [pagina, setPagina] = useState(1);

    // Descargar plantilla Excel: exporta la tabla filtrada actual.
    const [isDescargandoPlantilla, setIsDescargandoPlantilla] = useState(false);
    const [errorPlantilla, setErrorPlantilla] = useState('');

    // MODAL: Subir plantilla — flujo de 3 pasos: confirmar -> seleccionar archivo -> resultado (log).
    const inputArchivoPlantillaRef = useRef<HTMLInputElement>(null);
    const [showSubirModal, setShowSubirModal] = useState(false);
    const [pasoSubirPlantilla, setPasoSubirPlantilla] = useState<'confirmar' | 'seleccionar' | 'procesando' | 'resultado'>('confirmar');
    const [logSubidaPlantilla, setLogSubidaPlantilla] = useState<FilaLogSubida[]>([]);
    const [errorSubidaPlantilla, setErrorSubidaPlantilla] = useState('');

    // Catalogos globales (compartidos por los modales de crear, editar y edicion masiva):
    // se cargan UNA sola vez y se filtran en memoria, para que elegir parqueadero/area no
    // dispare una consulta nueva al servidor por cada clic.
    const [detallesCuenta, setDetallesCuenta] = useState<DetalleCuentaContable[]>([]);
    const [catalogoCuentasContables, setCatalogoCuentasContables] = useState<CuentaContable[]>([]);

    // MODAL: Agregar cuenta
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [parqueaderoIdForm, setParqueaderoIdForm] = useState('');
    const [areaForm, setAreaForm] = useState('');
    const [nombreCuentaBusqueda, setNombreCuentaBusqueda] = useState('');
    const [nombreCuentaSeleccionada, setNombreCuentaSeleccionada] = useState<CuentaContable | null>(null);
    const [detalleBusqueda, setDetalleBusqueda] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // MODAL: Editar cuenta
    const [editCuentaModal, setEditCuentaModal] = useState<CuentaPresupuesto | null>(null);
    const [editParqueaderoId, setEditParqueaderoId] = useState('');
    const [editArea, setEditArea] = useState('');
    const [editNombreCuentaBusqueda, setEditNombreCuentaBusqueda] = useState('');
    const [editNombreCuentaSeleccionada, setEditNombreCuentaSeleccionada] = useState<CuentaContable | null>(null);
    const [editDetalleBusqueda, setEditDetalleBusqueda] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [saveEditError, setSaveEditError] = useState('');

    // MODAL: Valores mensuales
    const [valoresModalCuenta, setValoresModalCuenta] = useState<CuentaPresupuesto | null>(null);
    const [valoresMeses, setValoresMeses] = useState<Record<MesKey, string>>({} as Record<MesKey, string>);
    const [editarTodoValor, setEditarTodoValor] = useState('');
    const [isSavingValores, setIsSavingValores] = useState(false);
    const [saveValoresError, setSaveValoresError] = useState('');

    // MODAL: Edicion Masiva. Dos modos: "crear" (nueva cuenta para un grupo de
    // parqueaderos/areas) y "valores" (editar los valores mensuales ya guardados de una
    // cuenta existente, para uno, varios o todos los parqueaderos que la tengan).
    const [showEdicionMasivaModal, setShowEdicionMasivaModal] = useState(false);
    const [modoMasivo, setModoMasivo] = useState<'crear' | 'valores'>('crear');

    const [parqueaderosSeleccionadosMasivo, setParqueaderosSeleccionadosMasivo] = useState<string[]>([]);
    const [areasSeleccionadasMasivo, setAreasSeleccionadasMasivo] = useState<string[]>([]);
    const [nombreCuentaBusquedaMasivo, setNombreCuentaBusquedaMasivo] = useState('');
    const [nombreCuentaSeleccionadaMasivo, setNombreCuentaSeleccionadaMasivo] = useState<CuentaContable | null>(null);
    const [detalleBusquedaMasivo, setDetalleBusquedaMasivo] = useState('');
    const [valoresMesesMasivo, setValoresMesesMasivo] = useState<Record<MesKey, string>>({} as Record<MesKey, string>);
    const [editarTodoValorMasivo, setEditarTodoValorMasivo] = useState('');
    const [isSavingMasivo, setIsSavingMasivo] = useState(false);
    const [saveMasivoError, setSaveMasivoError] = useState('');
    const [resultadoMasivo, setResultadoMasivo] = useState('');

    const [nombreCuentaEditarMasivo, setNombreCuentaEditarMasivo] = useState('');
    const [detalleCuentaEditarMasivo, setDetalleCuentaEditarMasivo] = useState('');
    const [parqueaderosSeleccionadosEditarMasivo, setParqueaderosSeleccionadosEditarMasivo] = useState<string[]>([]);
    const [valoresMesesEditarMasivo, setValoresMesesEditarMasivo] = useState<Record<MesKey, string>>({} as Record<MesKey, string>);
    const [editarTodoValorEditarMasivo, setEditarTodoValorEditarMasivo] = useState('');
    const [isSavingEditarMasivo, setIsSavingEditarMasivo] = useState(false);
    const [saveEditarMasivoError, setSaveEditarMasivoError] = useState('');
    const [resultadoEditarMasivo, setResultadoEditarMasivo] = useState('');

    const cargarCuentas = async (anio: number) => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}?anio=${anio}`);
            if (!response.ok) throw new Error(`Error ${response.status} al cargar las cuentas`);
            const payload = await response.json() as { cuentas: CuentaPresupuesto[] };
            setCuentas(payload.cuentas ?? []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las cuentas del presupuesto.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void cargarCuentas(anioSeleccionado);
    }, [anioSeleccionado]);

    useEffect(() => {
        setIsLoadingParqueaderos(true);
        cargarParqueaderosCacheado()
            .then(setParqueaderos)
            .catch((error) => {
                console.error('[Presupuestos] Error al cargar parqueaderos:', error instanceof Error ? error.message : error);
            })
            .finally(() => setIsLoadingParqueaderos(false));
    }, []);

    useEffect(() => {
        cargarDetallesCuentaCacheado()
            .then(setDetallesCuenta)
            .catch((error) => console.error('[Presupuestos] Error al cargar detalle de cuenta:', error));
    }, []);

    useEffect(() => {
        cargarCatalogoCuentasContablesCacheado()
            .then(setCatalogoCuentasContables)
            .catch((error) => console.error('[Presupuestos] Error al cargar catálogo de cuentas contables:', error));
    }, []);

    const cuentasFiltradas = useMemo(() => {
        const busqueda = filtroNombreCuenta.trim().toLowerCase();
        return cuentas.filter((c) => {
            if (filtroParqueaderoId && c.ptp_centrocosto !== filtroParqueaderoId) return false;
            if (filtroArea && c.ptp_area !== filtroArea) return false;
            if (busqueda && !(c.ptp_nombrecuenta || '').toLowerCase().includes(busqueda)) return false;
            return true;
        });
    }, [cuentas, filtroParqueaderoId, filtroArea, filtroNombreCuenta]);

    useEffect(() => {
        setPagina(1);
    }, [anioSeleccionado, filtroParqueaderoId, filtroArea, filtroNombreCuenta]);

    const totalPaginas = Math.max(1, Math.ceil(cuentasFiltradas.length / FILAS_POR_PAGINA));
    const cuentasPagina = cuentasFiltradas.slice(
        (pagina - 1) * FILAS_POR_PAGINA,
        pagina * FILAS_POR_PAGINA
    );

    // Suma de los 12 meses de cada cuenta visible según los filtros actuales (no solo la
    // página actual), para mostrar un total anual acorde a lo que el usuario está viendo.
    const totalAnualFiltrado = useMemo(() => (
        cuentasFiltradas.reduce((acc, c) => (
            acc + MESES.reduce((sumaMeses, mes) => sumaMeses + Number(obtenerValorMes(c, mes) ?? 0), 0)
        ), 0)
    ), [cuentasFiltradas]);

    const PLANTILLA_COLUMNAS = [
        { header: 'PARQUEADERO', key: 'parqueadero', width: 20 },
        { header: 'CENTRO DE COSTO', key: 'centrocosto', width: 16 },
        { header: 'ÁREA', key: 'area', width: 16 },
        { header: 'CÓDIGO CUENTA', key: 'codigocuenta', width: 16 },
        { header: 'NOMBRE DE LA CUENTA', key: 'nombrecuenta', width: 30 },
        { header: 'DETALLE DE LA CUENTA', key: 'detallecuenta', width: 30 },
        { header: 'AÑO', key: 'anio', width: 10 },
        ...MESES.map(mes => ({ header: mes.toUpperCase(), key: mes, width: 12 })),
    ] as const;

    const descargarPlantilla = async () => {
        setIsDescargandoPlantilla(true);
        setErrorPlantilla('');
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Plantilla Presupuestos');
            worksheet.columns = PLANTILLA_COLUMNAS as unknown as ExcelJS.Column[];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            headerRow.eachCell((cell) => {
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            });

            cuentasFiltradas.forEach((c) => {
                const valoresPorMes: Record<string, number> = {};
                MESES.forEach((mes) => {
                    valoresPorMes[mes] = Number(obtenerValorMes(c, mes) ?? 0);
                });
                const row = worksheet.addRow({
                    parqueadero: c.ptp_parqueadero,
                    centrocosto: c.ptp_centrocosto,
                    area: c.ptp_area,
                    codigocuenta: c.ptp_codigocuenta || '',
                    nombrecuenta: c.ptp_nombrecuenta || '',
                    detallecuenta: c.ptp_detallecuenta || '',
                    anio: c.ptp_anio,
                    ...valoresPorMes,
                });
                row.eachCell((cell) => {
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            const fileName = `Plantilla_Presupuestos_${new Date().toISOString().slice(0, 10)}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            setErrorPlantilla(error instanceof Error ? error.message : 'No se pudo generar la plantilla.');
        } finally {
            setIsDescargandoPlantilla(false);
        }
    };

    const handleSubirPlantilla = async (file: File) => {
        setPasoSubirPlantilla('procesando');
        setErrorSubidaPlantilla('');
        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) throw new Error('El archivo no tiene ninguna hoja.');

            const columnaIndexPorKey: Record<string, number> = {};
            PLANTILLA_COLUMNAS.forEach((col, i) => { columnaIndexPorKey[col.key] = i + 1; });
            const leerCelda = (row: ExcelJS.Row, key: string) => row.getCell(columnaIndexPorKey[key]).value;
            const leerTexto = (row: ExcelJS.Row, key: string) => {
                const texto = String(leerCelda(row, key) ?? '').trim();
                // Algunos archivos externos escriben el texto "NULL" en celdas vacías
                // en vez de dejarlas realmente vacías; se trata igual que vacío.
                return texto.toLowerCase() === 'null' ? '' : texto;
            };
            const leerNumero = (row: ExcelJS.Row, key: string) => {
                const valor = Number(leerCelda(row, key));
                return Number.isFinite(valor) ? valor : 0;
            };

            interface FilaPlantilla {
                fila: number;
                centrocosto: string;
                parqueadero: string;
                area: string;
                codigocuenta: string;
                nombrecuenta: string;
                detallecuenta: string;
                anio: number;
                meses: Record<MesKey, number>;
            }

            // Sin columna ID: cada fila se identifica por la combinacion
            // centro de costo + area + código de cuenta + detalle + año.
            const claveDeFila = (f: { centrocosto: string; area: string; codigocuenta: string; detallecuenta: string; anio: number }) =>
                `${f.centrocosto}|${f.area}|${f.codigocuenta}|${f.detallecuenta}|${f.anio}`;
            const claveDeCuenta = (c: CuentaPresupuesto) =>
                `${c.ptp_centrocosto}|${c.ptp_area}|${c.ptp_codigocuenta || ''}|${c.ptp_detallecuenta || ''}|${c.ptp_anio}`;

            const filas: FilaPlantilla[] = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const centrocosto = leerTexto(row, 'centrocosto');
                if (!centrocosto) return;
                const anio = Number(leerCelda(row, 'anio'));
                if (!Number.isInteger(anio) || anio <= 0) return;
                const meses = {} as Record<MesKey, number>;
                MESES.forEach((mes) => { meses[mes] = leerNumero(row, mes); });
                filas.push({
                    fila: rowNumber,
                    centrocosto,
                    parqueadero: leerTexto(row, 'parqueadero'),
                    area: leerTexto(row, 'area').toUpperCase(),
                    codigocuenta: leerTexto(row, 'codigocuenta'),
                    nombrecuenta: leerTexto(row, 'nombrecuenta'),
                    detallecuenta: leerTexto(row, 'detallecuenta'),
                    anio,
                    meses,
                });
            });

            if (filas.length === 0) throw new Error('No se encontraron filas válidas en el archivo (revisa que Centro de Costo y Año no estén vacíos).');

            const [centrosMaster, catalogoCuentas] = await Promise.all([
                cargarCentrosCostoMasterCacheado(),
                cargarCatalogoCuentasContablesCacheado(),
            ]);

            const centrosCostoValidos = new Set(centrosMaster.map(c => c.cost_center_code.trim().toUpperCase()));
            const codigosCuentaValidos = new Set(catalogoCuentas.map(c => c.ptp_codigocuenta.trim().toUpperCase()));

            const log: FilaLogSubida[] = [];
            let hayCambios = false;

            // Condiciones 1 y 2 primero (no requieren red): separa las filas que sí pueden
            // cargarse de las que ya quedan rechazadas antes de tocar la base de datos.
            const filasValidas: FilaPlantilla[] = [];
            for (const fila of filas) {
                const base = { fila: fila.fila, centrocosto: fila.centrocosto, codigocuenta: fila.codigocuenta, detallecuenta: fila.detallecuenta, anio: fila.anio };

                if (!centrosCostoValidos.has(fila.centrocosto.trim().toUpperCase())) {
                    log.push({ ...base, estado: 'error', mensaje: `No se pudo cargar porque el centro de costo "${fila.centrocosto}" no consta en la lista de parqueaderos master.` });
                    continue;
                }
                if (!fila.codigocuenta || !codigosCuentaValidos.has(fila.codigocuenta.trim().toUpperCase())) {
                    log.push({ ...base, estado: 'error', mensaje: `No se puede cargar debido a que la cuenta contable "${fila.codigocuenta || '(vacío)'}" no existe en la lista de código de cuenta contable.` });
                    continue;
                }
                filasValidas.push(fila);
            }

            // Condición 3: solo se busca si ya existe una fila igual (por llave compuesta) para
            // las filas que pasaron 1 y 2 — en vez de traer la tabla completa (10k+ filas), se
            // pide al servidor solo las que coinciden con esas llaves puntuales.
            const actuales = new Map<string, CuentaPresupuesto>();
            if (filasValidas.length > 0) {
                const respBuscar = await authenticatedFetch(`${API_BASE}/buscar-por-llaves`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        llaves: filasValidas.map(f => ({
                            centroCosto: f.centrocosto, area: f.area, codigoCuenta: f.codigocuenta,
                            detalleCuenta: f.detallecuenta, anio: f.anio,
                        })),
                    }),
                });
                if (!respBuscar.ok) throw new Error('No se pudo obtener el estado actual de las cuentas para comparar.');
                const payload = await respBuscar.json() as { cuentas: CuentaPresupuesto[] };
                payload.cuentas.forEach(c => actuales.set(claveDeCuenta(c), c));
            }

            for (const fila of filasValidas) {
                const base = { fila: fila.fila, centrocosto: fila.centrocosto, codigocuenta: fila.codigocuenta, detallecuenta: fila.detallecuenta, anio: fila.anio };

                // Si ya existe una fila con la misma llave (centro de costo + área + código de
                // cuenta + detalle + año), se sobrescribe; si no existe, se crea nueva.
                const actual = actuales.get(claveDeFila(fila));
                try {
                    if (actual) {
                        const respIdentidad = await authenticatedFetch(`${API_BASE}/${actual.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                parqueadero: actual.ptp_parqueadero,
                                centroCosto: actual.ptp_centrocosto,
                                area: actual.ptp_area,
                                codigoCuenta: actual.ptp_codigocuenta,
                                nombreCuenta: fila.nombrecuenta,
                                detalleCuenta: actual.ptp_detallecuenta,
                            }),
                        });
                        if (!respIdentidad.ok) {
                            const p = await respIdentidad.json().catch(() => null) as { error?: string } | null;
                            throw new Error(p?.error || `Error ${respIdentidad.status}`);
                        }
                        const body: Record<string, number> = {};
                        MESES.forEach((mes) => { body[mes] = fila.meses[mes]; });
                        const respValores = await authenticatedFetch(`${API_BASE}/${actual.id}/valores`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        if (!respValores.ok) {
                            const p = await respValores.json().catch(() => null) as { error?: string } | null;
                            throw new Error(p?.error || `Error ${respValores.status}`);
                        }
                        log.push({ ...base, estado: 'actualizada', mensaje: 'Ya existía: se sobrescribió con los nuevos valores.' });
                        hayCambios = true;
                    } else {
                        const respCrear = await authenticatedFetch(API_BASE, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                parqueadero: fila.parqueadero || fila.centrocosto,
                                centroCosto: fila.centrocosto,
                                area: fila.area,
                                codigoCuenta: fila.codigocuenta,
                                nombreCuenta: fila.nombrecuenta,
                                detalleCuenta: fila.detallecuenta,
                                anio: fila.anio,
                            }),
                        });
                        if (!respCrear.ok) {
                            const p = await respCrear.json().catch(() => null) as { error?: string } | null;
                            throw new Error(p?.error || `Error ${respCrear.status}`);
                        }
                        const creado = await respCrear.json() as { cuenta: CuentaPresupuesto };
                        const body: Record<string, number> = {};
                        MESES.forEach((mes) => { body[mes] = fila.meses[mes]; });
                        const respValores = await authenticatedFetch(`${API_BASE}/${creado.cuenta.id}/valores`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        if (!respValores.ok) {
                            const p = await respValores.json().catch(() => null) as { error?: string } | null;
                            throw new Error(p?.error || `Error ${respValores.status}`);
                        }
                        log.push({ ...base, estado: 'creada', mensaje: 'Fila nueva: no existía, se creó en el presupuesto.' });
                        hayCambios = true;
                    }
                } catch (error) {
                    log.push({ ...base, estado: 'error', mensaje: error instanceof Error ? error.message : 'Error desconocido al guardar la fila.' });
                }
            }

            setLogSubidaPlantilla(log);
            setPasoSubirPlantilla('resultado');
            if (hayCambios) {
                await cargarCuentas(anioSeleccionado);
            }
        } catch (error) {
            setErrorSubidaPlantilla(error instanceof Error ? error.message : 'No se pudo procesar el archivo.');
            setPasoSubirPlantilla('seleccionar');
        }
    };

    const parqueaderoSeleccionadoForm = useMemo(
        () => parqueaderos.find(p => p.IDCENTROCOSTO === parqueaderoIdForm) ?? null,
        [parqueaderos, parqueaderoIdForm]
    );
    const tipoCuentaForm = tipoDeParqueadero(parqueaderoSeleccionadoForm);

    const editParqueaderoSeleccionado = useMemo(
        () => parqueaderos.find(p => p.IDCENTROCOSTO === editParqueaderoId) ?? null,
        [parqueaderos, editParqueaderoId]
    );
    const tipoCuentaEdit = tipoDeParqueadero(editParqueaderoSeleccionado);

    const abrirModalCrear = () => {
        setParqueaderoIdForm('');
        setAreaForm('');
        setNombreCuentaBusqueda('');
        setNombreCuentaSeleccionada(null);
        setDetalleBusqueda('');
        setSaveError('');
        setShowCreateModal(true);
    };

    const guardarDetalleSiNuevo = async (detalle: string): Promise<string> => {
        const valor = detalle.trim();
        if (!valor) return '';
        const response = await authenticatedFetch(API_DETALLE_CUENTA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detalle: valor }),
        });
        const payload = await response.json().catch(() => null) as { detalle?: DetalleCuentaContable; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error || `Error ${response.status} al guardar el detalle de cuenta`);
        setDetallesCuenta(prev => (prev.some(d => d.tr_id === payload!.detalle!.tr_id) ? prev : [...prev, payload!.detalle!]));
        agregarDetalleAlCache(payload!.detalle!);
        return payload!.detalle!.ptp_detalle;
    };

    const handleCrearCuenta = async () => {
        if (!parqueaderoSeleccionadoForm || !areaForm || !nombreCuentaSeleccionada) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const detalleFinal = await guardarDetalleSiNuevo(detalleBusqueda);

            const response = await authenticatedFetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anio: anioSeleccionado,
                    parqueadero: parqueaderoSeleccionadoForm.CENTROCOSTO,
                    centroCosto: parqueaderoSeleccionadoForm.IDCENTROCOSTO,
                    area: areaForm,
                    codigoCuenta: nombreCuentaSeleccionada.ptp_codigocuenta,
                    nombreCuenta: nombreCuentaSeleccionada.ptp_nombrecuenta,
                    detalleCuenta: detalleFinal || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { cuenta?: CuentaPresupuesto; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setCuentas(prev => [payload!.cuenta!, ...prev]);
            setShowCreateModal(false);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
        } finally {
            setIsSaving(false);
        }
    };

    const abrirModalEditar = (cuenta: CuentaPresupuesto) => {
        setEditCuentaModal(cuenta);
        setEditParqueaderoId(cuenta.ptp_centrocosto);
        setEditArea(cuenta.ptp_area);
        setEditNombreCuentaBusqueda(cuenta.ptp_nombrecuenta || '');
        setEditNombreCuentaSeleccionada(
            cuenta.ptp_codigocuenta && cuenta.ptp_nombrecuenta
                ? { tr_id: 0, ptp_codigocuenta: cuenta.ptp_codigocuenta, ptp_nombrecuenta: cuenta.ptp_nombrecuenta, tipo: '' }
                : null
        );
        setEditDetalleBusqueda(cuenta.ptp_detallecuenta || '');
        setSaveEditError('');
    };

    const handleActualizarCuenta = async () => {
        if (!editCuentaModal || !editParqueaderoSeleccionado || !editArea || !editNombreCuentaSeleccionada) return;
        setIsSavingEdit(true);
        setSaveEditError('');
        try {
            const detalleFinal = await guardarDetalleSiNuevo(editDetalleBusqueda);

            const response = await authenticatedFetch(`${API_BASE}/${editCuentaModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parqueadero: editParqueaderoSeleccionado.CENTROCOSTO,
                    centroCosto: editParqueaderoSeleccionado.IDCENTROCOSTO,
                    area: editArea,
                    codigoCuenta: editNombreCuentaSeleccionada.ptp_codigocuenta,
                    nombreCuenta: editNombreCuentaSeleccionada.ptp_nombrecuenta,
                    detalleCuenta: detalleFinal || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { cuenta?: CuentaPresupuesto; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setCuentas(prev => prev.map(c => (c.id === payload!.cuenta!.id ? payload!.cuenta! : c)));
            setEditCuentaModal(null);
        } catch (error) {
            setSaveEditError(error instanceof Error ? error.message : 'No se pudo actualizar la cuenta.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleEliminarCuenta = async () => {
        if (!editCuentaModal) return;
        if (!window.confirm('¿Eliminar esta cuenta del presupuesto? Esta acción no se puede deshacer.')) return;
        setIsSavingEdit(true);
        setSaveEditError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/${editCuentaModal.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setCuentas(prev => prev.filter(c => c.id !== editCuentaModal.id));
            setEditCuentaModal(null);
        } catch (error) {
            setSaveEditError(error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const abrirModalValores = (cuenta: CuentaPresupuesto) => {
        setValoresModalCuenta(cuenta);
        const iniciales = {} as Record<MesKey, string>;
        MESES.forEach((mes) => {
            const valor = obtenerValorMes(cuenta, mes);
            const numero = Number(valor ?? 0);
            iniciales[mes] = numero !== 0 ? String(numero) : '';
        });
        setValoresMeses(iniciales);
        setEditarTodoValor('');
        setSaveValoresError('');
    };

    const totalAnualValores = useMemo(
        () => MESES.reduce((acc, mes) => acc + (Number(valoresMeses[mes]) || 0), 0),
        [valoresMeses]
    );

    const handleAplicarATodos = () => {
        const valor = editarTodoValor.trim();
        if (!valor) return;
        setValoresMeses(prev => {
            const nuevo = { ...prev };
            MESES.forEach((mes) => { nuevo[mes] = valor; });
            return nuevo;
        });
    };

    const handleGuardarValores = async () => {
        if (!valoresModalCuenta) return;
        setIsSavingValores(true);
        setSaveValoresError('');
        try {
            const body: Record<string, number> = {};
            MESES.forEach((mes) => { body[mes] = Number(valoresMeses[mes]) || 0; });

            const response = await authenticatedFetch(`${API_BASE}/${valoresModalCuenta.id}/valores`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => null) as { cuenta?: CuentaPresupuesto; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setCuentas(prev => prev.map(c => (c.id === payload!.cuenta!.id ? payload!.cuenta! : c)));
            setValoresModalCuenta(null);
        } catch (error) {
            setSaveValoresError(error instanceof Error ? error.message : 'No se pudieron guardar los valores.');
        } finally {
            setIsSavingValores(false);
        }
    };

    const abrirEdicionMasiva = () => {
        setShowEdicionMasivaModal(true);
        setModoMasivo('crear');
        setParqueaderosSeleccionadosMasivo([]);
        setAreasSeleccionadasMasivo([]);
        setNombreCuentaBusquedaMasivo('');
        setNombreCuentaSeleccionadaMasivo(null);
        setDetalleBusquedaMasivo('');
        setValoresMesesMasivo({} as Record<MesKey, string>);
        setEditarTodoValorMasivo('');
        setSaveMasivoError('');
        setResultadoMasivo('');
        setNombreCuentaEditarMasivo('');
        setDetalleCuentaEditarMasivo('');
        setParqueaderosSeleccionadosEditarMasivo([]);
        setValoresMesesEditarMasivo({} as Record<MesKey, string>);
        setEditarTodoValorEditarMasivo('');
        setSaveEditarMasivoError('');
        setResultadoEditarMasivo('');
    };

    const toggleParqueaderoMasivo = (id: string) => {
        setParqueaderosSeleccionadosMasivo(prev => (
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        ));
    };

    const toggleTodosParqueaderosMasivo = () => {
        setParqueaderosSeleccionadosMasivo(prev => (
            prev.length === parqueaderos.length ? [] : parqueaderos.map(p => p.IDCENTROCOSTO)
        ));
    };

    const toggleAreaMasivo = (area: string) => {
        setAreasSeleccionadasMasivo(prev => (
            prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
        ));
    };

    const toggleTodasAreasMasivo = () => {
        setAreasSeleccionadasMasivo(prev => (
            prev.length === AREAS.length ? [] : [...AREAS]
        ));
    };

    const tipoCuentaMasivo = useMemo(() => {
        const tipos = new Set(
            parqueaderosSeleccionadosMasivo
                .map(id => parqueaderos.find(p => p.IDCENTROCOSTO === id))
                .filter((p): p is NominaCostCenter => Boolean(p))
                .map(tipoDeParqueadero)
        );
        return tipos.size === 1 ? Array.from(tipos)[0] : '';
    }, [parqueaderosSeleccionadosMasivo, parqueaderos]);

    const totalAnualValoresMasivo = useMemo(
        () => MESES.reduce((acc, mes) => acc + (Number(valoresMesesMasivo[mes]) || 0), 0),
        [valoresMesesMasivo]
    );

    const handleAplicarATodosMasivo = () => {
        const valor = editarTodoValorMasivo.trim();
        if (!valor) return;
        setValoresMesesMasivo(prev => {
            const nuevo = { ...prev };
            MESES.forEach((mes) => { nuevo[mes] = valor; });
            return nuevo;
        });
    };

    const handleGuardarMasivo = async () => {
        if (parqueaderosSeleccionadosMasivo.length === 0 || areasSeleccionadasMasivo.length === 0 || !nombreCuentaSeleccionadaMasivo) return;
        setIsSavingMasivo(true);
        setSaveMasivoError('');
        setResultadoMasivo('');
        try {
            const detalleFinal = await guardarDetalleSiNuevo(detalleBusquedaMasivo);
            const valoresBody: Record<string, number> = {};
            MESES.forEach((mes) => { valoresBody[mes] = Number(valoresMesesMasivo[mes]) || 0; });

            const combinaciones = parqueaderosSeleccionadosMasivo.flatMap((parqueaderoId) => (
                areasSeleccionadasMasivo.map((area) => ({ parqueaderoId, area }))
            ));

            let creadas = 0;
            const errores: string[] = [];

            for (const { parqueaderoId, area } of combinaciones) {
                const parqueadero = parqueaderos.find(p => p.IDCENTROCOSTO === parqueaderoId);
                if (!parqueadero) continue;
                try {
                    const response = await authenticatedFetch(API_BASE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            anio: anioSeleccionado,
                            parqueadero: parqueadero.CENTROCOSTO,
                            centroCosto: parqueadero.IDCENTROCOSTO,
                            area,
                            codigoCuenta: nombreCuentaSeleccionadaMasivo.ptp_codigocuenta,
                            nombreCuenta: nombreCuentaSeleccionadaMasivo.ptp_nombrecuenta,
                            detalleCuenta: detalleFinal || undefined,
                        }),
                    });
                    const payload = await response.json().catch(() => null) as { cuenta?: CuentaPresupuesto; error?: string } | null;
                    if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);

                    const respValores = await authenticatedFetch(`${API_BASE}/${payload!.cuenta!.id}/valores`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(valoresBody),
                    });
                    if (!respValores.ok) {
                        const payloadValores = await respValores.json().catch(() => null) as { error?: string } | null;
                        throw new Error(payloadValores?.error || `Error ${respValores.status} al guardar valores`);
                    }
                    creadas += 1;
                } catch (error) {
                    errores.push(`${parqueadero.CENTROCOSTO} / ${area}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
                }
            }

            setResultadoMasivo(
                `Se crearon ${creadas} de ${combinaciones.length} cuentas.`
                + (errores.length > 0 ? ` Errores: ${errores.join('; ')}` : '')
            );
            if (creadas > 0) {
                await cargarCuentas(anioSeleccionado);
            }
        } catch (error) {
            setSaveMasivoError(error instanceof Error ? error.message : 'No se pudo completar la edición masiva.');
        } finally {
            setIsSavingMasivo(false);
        }
    };

    // Modo "valores": edita los valores mensuales ya guardados de una cuenta existente.
    // Primer paso: elegir parqueadero(s) (igual que en "crear"). El nombre/detalle de
    // cuenta se filtran a lo que exista dentro de esos parqueaderos elegidos.
    const toggleParqueaderoEditarMasivo = (centroCosto: string) => {
        setParqueaderosSeleccionadosEditarMasivo(prev => (
            prev.includes(centroCosto) ? prev.filter(p => p !== centroCosto) : [...prev, centroCosto]
        ));
        setNombreCuentaEditarMasivo('');
        setDetalleCuentaEditarMasivo('');
    };

    const toggleTodosParqueaderosEditarMasivo = () => {
        setParqueaderosSeleccionadosEditarMasivo(prev => (
            prev.length === parqueaderos.length ? [] : parqueaderos.map(p => p.IDCENTROCOSTO)
        ));
        setNombreCuentaEditarMasivo('');
        setDetalleCuentaEditarMasivo('');
    };

    const nombresCuentaDisponiblesEditar = useMemo(
        () => Array.from(new Set(
            cuentas
                .filter(c => parqueaderosSeleccionadosEditarMasivo.includes(c.ptp_centrocosto))
                .map(c => c.ptp_nombrecuenta)
                .filter((n): n is string => Boolean(n))
        )).sort(),
        [cuentas, parqueaderosSeleccionadosEditarMasivo]
    );

    const detallesDisponiblesEditar = useMemo(
        () => Array.from(new Set(
            cuentas
                .filter(c => parqueaderosSeleccionadosEditarMasivo.includes(c.ptp_centrocosto) && c.ptp_nombrecuenta === nombreCuentaEditarMasivo)
                .map(c => c.ptp_detallecuenta || '')
        )).sort(),
        [cuentas, parqueaderosSeleccionadosEditarMasivo, nombreCuentaEditarMasivo]
    );

    const cuentasCoincidentesEditarMasivo = useMemo(
        () => cuentas.filter(c => (
            parqueaderosSeleccionadosEditarMasivo.includes(c.ptp_centrocosto)
            && c.ptp_nombrecuenta === nombreCuentaEditarMasivo
            && (c.ptp_detallecuenta || '') === detalleCuentaEditarMasivo
        )),
        [cuentas, parqueaderosSeleccionadosEditarMasivo, nombreCuentaEditarMasivo, detalleCuentaEditarMasivo]
    );

    const totalAnualValoresEditarMasivo = useMemo(
        () => MESES.reduce((acc, mes) => acc + (Number(valoresMesesEditarMasivo[mes]) || 0), 0),
        [valoresMesesEditarMasivo]
    );

    const handleAplicarATodosEditarMasivo = () => {
        const valor = editarTodoValorEditarMasivo.trim();
        if (!valor) return;
        setValoresMesesEditarMasivo(prev => {
            const nuevo = { ...prev };
            MESES.forEach((mes) => { nuevo[mes] = valor; });
            return nuevo;
        });
    };

    const handleGuardarValoresMasivo = async () => {
        if (cuentasCoincidentesEditarMasivo.length === 0) return;
        setIsSavingEditarMasivo(true);
        setSaveEditarMasivoError('');
        setResultadoEditarMasivo('');
        try {
            const valoresBody: Record<string, number> = {};
            MESES.forEach((mes) => { valoresBody[mes] = Number(valoresMesesEditarMasivo[mes]) || 0; });

            let actualizadas = 0;
            const errores: string[] = [];

            for (const cuenta of cuentasCoincidentesEditarMasivo) {
                try {
                    const response = await authenticatedFetch(`${API_BASE}/${cuenta.id}/valores`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(valoresBody),
                    });
                    const payload = await response.json().catch(() => null) as { error?: string } | null;
                    if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
                    actualizadas += 1;
                } catch (error) {
                    errores.push(`${cuenta.ptp_parqueadero}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
                }
            }

            setResultadoEditarMasivo(
                `Se actualizaron ${actualizadas} de ${cuentasCoincidentesEditarMasivo.length} cuentas.`
                + (errores.length > 0 ? ` Errores: ${errores.join('; ')}` : '')
            );
            if (actualizadas > 0) {
                await cargarCuentas(anioSeleccionado);
            }
        } catch (error) {
            setSaveEditarMasivoError(error instanceof Error ? error.message : 'No se pudo completar la edición masiva de valores.');
        } finally {
            setIsSavingEditarMasivo(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Wallet size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Presupuestos</h2>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="w-full md:w-1/4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Año</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all appearance-none"
                                value={anioSeleccionado}
                                onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                            >
                                {aniosDisponibles.map(a => (
                                    <option key={a} value={a}>{a}{a === anioActivo ? ' (activo)' : ''}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <div className="flex items-stretch gap-2 shrink-0">
                        <button
                            onClick={abrirModalCrear}
                            className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-[#001F3F] hover:bg-blue-900 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                        >
                            <Plus size={16} />
                            cuenta
                        </button>
                        <button
                            onClick={() => void descargarPlantilla()}
                            disabled={isDescargandoPlantilla}
                            title="Descargar Plantilla"
                            className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl text-[10px] uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDescargandoPlantilla ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Plantilla
                        </button>
                        <button
                            onClick={() => {
                                setErrorSubidaPlantilla('');
                                setLogSubidaPlantilla([]);
                                setPasoSubirPlantilla('confirmar');
                                setShowSubirModal(true);
                            }}
                            title="Subir Plantilla"
                            className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl text-[10px] uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all"
                        >
                            <Upload size={16} />
                            Subir
                        </button>
                        {MOSTRAR_EDICION_MASIVA && (
                            <button
                                onClick={abrirEdicionMasiva}
                                className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl text-[10px] uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <Table2 size={16} />
                                Masiva
                            </button>
                        )}
                        <input
                            ref={inputArchivoPlantillaRef}
                            type="file"
                            accept=".xlsx"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleSubirPlantilla(file);
                                e.target.value = '';
                            }}
                        />
                    </div>
                </div>

                {errorPlantilla && (
                    <div className="mt-4 flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {errorPlantilla}
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-64">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Parqueadero</label>
                        <div className="relative">
                            <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all appearance-none disabled:opacity-50"
                                value={filtroParqueaderoId}
                                onChange={(e) => setFiltroParqueaderoId(e.target.value)}
                                disabled={isLoadingParqueaderos}
                            >
                                <option value="">{isLoadingParqueaderos ? 'Cargando...' : 'Todos los parqueaderos'}</option>
                                {parqueaderos.map(p => (
                                    <option key={p.IDCENTROCOSTO} value={p.IDCENTROCOSTO}>{p.CENTROCOSTO}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="w-full md:w-64">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Área</label>
                        <div className="relative">
                            <select
                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all appearance-none"
                                value={filtroArea}
                                onChange={(e) => setFiltroArea(e.target.value)}
                            >
                                <option value="">Selecciona una opción</option>
                                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="w-full md:w-64">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block invisible">Cuenta</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="CUENTA - Buscar por nombre"
                                value={filtroNombreCuenta}
                                onChange={(e) => setFiltroNombreCuenta(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium focus:border-[#001F3F] transition-all placeholder:text-blue-500/70"
                            />
                        </div>
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Total Anual</label>
                    <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-lg font-black text-[#001F3F] whitespace-nowrap">
                            $ {totalAnualFiltrado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                        <colgroup>
                            <col className="w-[16%]" />
                            <col className="w-[12%]" />
                            <col className="w-[24%]" />
                            <col className="w-[24%]" />
                            <col className="w-[8%]" />
                            <col className="w-[16%]" />
                        </colgroup>
                        <thead className="bg-[#F8FAFC] border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Parqueadero</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Área</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre de la Cuenta</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detalle de la Cuenta</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Año</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Valores</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-16 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Cargando...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={6} className="py-16 text-center text-red-500 text-[13px]">{loadError}</td></tr>
                            ) : cuentasFiltradas.length > 0 ? (
                                cuentasPagina.map((cuenta) => (
                                    <tr key={cuenta.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-[13px] font-bold text-slate-700 truncate" title={cuenta.ptp_parqueadero}>{cuenta.ptp_parqueadero}</td>
                                        <td className="px-6 py-4 text-[12px] text-slate-600 truncate" title={cuenta.ptp_area}>{cuenta.ptp_area}</td>
                                        <td className="px-6 py-4 text-[13px] text-slate-700 truncate" title={cuenta.ptp_nombrecuenta || ''}>{cuenta.ptp_nombrecuenta || '-'}</td>
                                        <td className="px-6 py-4 text-[12px] text-slate-600 truncate" title={cuenta.ptp_detallecuenta || ''}>{cuenta.ptp_detallecuenta || ''}</td>
                                        <td className="px-6 py-4 text-[12px] font-bold text-blue-600">{cuenta.ptp_anio}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-6">
                                                <button title="Valores" onClick={() => abrirModalValores(cuenta)} className="text-slate-400 hover:text-[#001F3F] transition-colors">
                                                    <DollarSign size={16} />
                                                </button>
                                                <button title="Editar" onClick={() => abrirModalEditar(cuenta)} className="text-slate-400 hover:text-[#001F3F] transition-colors">
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <Wallet size={32} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-[14px] text-slate-500 font-medium">Aún no hay cuentas registradas para este presupuesto.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {!isLoading && !loadError && totalPaginas > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-[#F8FAFC]">
                        <span className="text-[12px] text-slate-500">
                            Mostrando <span className="font-bold text-slate-700">{(pagina - 1) * FILAS_POR_PAGINA + 1}-{Math.min(pagina * FILAS_POR_PAGINA, cuentasFiltradas.length)}</span> de <span className="font-bold text-slate-700">{cuentasFiltradas.length}</span> registros — hoja {pagina} de {totalPaginas}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPagina(p => Math.max(1, p - 1))}
                                disabled={pagina === 1}
                                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-[12px] font-bold text-slate-700 min-w-[70px] text-center">Hoja {pagina} / {totalPaginas}</span>
                            <button
                                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                                disabled={pagina === totalPaginas}
                                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: Subir plantilla */}
            {showSubirModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => { if (pasoSubirPlantilla !== 'procesando') setShowSubirModal(false); }}
                    />
                    <div className="relative bg-white rounded-2xl w-full max-w-[640px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200 shrink-0">
                            <h3 className="text-xl font-bold text-slate-800">Subir Plantilla</h3>
                            {pasoSubirPlantilla !== 'procesando' && (
                                <button onClick={() => setShowSubirModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                            )}
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            {pasoSubirPlantilla === 'confirmar' && (
                                <>
                                    <p className="text-[14px] text-slate-700">
                                        Vas a subir un archivo Excel para actualizar el presupuesto. Antes de continuar, ten en cuenta:
                                    </p>
                                    <ul className="text-[12px] text-slate-600 list-disc pl-5 leading-relaxed space-y-1.5">
                                        <li>Se validará que el <span className="font-bold">centro de costo</span> de cada fila exista en la lista de parqueaderos master.</li>
                                        <li>Se validará que el <span className="font-bold">código de cuenta contable</span> de cada fila exista en el catálogo de cuentas contables.</li>
                                        <li>Si una fila cumple ambas validaciones y ya existe una cuenta con la misma combinación de centro de costo, área, código de cuenta, detalle y año, <span className="font-bold">se sobrescribirán sus valores</span>. Si no existe, <span className="font-bold">se creará como una fila nueva</span>.</li>
                                        <li>Las filas que no cumplan las validaciones no se cargarán, y quedarán registradas en un log al finalizar.</li>
                                    </ul>
                                </>
                            )}

                            {pasoSubirPlantilla === 'seleccionar' && (
                                <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                        <Upload size={28} />
                                    </div>
                                    <p className="text-[14px] text-slate-700">Selecciona el archivo Excel (.xlsx) que deseas cargar.</p>
                                    {errorSubidaPlantilla && (
                                        <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-md text-left">
                                            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {errorSubidaPlantilla}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => inputArchivoPlantillaRef.current?.click()}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all"
                                    >
                                        <Upload size={16} /> Cargar archivo
                                    </button>
                                </div>
                            )}

                            {pasoSubirPlantilla === 'procesando' && (
                                <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-slate-400">
                                    <Loader2 size={32} className="animate-spin text-slate-300" />
                                    <p className="text-[14px] font-medium text-slate-500">Validando y cargando las filas...</p>
                                </div>
                            )}

                            {pasoSubirPlantilla === 'resultado' && (
                                <>
                                    <div className="flex flex-wrap gap-3">
                                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold">
                                            Creadas: {logSubidaPlantilla.filter(l => l.estado === 'creada').length}
                                        </span>
                                        <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-bold">
                                            Actualizadas: {logSubidaPlantilla.filter(l => l.estado === 'actualizada').length}
                                        </span>
                                        <span className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-bold">
                                            No cargadas: {logSubidaPlantilla.filter(l => l.estado === 'error').length}
                                        </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                                            {logSubidaPlantilla.map((l, idx) => (
                                                <div key={idx} className="flex items-start gap-2 px-4 py-2.5 text-[12px]">
                                                    {l.estado === 'error' ? (
                                                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500" />
                                                    ) : (
                                                        <CheckCircle2 size={14} className={`shrink-0 mt-0.5 ${l.estado === 'creada' ? 'text-emerald-500' : 'text-blue-500'}`} />
                                                    )}
                                                    <div className={l.estado === 'error' ? 'text-red-600' : 'text-slate-600'}>
                                                        <span className="font-bold text-slate-700">Fila {l.fila}</span>
                                                        {' '}({l.centrocosto} / {l.codigocuenta} / {l.detallecuenta || 'sin detalle'} / {l.anio}): {l.mensaje}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            {pasoSubirPlantilla === 'confirmar' && (
                                <>
                                    <button onClick={() => setShowSubirModal(false)} className="px-6 py-2.5 rounded-full border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                                        Cancelar
                                    </button>
                                    <button onClick={() => setPasoSubirPlantilla('seleccionar')} className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all">
                                        Subir
                                    </button>
                                </>
                            )}
                            {pasoSubirPlantilla === 'seleccionar' && (
                                <button onClick={() => setShowSubirModal(false)} className="px-6 py-2.5 rounded-full border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                            )}
                            {pasoSubirPlantilla === 'resultado' && (
                                <>
                                    <button onClick={() => setPasoSubirPlantilla('seleccionar')} className="px-6 py-2.5 rounded-full border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                                        Subir otro archivo
                                    </button>
                                    <button onClick={() => setShowSubirModal(false)} className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all">
                                        Cerrar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Agregar cuenta */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[560px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">Agregar cuenta</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-[14px] text-slate-700">
                                Agrega una nueva cuenta al presupuesto del año <span className="font-bold">{anioSeleccionado}</span>
                            </p>
                            <ul className="text-[12px] text-slate-500 list-disc pl-5 leading-relaxed">
                                <li>Recuerda que un parqueadero, no puede existir más de una cuenta con una misma descripción, en una misma área y en un mismo año.</li>
                            </ul>

                            <div className="flex gap-4">
                                <div className="shrink-0 pt-1 text-slate-300">
                                    <FolderOpen size={32} />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            <span className="text-red-500">*</span> Parqueadero
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer disabled:opacity-50"
                                            value={parqueaderoIdForm}
                                            onChange={(e) => {
                                                setParqueaderoIdForm(e.target.value);
                                                setNombreCuentaBusqueda('');
                                                setNombreCuentaSeleccionada(null);
                                                setDetalleBusqueda('');
                                            }}
                                            disabled={isLoadingParqueaderos}
                                        >
                                            <option value="">{isLoadingParqueaderos ? 'Cargando...' : 'Selecciona un parqueadero'}</option>
                                            {parqueaderos.map(p => (
                                                <option key={p.IDCENTROCOSTO} value={p.IDCENTROCOSTO}>{p.CENTROCOSTO}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            <span className="text-red-500">*</span> Área
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer"
                                            value={areaForm}
                                            onChange={(e) => setAreaForm(e.target.value)}
                                        >
                                            <option value="">Selecciona un area</option>
                                            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>

                                    <SelectorCuentaDetalle
                                        habilitado={Boolean(parqueaderoIdForm)}
                                        tipoCuenta={tipoCuentaForm}
                                        catalogoCuentasContables={catalogoCuentasContables}
                                        detallesCuenta={detallesCuenta}
                                        nombreCuentaBusqueda={nombreCuentaBusqueda}
                                        nombreCuentaSeleccionada={nombreCuentaSeleccionada}
                                        onSeleccionarCuenta={(cuenta, texto) => { setNombreCuentaSeleccionada(cuenta); setNombreCuentaBusqueda(texto); }}
                                        detalleBusqueda={detalleBusqueda}
                                        onCambiarDetalle={setDetalleBusqueda}
                                    />
                                </div>
                            </div>

                            {saveError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveError}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => void handleCrearCuenta()}
                                disabled={!parqueaderoIdForm || !areaForm || !nombreCuentaSeleccionada || isSaving}
                                className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Crear cuenta {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Editar cuenta */}
            {editCuentaModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditCuentaModal(null)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[560px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">Editar cuenta</h3>
                            <button onClick={() => setEditCuentaModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-[14px] text-slate-700">
                                Editar la cuenta del presupuesto del año <span className="font-bold">{editCuentaModal.ptp_anio}</span>
                            </p>
                            <ul className="text-[12px] text-slate-500 list-disc pl-5 leading-relaxed">
                                <li>Recuerda que un parqueadero, no puede existir más de una cuenta con una misma descripción, en una misma área y en un mismo año.</li>
                            </ul>

                            <div className="flex gap-4">
                                <div className="shrink-0 pt-1 text-slate-300">
                                    <FolderOpen size={32} />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            <span className="text-red-500">*</span> Parqueadero
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer disabled:opacity-50"
                                            value={editParqueaderoId}
                                            onChange={(e) => {
                                                setEditParqueaderoId(e.target.value);
                                                setEditNombreCuentaBusqueda('');
                                                setEditNombreCuentaSeleccionada(null);
                                                setEditDetalleBusqueda('');
                                            }}
                                            disabled={isLoadingParqueaderos}
                                        >
                                            <option value="">{isLoadingParqueaderos ? 'Cargando...' : 'Selecciona un parqueadero'}</option>
                                            {parqueaderos.map(p => (
                                                <option key={p.IDCENTROCOSTO} value={p.IDCENTROCOSTO}>{p.CENTROCOSTO}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            <span className="text-red-500">*</span> Área
                                        </label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer"
                                            value={editArea}
                                            onChange={(e) => setEditArea(e.target.value)}
                                        >
                                            <option value="">Selecciona un area</option>
                                            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>

                                    <SelectorCuentaDetalle
                                        habilitado={Boolean(editParqueaderoId)}
                                        tipoCuenta={tipoCuentaEdit}
                                        catalogoCuentasContables={catalogoCuentasContables}
                                        detallesCuenta={detallesCuenta}
                                        nombreCuentaBusqueda={editNombreCuentaBusqueda}
                                        nombreCuentaSeleccionada={editNombreCuentaSeleccionada}
                                        onSeleccionarCuenta={(cuenta, texto) => { setEditNombreCuentaSeleccionada(cuenta); setEditNombreCuentaBusqueda(texto); }}
                                        detalleBusqueda={editDetalleBusqueda}
                                        onCambiarDetalle={setEditDetalleBusqueda}
                                    />
                                </div>
                            </div>

                            {saveEditError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveEditError}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-between">
                            <button
                                onClick={() => void handleEliminarCuenta()}
                                disabled={isSavingEdit}
                                className="px-6 py-2.5 rounded-full border-2 border-red-500 text-red-500 font-bold hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                eliminar
                            </button>
                            <button
                                onClick={() => void handleActualizarCuenta()}
                                disabled={!editParqueaderoId || !editArea || !editNombreCuentaSeleccionada || isSavingEdit}
                                className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Actualizar cuenta {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Valores mensuales */}
            {valoresModalCuenta && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setValoresModalCuenta(null)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[880px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-[#F8FAFC]">
                            <h3 className="text-xl font-bold text-slate-800">Valores para la cuenta:</h3>
                            <button onClick={() => setValoresModalCuenta(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="p-6">
                            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                                <div className="space-y-1 text-[13px]">
                                    <p><span className="font-bold text-slate-800">Año:</span> <span className="text-slate-600">{valoresModalCuenta.ptp_anio}</span></p>
                                    <p><span className="font-bold text-slate-800">Area:</span> <span className="text-slate-600">{valoresModalCuenta.ptp_area}</span></p>
                                    <p><span className="font-bold text-slate-800">Parqueadero:</span> <span className="text-slate-600">{valoresModalCuenta.ptp_parqueadero}</span></p>
                                    <p><span className="font-bold text-slate-800">Nombre de la cuenta:</span> <span className="text-slate-600">{valoresModalCuenta.ptp_nombrecuenta || '-'}</span></p>
                                    <p><span className="font-bold text-slate-800">Detalle de la cuenta:</span> <span className="text-slate-600">{valoresModalCuenta.ptp_detallecuenta || 'sin detalle'}</span></p>
                                </div>
                                <div className="shrink-0 bg-white border border-slate-200 rounded-xl p-4 w-full md:w-[220px] h-fit">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><DollarSign size={16} /></div>
                                        <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider ml-auto">Anual</span>
                                    </div>
                                    <p className="text-[20px] font-bold text-slate-800">$ {totalAnualValores.toFixed(2)}</p>
                                    <p className="text-[11px] text-slate-500 mt-1"><span className="font-bold">Presupuesto:</span> {valoresModalCuenta.ptp_anio}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="EDITAR TODO - Valor para todos los meses"
                                    value={editarTodoValor}
                                    onChange={(e) => setEditarTodoValor(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-[13px] text-blue-600 placeholder:text-blue-500/70 outline-none focus:border-blue-400"
                                />
                                <button
                                    onClick={handleAplicarATodos}
                                    disabled={!editarTodoValor.trim()}
                                    className="px-5 py-3 bg-blue-50 text-blue-300 rounded-full text-[12px] font-bold disabled:cursor-not-allowed enabled:text-blue-600 enabled:hover:bg-blue-100 transition-colors shrink-0"
                                >
                                    aplicar a todo
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {MESES.map((mes) => (
                                    <div key={mes} className="flex items-center gap-1.5 px-4 py-3 border border-slate-300 rounded-xl">
                                        <span className="text-[12px] font-bold text-blue-600 uppercase shrink-0">{mes} -</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="ejm: 27.00"
                                            value={valoresMeses[mes] ?? ''}
                                            onChange={(e) => setValoresMeses(prev => ({ ...prev, [mes]: e.target.value }))}
                                            className="flex-1 min-w-0 outline-none text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent"
                                        />
                                    </div>
                                ))}
                            </div>

                            {saveValoresError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveValoresError}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-slate-200">
                            <button onClick={() => setValoresModalCuenta(null)} className="text-slate-500 hover:text-slate-700 text-[13px] font-medium">cancelar</button>
                            <button
                                onClick={() => void handleGuardarValores()}
                                disabled={isSavingValores}
                                className="px-8 py-2.5 bg-[#001F3F] hover:bg-blue-900 text-white rounded-full font-bold text-[13px] disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSavingValores ? <Loader2 size={16} className="animate-spin" /> : null} guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Edición Masiva */}
            {showEdicionMasivaModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEdicionMasivaModal(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[700px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-[#F8FAFC] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Table2 size={20} /></div>
                                <h3 className="text-xl font-bold text-slate-800">Edición Masiva</h3>
                            </div>
                            <button onClick={() => setShowEdicionMasivaModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="flex gap-2 p-1 mx-6 mt-5 bg-slate-100 rounded-xl shrink-0">
                            <button
                                type="button"
                                onClick={() => setModoMasivo('crear')}
                                className={`flex-1 px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${modoMasivo === 'crear' ? 'bg-white text-[#001F3F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Crear cuenta nueva
                            </button>
                            <button
                                type="button"
                                onClick={() => setModoMasivo('valores')}
                                className={`flex-1 px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${modoMasivo === 'valores' ? 'bg-white text-[#001F3F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Editar valores existentes
                            </button>
                        </div>

                        {modoMasivo === 'crear' ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                <p className="text-[14px] text-slate-700">
                                    Crea la misma cuenta, con los mismos valores mensuales, para varios parqueaderos a la vez en el presupuesto del año <span className="font-bold">{anioSeleccionado}</span>.
                                </p>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <span className="text-red-500">*</span> Parqueaderos
                                        </label>
                                        <button
                                            type="button"
                                            onClick={toggleTodosParqueaderosMasivo}
                                            className="text-[11px] font-bold text-blue-600 hover:underline"
                                        >
                                            {parqueaderosSeleccionadosMasivo.length === parqueaderos.length && parqueaderos.length > 0 ? 'Quitar todos' : 'Seleccionar todos'}
                                        </button>
                                    </div>
                                    <div className="border border-slate-300 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                                        {isLoadingParqueaderos ? (
                                            <p className="px-4 py-3 text-[12px] text-slate-400">Cargando...</p>
                                        ) : (
                                            parqueaderos.map(p => (
                                                <label key={p.IDCENTROCOSTO} className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={parqueaderosSeleccionadosMasivo.includes(p.IDCENTROCOSTO)}
                                                        onChange={() => toggleParqueaderoMasivo(p.IDCENTROCOSTO)}
                                                        className="accent-[#2563EB]"
                                                    />
                                                    {p.CENTROCOSTO}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">{parqueaderosSeleccionadosMasivo.length} parqueadero(s) seleccionado(s)</p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <span className="text-red-500">*</span> Áreas
                                        </label>
                                        <button
                                            type="button"
                                            onClick={toggleTodasAreasMasivo}
                                            className="text-[11px] font-bold text-blue-600 hover:underline"
                                        >
                                            {areasSeleccionadasMasivo.length === AREAS.length ? 'Quitar todas' : 'Seleccionar todas'}
                                        </button>
                                    </div>
                                    <div className="border border-slate-300 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                                        {AREAS.map(a => (
                                            <label key={a} className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={areasSeleccionadasMasivo.includes(a)}
                                                    onChange={() => toggleAreaMasivo(a)}
                                                    className="accent-[#2563EB]"
                                                />
                                                {a}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">{areasSeleccionadasMasivo.length} área(s) seleccionada(s)</p>
                                </div>

                                <SelectorCuentaDetalle
                                    habilitado={parqueaderosSeleccionadosMasivo.length > 0}
                                    tipoCuenta={tipoCuentaMasivo}
                                    catalogoCuentasContables={catalogoCuentasContables}
                                    detallesCuenta={detallesCuenta}
                                    nombreCuentaBusqueda={nombreCuentaBusquedaMasivo}
                                    nombreCuentaSeleccionada={nombreCuentaSeleccionadaMasivo}
                                    onSeleccionarCuenta={(cuenta, texto) => { setNombreCuentaSeleccionadaMasivo(cuenta); setNombreCuentaBusquedaMasivo(texto); }}
                                    detalleBusqueda={detalleBusquedaMasivo}
                                    onCambiarDetalle={setDetalleBusquedaMasivo}
                                />

                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Valores mensuales (se aplican igual a cada parqueadero seleccionado)</label>
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="EDITAR TODO - Valor para todos los meses"
                                            value={editarTodoValorMasivo}
                                            onChange={(e) => setEditarTodoValorMasivo(e.target.value)}
                                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] text-blue-600 placeholder:text-blue-500/70 outline-none focus:border-blue-400"
                                        />
                                        <button
                                            onClick={handleAplicarATodosMasivo}
                                            disabled={!editarTodoValorMasivo.trim()}
                                            className="px-5 py-2.5 bg-blue-50 text-blue-300 rounded-full text-[12px] font-bold disabled:cursor-not-allowed enabled:text-blue-600 enabled:hover:bg-blue-100 transition-colors shrink-0"
                                        >
                                            aplicar a todo
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {MESES.map((mes) => (
                                            <div key={mes} className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-300 rounded-xl">
                                                <span className="text-[11px] font-bold text-blue-600 uppercase shrink-0">{mes} -</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="ejm: 27.00"
                                                    value={valoresMesesMasivo[mes] ?? ''}
                                                    onChange={(e) => setValoresMesesMasivo(prev => ({ ...prev, [mes]: e.target.value }))}
                                                    className="flex-1 min-w-0 outline-none text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[12px] text-slate-500 mt-2">Total anual por parqueadero: <span className="font-bold text-slate-700">$ {totalAnualValoresMasivo.toFixed(2)}</span></p>
                                </div>

                                {saveMasivoError && (
                                    <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveMasivoError}
                                    </div>
                                )}
                                {resultadoMasivo && (
                                    <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{resultadoMasivo}</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                <p className="text-[14px] text-slate-700">
                                    Edita los valores mensuales ya guardados de una cuenta, para uno, varios o todos los parqueaderos que la tengan, en el presupuesto del año <span className="font-bold">{anioSeleccionado}</span>.
                                </p>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <span className="text-red-500">*</span> Parqueaderos
                                        </label>
                                        <button
                                            type="button"
                                            onClick={toggleTodosParqueaderosEditarMasivo}
                                            className="text-[11px] font-bold text-blue-600 hover:underline"
                                        >
                                            {parqueaderosSeleccionadosEditarMasivo.length === parqueaderos.length && parqueaderos.length > 0 ? 'Quitar todos' : 'Seleccionar todos'}
                                        </button>
                                    </div>
                                    <div className="border border-slate-300 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                                        {isLoadingParqueaderos ? (
                                            <p className="px-4 py-3 text-[12px] text-slate-400">Cargando...</p>
                                        ) : (
                                            parqueaderos.map(p => (
                                                <label key={p.IDCENTROCOSTO} className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={parqueaderosSeleccionadosEditarMasivo.includes(p.IDCENTROCOSTO)}
                                                        onChange={() => toggleParqueaderoEditarMasivo(p.IDCENTROCOSTO)}
                                                        className="accent-[#2563EB]"
                                                    />
                                                    {p.CENTROCOSTO}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">{parqueaderosSeleccionadosEditarMasivo.length} parqueadero(s) seleccionado(s)</p>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        <span className="text-red-500">*</span> Nombre de la cuenta
                                    </label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer disabled:opacity-50"
                                        value={nombreCuentaEditarMasivo}
                                        onChange={(e) => {
                                            setNombreCuentaEditarMasivo(e.target.value);
                                            setDetalleCuentaEditarMasivo('');
                                        }}
                                        disabled={parqueaderosSeleccionadosEditarMasivo.length === 0}
                                    >
                                        <option value="">{parqueaderosSeleccionadosEditarMasivo.length === 0 ? 'Elige parqueadero(s) primero' : 'Selecciona una cuenta'}</option>
                                        {nombresCuentaDisponiblesEditar.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>

                                {nombreCuentaEditarMasivo && (
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Detalle de la cuenta</label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white cursor-pointer"
                                            value={detalleCuentaEditarMasivo}
                                            onChange={(e) => setDetalleCuentaEditarMasivo(e.target.value)}
                                        >
                                            <option value="">(sin detalle)</option>
                                            {detallesDisponiblesEditar.filter(d => d).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                )}

                                {nombreCuentaEditarMasivo && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                        <p className="text-[12px] text-slate-600">
                                            Se actualizarán <span className="font-bold text-slate-800">{cuentasCoincidentesEditarMasivo.length}</span> de los {parqueaderosSeleccionadosEditarMasivo.length} parqueadero(s) seleccionado(s) (los que ya tienen esta cuenta):
                                        </p>
                                        {cuentasCoincidentesEditarMasivo.length > 0 && (
                                            <p className="text-[12px] text-slate-700 mt-1">{cuentasCoincidentesEditarMasivo.map(c => c.ptp_parqueadero).join(', ')}</p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nuevos valores mensuales (sobrescriben los actuales en cada parqueadero seleccionado)</label>
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="EDITAR TODO - Valor para todos los meses"
                                            value={editarTodoValorEditarMasivo}
                                            onChange={(e) => setEditarTodoValorEditarMasivo(e.target.value)}
                                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] text-blue-600 placeholder:text-blue-500/70 outline-none focus:border-blue-400"
                                        />
                                        <button
                                            onClick={handleAplicarATodosEditarMasivo}
                                            disabled={!editarTodoValorEditarMasivo.trim()}
                                            className="px-5 py-2.5 bg-blue-50 text-blue-300 rounded-full text-[12px] font-bold disabled:cursor-not-allowed enabled:text-blue-600 enabled:hover:bg-blue-100 transition-colors shrink-0"
                                        >
                                            aplicar a todo
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {MESES.map((mes) => (
                                            <div key={mes} className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-300 rounded-xl">
                                                <span className="text-[11px] font-bold text-blue-600 uppercase shrink-0">{mes} -</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="ejm: 27.00"
                                                    value={valoresMesesEditarMasivo[mes] ?? ''}
                                                    onChange={(e) => setValoresMesesEditarMasivo(prev => ({ ...prev, [mes]: e.target.value }))}
                                                    className="flex-1 min-w-0 outline-none text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[12px] text-slate-500 mt-2">Total anual por parqueadero: <span className="font-bold text-slate-700">$ {totalAnualValoresEditarMasivo.toFixed(2)}</span></p>
                                </div>

                                {saveEditarMasivoError && (
                                    <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveEditarMasivoError}
                                    </div>
                                )}
                                {resultadoEditarMasivo && (
                                    <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{resultadoEditarMasivo}</div>
                                )}
                            </div>
                        )}

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowEdicionMasivaModal(false)} className="px-6 py-2.5 font-medium text-slate-600 hover:text-slate-800 transition-colors text-[13px]">Cerrar</button>
                            {modoMasivo === 'crear' ? (
                                <button
                                    onClick={() => void handleGuardarMasivo()}
                                    disabled={parqueaderosSeleccionadosMasivo.length === 0 || areasSeleccionadasMasivo.length === 0 || !nombreCuentaSeleccionadaMasivo || isSavingMasivo}
                                    className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Crear cuentas {isSavingMasivo ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                </button>
                            ) : (
                                <button
                                    onClick={() => void handleGuardarValoresMasivo()}
                                    disabled={cuentasCoincidentesEditarMasivo.length === 0 || isSavingEditarMasivo}
                                    className="px-6 py-2.5 rounded-full border-2 border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Guardar valores {isSavingEditarMasivo ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
