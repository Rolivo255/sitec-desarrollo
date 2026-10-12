import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getReporteRecaudacionDetalle, getReporteTransferenciaDetalle } from '../../services/n8nApi';
import DetalleBusquedaView from './DetalleBusquedaView';
import {
    AlertTriangle,
    Calendar,
    Copy,
    Download,
    FileText,
    List,
    Loader2,
    Upload,
} from 'lucide-react';

type BancoKey = 'pichincha' | 'pichincha_ahorros' | 'internacional' | 'internacional_pp';

type ArchivosPorBanco = Record<BancoKey, File | null>;

interface HistorialCarga {
    id: string;
    archivo: string;
    fecha: string;
    total: number;
    duplicados: number;
    cargados: number;
    estado: string;
}

interface FilaLiquidacionBanco {
    fecha: string;
    codigo: string;
    concepto: string;
    tipo: string;
    documento: string;
    oficina: string;
    monto: number;
}

interface RespuestaCargaLiquidacionBanco {
    id: string;
    nombreArchivo: string;
    fecha: string;
    total: number;
    duplicados: number;
    cargados: number;
    estado: string;
}

const UPLOAD_ENDPOINTS: Record<BancoKey, string> = {
    pichincha: '/api/contabilidad/liquidacion-bancos/pichincha/upload',
    pichincha_ahorros: '/api/contabilidad/liquidacion-bancos/pichincha-ahorros/upload',
    internacional: '/api/contabilidad/liquidacion-bancos/internacional/upload',
    internacional_pp: '/api/contabilidad/liquidacion-bancos/internacional-pp/upload',
};

const HISTORIAL_ENDPOINT = '/api/contabilidad/liquidacion-bancos/historial';

const parseFechaCelda = (valor: unknown): string => {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        const dd = String(valor.getDate()).padStart(2, '0');
        const mm = String(valor.getMonth() + 1).padStart(2, '0');
        const yyyy = String(valor.getFullYear());
        return `${dd}/${mm}/${yyyy}`;
    }

    if (typeof valor === 'number' && Number.isFinite(valor) && valor > 20000 && valor < 60000) {
        const formatted = String(XLSX.SSF.format('dd/mm/yyyy', valor)).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) return formatted;
    }

    const texto = String(valor ?? '').trim();
    const match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
        return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
    }

    return '';
};

const parseMontoCelda = (valor: unknown): number => {
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

const parseExcelLiquidacionBanco = async (file: File): Promise<FilaLiquidacionBanco[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', raw: false });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '' });

    return filas
        .slice(1)
        .filter(fila => Array.isArray(fila) && fila.some(celda => String(celda ?? '').trim() !== ''))
        .map(fila => ({
            fecha: parseFechaCelda(fila[0]),
            codigo: String(fila[1] ?? '').trim(),
            concepto: String(fila[2] ?? '').trim(),
            tipo: String(fila[3] ?? '').trim(),
            documento: String(fila[4] ?? '').trim(),
            oficina: String(fila[5] ?? '').trim(),
            monto: parseMontoCelda(fila[6]),
        }))
        .filter(fila => fila.fecha && fila.documento);
};

// Banco Internacional / Internacional PP tienen encabezados y filas de metadata
// en posiciones fijas dentro del archivo; el backend valida esa estructura,
// por lo que aquí solo se envía la grilla cruda tal como viene del Excel.
const parseExcelRawGrid = async (file: File): Promise<unknown[][]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', raw: false });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '' });
};

const BANCO_PARSERS: Record<BancoKey, (file: File) => Promise<unknown>> = {
    pichincha: parseExcelLiquidacionBanco,
    pichincha_ahorros: parseExcelLiquidacionBanco,
    internacional: parseExcelRawGrid,
    internacional_pp: parseExcelRawGrid,
};

const formatearFechaHistorial = (fechaIso: string): string => {
    const fecha = new Date(fechaIso);
    return Number.isNaN(fecha.getTime())
        ? fechaIso
        : fecha.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'medium' });
};

const estadoBadgeClass = (estado: string) => {
    switch (estado) {
        case 'exito':
        case 'completo':
            return 'bg-emerald-500';
        case 'parcial':
            return 'bg-amber-500';
        case 'error':
            return 'bg-red-500';
        default:
            return 'bg-[#64748B]';
    }
};

const BANCOS: { key: BancoKey; titulo: string; descripcion: string }[] = [
    { key: 'pichincha', titulo: 'Banco Pichincha', descripcion: 'Por favor seleccione un archivo para cargar Banco Pichincha. Recuerde que el archivo debe ser uno solo, con la extensión .xls y la estructura correcta.' },
    { key: 'pichincha_ahorros', titulo: 'Banco Pichincha Ahorros', descripcion: 'Por favor seleccione un archivo para cargar Banco Pichincha Ahorros. Recuerde que el archivo debe ser uno solo, con la extensión .xls y la estructura correcta.' },
    { key: 'internacional', titulo: 'Banco Internacional', descripcion: 'Por favor seleccione un archivo para cargar Banco Internacional. Recuerde que el archivo debe ser uno solo, con la extensión .xls y la estructura correcta.' },
    { key: 'internacional_pp', titulo: 'Banco Internacional PP', descripcion: 'Por favor seleccione un archivo para cargar Banco Internacional PP. Recuerde que el archivo debe ser uno solo, con la extensión .xls y la estructura correcta.' },
];

export default function LiquidacionBancosView() {
    const [activeTab, setActiveTab] = useState<'carga_archivos' | 'detalle_recaudacion' | 'detalle_transferencia'>('carga_archivos');
    const [archivos, setArchivos] = useState<ArchivosPorBanco>({
        pichincha: null,
        pichincha_ahorros: null,
        internacional: null,
        internacional_pp: null,
    });
    const [historial, setHistorial] = useState<HistorialCarga[]>([]);
    const [isLoadingHistorial, setIsLoadingHistorial] = useState(true);
    const [historialError, setHistorialError] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [fileToLoad, setFileToLoad] = useState<File | null>(null);
    const [loadType, setLoadType] = useState<BancoKey | ''>('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');

    useEffect(() => {
        let cancelado = false;

        const cargarHistorial = async () => {
            setIsLoadingHistorial(true);
            setHistorialError('');
            try {
                const response = await authenticatedFetch(HISTORIAL_ENDPOINT);
                if (!response.ok) {
                    throw new Error(`Error ${response.status} al cargar el historial`);
                }
                const payload = await response.json() as { historial: HistorialCarga[] };
                if (!cancelado) {
                    setHistorial(payload.historial ?? []);
                }
            } catch (error) {
                if (!cancelado) {
                    setHistorialError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
                }
            } finally {
                if (!cancelado) {
                    setIsLoadingHistorial(false);
                }
            }
        };

        void cargarHistorial();

        return () => {
            cancelado = true;
        };
    }, []);

    const handleFileSelect = (key: BancoKey, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setArchivos(prev => ({ ...prev, [key]: e.target.files![0] }));
        }
    };

    const triggerFileInput = (id: string) => {
        document.getElementById(id)?.click();
    };

    const handleIniciarCarga = (key: BancoKey) => {
        if (!archivos[key]) return;
        setLoadType(key);
        setFileToLoad(archivos[key]);
        setConfirmError('');
        setShowConfirmModal(true);
    };

    const cerrarModalConfirmacion = () => {
        if (isConfirming) return;
        setShowConfirmModal(false);
        setConfirmError('');
    };

    const confirmCarga = async () => {
        if (!fileToLoad || !loadType) return;

        const endpoint = UPLOAD_ENDPOINTS[loadType];
        const parseArchivo = BANCO_PARSERS[loadType];

        setIsConfirming(true);
        setConfirmError('');

        try {
            const filas = await parseArchivo(fileToLoad);

            if (Array.isArray(filas) && filas.length === 0) {
                throw new Error('No se encontraron filas válidas en el archivo. Verifique la estructura y las columnas requeridas.');
            }

            const response = await authenticatedFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombreArchivo: fileToLoad.name, filas }),
            });

            const payload = await response.json().catch(() => null) as RespuestaCargaLiquidacionBanco | { error?: string; details?: string } | null;

            if (!response.ok) {
                const errorPayload = payload as { error?: string; details?: string } | null;
                throw new Error(errorPayload?.error || errorPayload?.details || `Error ${response.status} al procesar la carga`);
            }

            const resultado = payload as RespuestaCargaLiquidacionBanco;
            const newRecord: HistorialCarga = {
                id: resultado.id,
                archivo: resultado.nombreArchivo,
                fecha: resultado.fecha,
                total: resultado.total,
                duplicados: resultado.duplicados,
                cargados: resultado.cargados,
                estado: resultado.estado,
            };
            setHistorial(prev => [newRecord, ...prev]);
            setArchivos(prev => ({ ...prev, [loadType]: null }));
            setShowConfirmModal(false);
        } catch (error) {
            setConfirmError(error instanceof Error ? error.message : 'No se pudo procesar el archivo.');
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-2xl shadow-sm mb-4">
                <button
                    onClick={() => setActiveTab('carga_archivos')}
                    className={`px-8 py-2.5 text-[14px] font-medium rounded-xl transition-all ${activeTab === 'carga_archivos' ? 'bg-blue-50/50 text-blue-600 border border-blue-200/60 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}`}
                >
                    Carga de Archivos
                </button>
                <button
                    onClick={() => setActiveTab('detalle_recaudacion')}
                    className={`px-8 py-2.5 text-[14px] font-medium rounded-xl transition-all ${activeTab === 'detalle_recaudacion' ? 'bg-blue-50/50 text-blue-600 border border-blue-200/60 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}`}
                >
                    Detalle Recaudación
                </button>
                <button
                    onClick={() => setActiveTab('detalle_transferencia')}
                    className={`px-8 py-2.5 text-[14px] font-medium rounded-xl transition-all ${activeTab === 'detalle_transferencia' ? 'bg-blue-50/50 text-blue-600 border border-blue-200/60 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}`}
                >
                    Detalle Transferencia
                </button>
            </div>

            {activeTab === 'carga_archivos' && (
                <div>
                    <div className="grid grid-cols-1 gap-6 mb-8">
                        {BANCOS.map(banco => {
                            const inputId = `file-${banco.key.replace(/_/g, '-')}`;
                            const archivo = archivos[banco.key];
                            return (
                                <div key={banco.key} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-8">
                                    <div
                                        onClick={() => triggerFileInput(inputId)}
                                        className="w-64 h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-colors shrink-0 text-center"
                                    >
                                        <FileText size={32} className="text-orange-500 mb-2" />
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            {archivo ? <span className="text-blue-600 font-bold">{archivo.name}</span> : 'Arrastra y suelta aquí el archivo para cargar, o haz clic para seleccionar archivos'}
                                        </p>
                                        <input type="file" id={inputId} className="hidden" accept=".xls,.xlsx" onChange={(e) => handleFileSelect(banco.key, e)} />
                                    </div>
                                    <div className="flex-1 flex justify-between items-center">
                                        <div>
                                            <h3 className="text-[#0EA5E9] font-black text-[18px] mb-2">{banco.titulo}</h3>
                                            <p className="text-[13px] text-slate-600">{banco.descripcion}</p>
                                        </div>
                                        <button
                                            onClick={() => handleIniciarCarga(banco.key)}
                                            disabled={!archivo}
                                            className={`ml-4 px-6 py-3 rounded-full text-[13px] font-bold shadow-sm flex items-center gap-2 transition-all shrink-0
                                                ${archivo ? 'bg-[#64748B] hover:bg-slate-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            <Upload size={16} /> INICIAR CARGA DE DATOS
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <h2 className="text-[20px] font-medium text-slate-800 mb-1">Historial de Cargas de Estados de Bancos</h2>
                        <p className="text-[12px] text-slate-500 mb-4">Este historial muestra <span className="font-bold text-slate-700">20 registros más recientes</span>, de los últimos días.</p>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-[#F8FAFC] border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><FileText size={14} /> NOMBRE DEL ARCHIVO</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Calendar size={14} /> FECHA</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><List size={14} /> TOTAL</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Copy size={14} /> DUPLICADOS</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Upload size={14} /> CARGADOS</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Loader2 size={14} /> ESTADO</div></th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center"><div className="flex justify-center items-center gap-2"><Download size={14} /> DESCARGAR</div></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoadingHistorial ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-[13px]">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 size={16} className="animate-spin" /> Cargando historial...
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : historialError ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-10 text-center text-red-600 text-[13px]">
                                                    {historialError}
                                                </td>
                                            </tr>
                                        ) : historial.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-[13px]">
                                                    Aún no se han registrado cargas.
                                                </td>
                                            </tr>
                                        ) : historial.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-[12px] text-slate-700">{item.archivo}</td>
                                                <td className="px-6 py-4 text-[12px] text-slate-600">{formatearFechaHistorial(item.fecha)}</td>
                                                <td className="px-6 py-4 text-[13px] font-medium text-slate-700">{item.total}</td>
                                                <td className="px-6 py-4 text-[13px] font-medium text-slate-700">{item.duplicados}</td>
                                                <td className="px-6 py-4 text-[13px] font-medium text-slate-700">{item.cargados}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold text-white ${estadoBadgeClass(item.estado)}`}>
                                                        {item.estado}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button className="p-1.5 text-blue-400 hover:text-blue-600 bg-blue-50 rounded-lg border border-blue-100 transition-colors mx-auto block">
                                                        <Download size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'detalle_recaudacion' && (
                <DetalleBusquedaView titulo="Detalle Recaudación" fetchDetalle={getReporteRecaudacionDetalle} />
            )}

            {activeTab === 'detalle_transferencia' && (
                <DetalleBusquedaView titulo="Detalle Transferencia" fetchDetalle={getReporteTransferenciaDetalle} />
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={cerrarModalConfirmacion} />
                    <div className="relative bg-[#F8FAFC] rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-5 border-b border-slate-200 bg-white">
                            <h3 className="text-[18px] font-medium text-slate-800">Carga de datos</h3>
                        </div>
                        <div className="p-8 flex flex-col items-center text-center bg-[#F8FAFC]">
                            <div className="mb-4 text-orange-500">
                                <AlertTriangle size={56} strokeWidth={1.5} />
                            </div>
                            <h4 className="text-[16px] font-bold text-slate-700 mb-2">¿Estás seguro de iniciar la carga de datos del archivo?</h4>
                            <p className="text-[16px] font-bold text-slate-800 mb-4">{fileToLoad?.name}</p>
                            <p className="text-[13px] text-slate-600 leading-relaxed max-w-sm">
                                Recuerda que la carga de datos puede tomar un tiempo considerable, dependiendo de la cantidad de registros, así como también esta acción no se puede deshacer.
                            </p>
                            {confirmError && (
                                <p className="mt-4 w-full text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed">
                                    {confirmError}
                                </p>
                            )}
                        </div>
                        <div className="p-5 bg-white border-t border-slate-200 flex justify-center gap-4">
                            <button
                                onClick={cerrarModalConfirmacion}
                                disabled={isConfirming}
                                className="px-8 py-2.5 rounded-full border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors w-1/2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmCarga}
                                disabled={isConfirming}
                                className="px-8 py-2.5 rounded-full bg-[#004E7C] text-white font-medium hover:bg-[#003b5e] shadow-sm transition-colors w-1/2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isConfirming ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Procesando...
                                    </>
                                ) : (
                                    'Iniciar carga de datos'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
