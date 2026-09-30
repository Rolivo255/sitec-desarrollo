import { useEffect, useState } from 'react';
import { AlertCircle, Briefcase, Eye, Loader2, Plus, X } from 'lucide-react';

interface Inversion {
    id: number;
    nombre: string;
    moneda: string;
    conversion: string | number | null;
    desaduanizacion: string | number | null;
    utilidad: string | number | null;
    estado: string;
}

const API_BASE = '/api/proyectos/inversiones';

const vacioOValor = (valor: string | number | null | undefined): string => {
    if (valor === null || valor === undefined || valor === '') return 'N/A';
    return String(valor);
};

export default function InversionesView() {
    const [inversiones, setInversiones] = useState<Inversion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState<Inversion | null>(null);

    const [nombre, setNombre] = useState('');
    const [moneda, setMoneda] = useState('EUR');
    const [conversion, setConversion] = useState('');
    const [desaduanizacion, setDesaduanizacion] = useState('');
    const [utilidad, setUtilidad] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const cargarInversiones = async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error(`Error ${response.status} al cargar inversiones`);
            const payload = await response.json() as { inversiones: Inversion[] };
            setInversiones(payload.inversiones ?? []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las inversiones.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void cargarInversiones();
    }, []);

    const abrirModalCrear = () => {
        setNombre('');
        setMoneda('EUR');
        setConversion('');
        setDesaduanizacion('');
        setUtilidad('');
        setSaveError('');
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre.trim(),
                    moneda,
                    conversion: conversion || undefined,
                    desaduanizacion: desaduanizacion || undefined,
                    utilidad: utilidad || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { inversion?: Inversion; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setInversiones(prev => [payload!.inversion!, ...prev]);
            setShowCreateModal(false);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la inversión.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-[#001F3F] border border-slate-200 shadow-sm"><Briefcase size={24} strokeWidth={2.5} /></div>
                    <div>
                        <h2 className="text-[22px] font-bold text-[#001F3F] leading-tight">Inversiones de Proyectos</h2>
                        <p className="text-[13px] text-slate-500 mt-1">Carga y gestiona las inversiones de tus proyectos con sus variables financieras.</p>
                    </div>
                </div>
                <button onClick={abrirModalCrear} className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-[13px] shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Plus size={18} /> Crear nueva inversión
                </button>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 bg-[#F8FAFC]">
                    <h3 className="text-[15px] font-bold text-slate-800">Histórico de Carga de Inversiones</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">NOMBRE DE LA INVERSIÓN</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ESTADO</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider text-center">DETALLE</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr><td colSpan={3} className="py-16 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Cargando...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={3} className="py-16 text-center text-red-500 text-[13px]">{loadError}</td></tr>
                            ) : inversiones.length > 0 ? (
                                inversiones.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-[14px] font-bold text-[#334155]">{inv.nombre}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-200">
                                                {inv.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setShowDetailModal(inv)}
                                                className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors mx-auto block"
                                                title="Ver detalle"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-16 text-center">
                                        <Briefcase size={32} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-[14px] text-slate-500 font-medium">Aún no has creado ninguna inversión.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Crear Inversión */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-[#F8FAFC]">
                            <h3 className="text-[18px] font-bold text-[#1E293B]">Crear nueva inversión</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre del proyecto / inversión</label>
                                <input type="text" placeholder="Ej. Renovación de equipos" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Moneda</label>
                                    <div className="relative">
                                        <select value={moneda} onChange={e => setMoneda(e.target.value)} className="w-full appearance-none px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 cursor-pointer bg-white text-slate-700 font-medium">
                                            <option value="EUR">Euros (EUR)</option>
                                            <option value="USD">Dólar (USD)</option>
                                            <option value="JPY">Yenes (JPY)</option>
                                            <option value="GBP">Libras (GBP)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Conversión a Dólar</label>
                                    <input type="number" step="0.01" placeholder="Ej: 1.2" value={conversion} onChange={e => setConversion(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Desaduanización</label>
                                    <input type="number" step="0.01" placeholder="Ej: 150.00" value={desaduanizacion} onChange={e => setDesaduanizacion(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Utilidad (%)</label>
                                    <input type="number" step="0.1" placeholder="Ej: 20" value={utilidad} onChange={e => setUtilidad(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                            </div>
                            {saveError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {saveError}
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-[#F8FAFC] flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 font-medium text-slate-600 hover:text-slate-800 transition-colors text-[13px]">Cerrar</button>
                            <button onClick={() => void handleSave()} disabled={!nombre.trim() || isSaving} className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold shadow-sm active:scale-95 transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null} Guardar inversión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Detalle Inversión */}
            {showDetailModal && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDetailModal(null)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Briefcase size={20} /></div>
                                <h3 className="text-[18px] font-bold text-[#1E293B]">Detalle de Inversión</h3>
                            </div>
                            <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre del Proyecto</p>
                                <p className="text-[16px] font-bold text-[#1E293B]">{showDetailModal.nombre}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Moneda Origen</p>
                                    <p className="text-[14px] font-bold text-slate-700">{showDetailModal.moneda}</p>
                                </div>
                                <div className="p-3 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conversión ($)</p>
                                    <p className="text-[14px] font-bold text-slate-700">{vacioOValor(showDetailModal.conversion)}</p>
                                </div>
                                <div className="p-3 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Desaduanización</p>
                                    <p className="text-[14px] font-bold text-slate-700">{showDetailModal.desaduanizacion ? `$${showDetailModal.desaduanizacion}` : 'N/A'}</p>
                                </div>
                                <div className="p-3 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
                                    <p className="text-[14px] font-bold text-emerald-600">{showDetailModal.utilidad ? `${showDetailModal.utilidad}%` : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex justify-end shrink-0">
                            <button onClick={() => setShowDetailModal(null)} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold shadow-sm transition-all text-[13px]">Cerrar detalle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
