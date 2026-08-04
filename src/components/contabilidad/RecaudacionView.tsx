import { useEffect, useMemo, useState } from 'react';
import {
    Banknote,
    Building,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    Eye,
    FileText,
    Filter,
    Image as ImageIcon,
    Plus,
    Trash2,
    User,
    Wallet,
    X,
} from 'lucide-react';
import { UploadButton } from '../commons/UploadButton';
import { getNominaCostCenters, type NominaCostCenter } from '../../services/n8nApi';

type EstadoRecaudacion = 'Cargado' | 'Cargado Fuera de Tiempo';

type ComprobanteUploadKey =
    | 'planillas_pdf'
    | 'planillas_xlsx'
    | 'depositos_hora'
    | 'depositos_abonados'
    | 'datafast';

type UploadStatus = 'loading' | 'done';

type RecaudacionUploads = Partial<Record<ComprobanteUploadKey, UploadStatus>>;

type CategoriaComprobante = 'planillas' | 'depositos' | 'datafast';

interface Recaudacion {
    id: string;
    parqueadero: string;
    centroCosto: string;
    responsable: string;
    fecha: string;
    estado: EstadoRecaudacion;
    observaciones: string;
    observacionesDeposito: string;
    montoEfectivo: number;
    montoTarjeta: number;
    montoTransferencia: number;
    montoCredito: number;
    monto: number;
    uploads: RecaudacionUploads;
}

interface NuevaRecaudacionForm {
    centroCostoId: string;
    parqueadero: string;
    responsable: string;
    fecha: string;
    observaciones: string;
    observacionesDeposito: string;
}

const MOCK_RECAUDACIONES: Recaudacion[] = [
    {
        id: 'REC-829054',
        parqueadero: '18 de Septiembre',
        centroCosto: '0228290',
        responsable: 'Juan Perez',
        fecha: '2026-06-21',
        estado: 'Cargado',
        observaciones: 'teste 1q',
        observacionesDeposito: 'Diferencia 5 dolares',
        montoEfectivo: 162.70,
        montoTarjeta: 95.11,
        montoTransferencia: 43.24,
        montoCredito: 60.24,
        monto: 361.29,
        uploads: { planillas_pdf: 'done', planillas_xlsx: 'done', depositos_hora: 'done' },
    },
    {
        id: 'REC-829061',
        parqueadero: 'Centro Comercial Paseo San Francisco',
        centroCosto: '0221001',
        responsable: 'Freddy Chica',
        fecha: '2026-06-18',
        estado: 'Cargado',
        observaciones: 'Adjunto comprobantes',
        observacionesDeposito: '',
        montoEfectivo: 100.00,
        montoTarjeta: 50.00,
        montoTransferencia: 55.69,
        montoCredito: 0,
        monto: 205.69,
        uploads: { planillas_pdf: 'done', depositos_hora: 'done', datafast: 'done' },
    },
    {
        id: 'REC-829055',
        parqueadero: 'Astecnia',
        centroCosto: '0223594',
        responsable: 'otro test',
        fecha: '2026-06-22',
        estado: 'Cargado Fuera de Tiempo',
        observaciones: 'Entrega hoy',
        observacionesDeposito: '',
        montoEfectivo: 100.00,
        montoTarjeta: 36.18,
        montoTransferencia: 50.00,
        montoCredito: 50.00,
        monto: 236.18,
        uploads: { planillas_pdf: 'done', planillas_xlsx: 'done', depositos_hora: 'done', depositos_abonados: 'done', datafast: 'done' },
    },
];

const DOC_NAMES: Record<ComprobanteUploadKey, string> = {
    planillas_pdf: 'Planillas (PDF)',
    planillas_xlsx: 'Planillas (Excel)',
    depositos_hora: 'Depósitos (Hora Fracción)',
    depositos_abonados: 'Depósitos (Abonados)',
    datafast: 'Datafast y Otros',
};

const formatMonto = (val: number) => val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getEstadoBadgeClass = (estado: EstadoRecaudacion) => {
    return estado === 'Cargado Fuera de Tiempo'
        ? 'bg-amber-50 text-amber-600 border-amber-200'
        : 'bg-emerald-50 text-emerald-600 border-emerald-200';
};

interface CategoryButtonProps {
    id: CategoriaComprobante;
    label: string;
    isDone: boolean;
    active: boolean;
    onClick: (id: CategoriaComprobante) => void;
}

const CategoryButton = ({ id, label, isDone, active, onClick }: CategoryButtonProps) => (
    <button
        type="button"
        onClick={() => onClick(id)}
        className={`w-full h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all
            ${active ? 'border-[#001F3F] bg-blue-50 text-[#001F3F]' :
                isDone ? 'border-emerald-500 bg-emerald-50 text-emerald-600' :
                    'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
    >
        {isDone ? <CheckCircle2 size={24} className="text-emerald-500" /> : <ImageIcon size={24} className={active ? 'text-[#001F3F]' : 'text-slate-400'} />}
        <span className="text-[12px] font-bold">{isDone ? 'Cargado' : label}</span>
        {!isDone && <span className="text-[10px] text-slate-400">Clic para cargar</span>}
    </button>
);

interface NuevaRecaudacionModalProps {
    centrosCosto: NominaCostCenter[];
    loadingCentros: boolean;
    onClose: () => void;
    onSave: (recaudacion: Recaudacion) => void;
}

const NuevaRecaudacionModal = ({ centrosCosto, loadingCentros, onClose, onSave }: NuevaRecaudacionModalProps) => {
    const [form, setForm] = useState<NuevaRecaudacionForm>({
        centroCostoId: '',
        parqueadero: '',
        responsable: '',
        fecha: '',
        observaciones: '',
        observacionesDeposito: '',
    });
    const [uploads, setUploads] = useState<RecaudacionUploads>({});
    const [activeCategoria, setActiveCategoria] = useState<CategoriaComprobante | null>(null);
    const [concuerdaMonto, setConcuerdaMonto] = useState<'si' | 'no'>('si');

    const todayObj = new Date();
    const maxDateStr = getLocalDateStr(todayObj);
    const minDateObj = new Date(todayObj);
    minDateObj.setDate(minDateObj.getDate() - 3);
    const minDateStr = getLocalDateStr(minDateObj);

    const handleUpload = (key: string) => {
        setUploads((prev) => ({ ...prev, [key]: 'loading' }));
        setTimeout(() => {
            setUploads((prev) => ({ ...prev, [key]: 'done' }));
        }, 800);
    };

    const handleParqueaderoChange = (centroCostoId: string) => {
        const centro = centrosCosto.find((c) => c.IDCENTROCOSTO === centroCostoId);
        setForm((prev) => ({ ...prev, centroCostoId, parqueadero: centro?.CENTROCOSTO || '' }));
    };

    const isPlanillasDone = uploads.planillas_pdf === 'done' || uploads.planillas_xlsx === 'done';
    const isDepositosDone = uploads.depositos_hora === 'done' || uploads.depositos_abonados === 'done';
    const isDatafastDone = uploads.datafast === 'done';

    const canSave = Boolean(form.centroCostoId && form.responsable && form.fecha);

    const handleSave = () => {
        if (!canSave) return;

        const estado: EstadoRecaudacion = form.fecha === maxDateStr ? 'Cargado Fuera de Tiempo' : 'Cargado';
        const observacionesDeposito = concuerdaMonto === 'no' ? form.observacionesDeposito : '';

        onSave({
            id: `REC-${Date.now()}`,
            parqueadero: form.parqueadero,
            centroCosto: form.centroCostoId,
            responsable: form.responsable,
            fecha: form.fecha,
            estado,
            observaciones: form.observaciones,
            observacionesDeposito,
            montoEfectivo: 0,
            montoTarjeta: 0,
            montoTransferencia: 0,
            montoCredito: 0,
            monto: 0,
            uploads,
        });
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#001F3F]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-full max-w-[600px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-[#001F3F] px-8 py-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Wallet size={20} /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Agregar recaudación</h3>
                            <p className="text-xs text-blue-200">Registro de carga por parqueadero</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    <p className="text-sm text-slate-500 bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                        Por favor, ingresa los detalles de la recaudación. Las cargas están limitadas a un rango de <span className="font-bold text-blue-700">4 días hacia atrás</span> desde hoy.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">* Parqueadero</label>
                            <div className="relative">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    className="w-full appearance-none pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all disabled:opacity-50"
                                    value={form.centroCostoId}
                                    onChange={(e) => handleParqueaderoChange(e.target.value)}
                                    disabled={loadingCentros}
                                >
                                    <option value="">{loadingCentros ? 'Cargando...' : 'Selecciona el parqueadero'}</option>
                                    {centrosCosto.map((cc) => (
                                        <option key={cc.IDCENTROCOSTO} value={cc.IDCENTROCOSTO}>{cc.CENTROCOSTO}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">* Fecha</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="date"
                                    min={minDateStr}
                                    max={maxDateStr}
                                    value={form.fecha}
                                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 ml-1">Solo puedes registrar recaudaciones de los últimos 4 días.</p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">* Responsable</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Ejm: Carlos Alvarado"
                                    value={form.responsable}
                                    onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium focus:border-[#001F3F] transition-all placeholder:text-slate-400 placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Observaciones</label>
                            <div className="relative">
                                <FileText className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                <textarea
                                    placeholder="Ejm: Depósito realizado con éxito..."
                                    value={form.observaciones}
                                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                                    rows={2}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium focus:border-[#001F3F] transition-all placeholder:text-slate-400 placeholder:font-normal resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Comprobante</label>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-2 block text-center">Planillas</label>
                                <CategoryButton id="planillas" label="Clic para cargar" isDone={isPlanillasDone} active={activeCategoria === 'planillas'} onClick={setActiveCategoria} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-2 block text-center">Depósitos</label>
                                <CategoryButton id="depositos" label="Clic para cargar" isDone={isDepositosDone} active={activeCategoria === 'depositos'} onClick={setActiveCategoria} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-2 block text-center">Datafast y Otros</label>
                                <CategoryButton id="datafast" label="Clic para cargar" isDone={isDatafastDone} active={activeCategoria === 'datafast'} onClick={setActiveCategoria} />
                            </div>
                        </div>
                        <p className="text-center text-[11px] text-slate-400 mt-4">Seleccione la categoría arriba para desplegar las opciones de carga</p>

                        {activeCategoria === 'planillas' && (
                            <div className="mt-5 p-5 bg-blue-50/50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 text-center flex items-center justify-center gap-2">
                                    <FileText size={16} /> Documentos de Planillas
                                </h4>
                                <div className="grid grid-cols-2 gap-6 max-w-[400px] mx-auto">
                                    <UploadButton label="PDF Escaneado" icon={<FileText size={20} />} uploadKey="planillas_pdf" uploads={uploads} onUpload={handleUpload} />
                                    <UploadButton label="Excel (XLSX)" icon={<FileText size={20} />} uploadKey="planillas_xlsx" uploads={uploads} onUpload={handleUpload} />
                                </div>
                            </div>
                        )}

                        {activeCategoria === 'depositos' && (
                            <div className="mt-5 p-5 bg-blue-50/50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 text-center flex items-center justify-center gap-2">
                                    <Banknote size={16} /> Documentos de Depósitos
                                </h4>
                                <div className="grid grid-cols-2 gap-6 max-w-[500px] mx-auto mb-5">
                                    <div className="flex flex-col gap-3">
                                        <UploadButton label="Hora Fracción" icon={<ImageIcon size={20} />} uploadKey="depositos_hora" uploads={uploads} onUpload={handleUpload} />
                                        <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm text-center">
                                            <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2 block">¿Concuerda Monto?</label>
                                            <div className="flex justify-center gap-3">
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input type="radio" name="concuerda" value="si" checked={concuerdaMonto === 'si'} onChange={() => setConcuerdaMonto('si')} />
                                                    Sí
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input type="radio" name="concuerda" value="no" checked={concuerdaMonto === 'no'} onChange={() => setConcuerdaMonto('no')} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <UploadButton label="Abonados" icon={<ImageIcon size={20} />} uploadKey="depositos_abonados" uploads={uploads} onUpload={handleUpload} />
                                    </div>
                                </div>

                                {concuerdaMonto === 'no' && (
                                    <div className="max-w-[500px] mx-auto animate-in fade-in zoom-in-95 duration-200">
                                        <label className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-2 block">Observación de Depósito (Hora Fracción)</label>
                                        <textarea
                                            placeholder="Ejm: Diferencia de $5 justificada por..."
                                            value={form.observacionesDeposito}
                                            onChange={(e) => setForm({ ...form, observacionesDeposito: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:border-[#001F3F] transition-all text-slate-700 shadow-sm resize-none bg-white placeholder:text-slate-400"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeCategoria === 'datafast' && (
                            <div className="mt-5 p-5 bg-blue-50/50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 text-center flex items-center justify-center gap-2">
                                    <CreditCard size={16} /> Comprobantes Datafast
                                </h4>
                                <div className="grid grid-cols-1 gap-6 max-w-[200px] mx-auto">
                                    <UploadButton label="Datafast y Otros" icon={<ImageIcon size={20} />} uploadKey="datafast" uploads={uploads} onUpload={handleUpload} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-sm">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="px-8 py-3 rounded-xl bg-[#001F3F] text-white font-bold hover:bg-blue-900 shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        Guardar recaudación
                    </button>
                </div>
            </div>
        </div>
    );
};

interface DetalleRecaudacionModalProps {
    recaudacion: Recaudacion;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const DetalleRecaudacionModal = ({ recaudacion, onClose, onDelete }: DetalleRecaudacionModalProps) => {
    const uploadedKeys = (Object.keys(recaudacion.uploads) as ComprobanteUploadKey[]).filter((k) => recaudacion.uploads[k] === 'done');

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#001F3F]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-full max-w-[750px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-[#001F3F] px-8 py-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Wallet size={20} /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Detalle de Recaudación</h3>
                            <p className="text-xs text-blue-200">Información registrada el {recaudacion.fecha}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"><X size={20} /></button>
                </div>

                <div className="flex flex-col md:flex-row p-8 overflow-y-auto custom-scrollbar gap-8">
                    <div className="w-full md:w-1/3 flex flex-col gap-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Documentos de respaldo</h4>
                        <div className="space-y-4">
                            {uploadedKeys.length > 0 ? uploadedKeys.map((k) => (
                                <div key={k} className="flex flex-col gap-1.5">
                                    <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 shadow-sm">
                                        <FileText size={24} className="text-blue-500 mb-2" />
                                        <p className="text-[11px] font-bold text-[#001F3F] leading-tight">{DOC_NAMES[k]}</p>
                                        <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1"><Check size={12} /> Cargado</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center h-32 bg-slate-50">
                                    <p className="text-[11px] text-slate-500">Sin documentos de respaldo</p>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 text-center mt-2">Documentos subidos por el usuario</p>
                    </div>

                    <div className="w-full md:w-2/3 space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h4 className="font-bold text-slate-800 text-base">Registro de recaudación</h4>
                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getEstadoBadgeClass(recaudacion.estado)}`}>
                                {recaudacion.estado}
                            </span>
                        </div>

                        <div className="space-y-1.5 text-sm">
                            <div className="flex bg-slate-50 p-2 rounded">
                                <span className="font-bold text-[#001F3F] w-1/3">Usuario:</span>
                                <span className="text-slate-600">{recaudacion.responsable}</span>
                            </div>
                            <div className="flex p-2 rounded">
                                <span className="font-bold text-[#001F3F] w-1/3">Parqueadero:</span>
                                <span className="text-slate-600">{recaudacion.parqueadero}</span>
                            </div>
                            <div className="flex bg-slate-50 p-2 rounded">
                                <span className="font-bold text-[#001F3F] w-1/3">Centro de Costo:</span>
                                <span className="text-slate-600 font-mono">{recaudacion.centroCosto || 'S/N'}</span>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-bold text-[#001F3F] uppercase tracking-wider mb-2">Información general</h5>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex bg-slate-50 p-2 rounded">
                                    <span className="font-bold text-[#001F3F] w-1/3">Fecha de registro:</span>
                                    <span className="text-slate-600">{recaudacion.fecha}</span>
                                </div>
                                <div className="flex p-2 rounded">
                                    <span className="font-bold text-[#001F3F] w-1/3">Monto Efectivo:</span>
                                    <span className="text-slate-600">${formatMonto(recaudacion.montoEfectivo)}</span>
                                </div>
                                <div className="flex bg-slate-50 p-2 rounded">
                                    <span className="font-bold text-[#001F3F] w-1/3">Monto Tarjeta:</span>
                                    <span className="text-slate-600">${formatMonto(recaudacion.montoTarjeta)}</span>
                                </div>
                                <div className="flex p-2 rounded">
                                    <span className="font-bold text-[#001F3F] w-1/3">Monto Transferencia:</span>
                                    <span className="text-slate-600">${formatMonto(recaudacion.montoTransferencia)}</span>
                                </div>
                                <div className="flex bg-slate-50 p-2 rounded">
                                    <span className="font-bold text-[#001F3F] w-1/3">Monto Crédito:</span>
                                    <span className="text-slate-600">${formatMonto(recaudacion.montoCredito)}</span>
                                </div>
                                <div className="flex bg-blue-50/60 p-2 rounded border border-blue-100 mt-1">
                                    <span className="font-bold text-blue-800 w-1/3">Total:</span>
                                    <span className="text-blue-800 font-black text-[15px]">${formatMonto(recaudacion.monto)}</span>
                                </div>
                                <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded mt-2">
                                    <span className="font-bold text-[#001F3F]">Observaciones:</span>
                                    <span className="text-slate-600 leading-relaxed">{recaudacion.observaciones || 'Sin observaciones adicionales'}</span>
                                </div>
                                {recaudacion.observacionesDeposito && (
                                    <div className="flex flex-col gap-1 bg-blue-50/60 p-2 rounded border border-blue-100 mt-2">
                                        <span className="font-bold text-blue-700 flex items-center gap-1.5"><Banknote size={12} /> Observación de Depósito:</span>
                                        <span className="text-slate-600 leading-relaxed">{recaudacion.observacionesDeposito}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                    <button onClick={() => onDelete(recaudacion.id)} className="p-2.5 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function RecaudacionView() {
    const [recaudaciones, setRecaudaciones] = useState<Recaudacion[]>(MOCK_RECAUDACIONES);
    const [showModal, setShowModal] = useState(false);
    const [detalleRecaudacion, setDetalleRecaudacion] = useState<Recaudacion | null>(null);

    const [centrosCosto, setCentrosCosto] = useState<NominaCostCenter[]>([]);
    const [loadingCentros, setLoadingCentros] = useState(false);

    const [filtroFecha, setFiltroFecha] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<'Todos' | EstadoRecaudacion>('Todos');
    const [filtroCentroCostoId, setFiltroCentroCostoId] = useState('');

    useEffect(() => {
        setLoadingCentros(true);
        getNominaCostCenters()
            .then((data) => setCentrosCosto(data))
            .catch((error) => {
                console.error('[Recaudacion] Error al cargar parqueaderos desde n8n:', error instanceof Error ? error.message : error);
            })
            .finally(() => setLoadingCentros(false));
    }, []);

    const filteredRecaudaciones = useMemo(() => {
        return recaudaciones.filter((rec) => {
            const matchFecha = !filtroFecha || rec.fecha === filtroFecha;
            const matchEstado = filtroEstado === 'Todos' || rec.estado === filtroEstado;
            const matchParqueadero = !filtroCentroCostoId || rec.centroCosto === filtroCentroCostoId;
            return matchFecha && matchEstado && matchParqueadero;
        });
    }, [recaudaciones, filtroFecha, filtroEstado, filtroCentroCostoId]);

    const totalMonto = useMemo(
        () => filteredRecaudaciones.reduce((sum, rec) => sum + rec.monto, 0),
        [filteredRecaudaciones],
    );

    const summaryDateText = filtroFecha || 'Todas las fechas';

    const handleGuardarRecaudacion = (nueva: Recaudacion) => {
        setRecaudaciones((prev) => [nueva, ...prev]);
        setShowModal(false);
    };

    const handleDeleteRecaudacion = (id: string) => {
        setRecaudaciones((prev) => prev.filter((rec) => rec.id !== id));
        setDetalleRecaudacion(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {showModal && (
                <NuevaRecaudacionModal
                    centrosCosto={centrosCosto}
                    loadingCentros={loadingCentros}
                    onClose={() => setShowModal(false)}
                    onSave={handleGuardarRecaudacion}
                />
            )}

            {detalleRecaudacion && (
                <DetalleRecaudacionModal
                    recaudacion={detalleRecaudacion}
                    onClose={() => setDetalleRecaudacion(null)}
                    onDelete={handleDeleteRecaudacion}
                />
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Recaudación</h2>
                        <p className="text-sm text-slate-500">Desde esta sección podrás gestionar las cargas de recaudación por parqueadero</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001F3F] text-white font-bold hover:bg-blue-900 shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-sm shrink-0"
                >
                    <Plus size={18} /> Nueva recaudación
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                    <div className="w-full sm:w-48">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fecha</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="date"
                                value={filtroFecha}
                                onChange={(e) => setFiltroFecha(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all"
                            />
                        </div>
                    </div>
                    <div className="w-full sm:w-48">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Estado</label>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                value={filtroEstado}
                                onChange={(e) => setFiltroEstado(e.target.value as 'Todos' | EstadoRecaudacion)}
                                className="w-full appearance-none pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all"
                            >
                                <option value="Todos">Todos</option>
                                <option value="Cargado">Cargado</option>
                                <option value="Cargado Fuera de Tiempo">Cargado Fuera de Tiempo</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <div className="w-full sm:w-64">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Parqueadero</label>
                        <div className="relative">
                            <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                value={filtroCentroCostoId}
                                onChange={(e) => setFiltroCentroCostoId(e.target.value)}
                                disabled={loadingCentros}
                                className="w-full appearance-none pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer font-medium focus:border-[#001F3F] transition-all disabled:opacity-50"
                            >
                                <option value="">{loadingCentros ? 'Cargando...' : 'Todos'}</option>
                                {centrosCosto.map((cc) => (
                                    <option key={cc.IDCENTROCOSTO} value={cc.IDCENTROCOSTO}>{cc.CENTROCOSTO}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 mb-1">Total | {summaryDateText}</p>
                    <p className="text-2xl font-black text-slate-800 leading-none mb-2">$ {formatMonto(totalMonto)}</p>
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-bold">
                        {filteredRecaudaciones.length} recaudaciones
                    </span>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Fecha</th>
                                <th className="px-6 py-4 whitespace-nowrap">Responsable</th>
                                <th className="px-6 py-4 whitespace-nowrap">Parqueadero</th>
                                <th className="px-6 py-4 whitespace-nowrap">Centro de Costo</th>
                                <th className="px-6 py-4 whitespace-nowrap">Monto</th>
                                <th className="px-6 py-4 whitespace-nowrap">Estado</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRecaudaciones.length > 0 ? (
                                filteredRecaudaciones.map((rec) => (
                                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-600">{rec.fecha}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{rec.responsable}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{rec.parqueadero}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{rec.centroCosto}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800">${formatMonto(rec.monto)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${getEstadoBadgeClass(rec.estado)}`}>
                                                {rec.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setDetalleRecaudacion(rec)}
                                                className="p-2 text-slate-400 hover:text-[#001F3F] hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Filter size={32} className="text-slate-300" />
                                            <p className="text-sm font-medium">No se encontraron registros con estos filtros.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredRecaudaciones.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                        <span className="text-xs font-medium text-slate-400">Mostrando {filteredRecaudaciones.length} resultados</span>
                    </div>
                )}
            </div>
        </div>
    );
}
