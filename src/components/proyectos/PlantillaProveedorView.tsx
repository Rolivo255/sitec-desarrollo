import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Cpu,
    DollarSign,
    Eye,
    Key,
    Landmark,
    Layers,
    Loader2,
    Pencil,
    Plus,
    Save,
    Settings2,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { getProveedoresPlantilla } from '../../services/n8nApi';

interface Categoria {
    id: number;
    nombre: string;
    proveedor: string;
}

interface Equipo {
    id: number;
    codigo: string;
    nombre_equipo: string;
    categoria_id: number;
    categoria_nombre: string;
    proveedor: string;
    componentes_count: number;
    costo_total: string | number;
    moneda: string | null;
    utilidad_interna: string | number | null;
}

interface Componente {
    id: number;
    equipo_id: number;
    nombre: string;
    costo: string | number | null;
    moneda: string | null;
}

const API_BASE = '/api/proyectos/plantilla-proveedor';

const numeroOCero = (valor: string | number | null | undefined): number => {
    const num = Number(valor ?? 0);
    return Number.isFinite(num) ? num : 0;
};

export default function PlantillaProveedorView() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [filtroProveedor, setFiltroProveedor] = useState('');

    // Drawer: Gestionar Categorías
    const [isCatDrawerOpen, setIsCatDrawerOpen] = useState(false);
    const [isAddingCategoria, setIsAddingCategoria] = useState(false);
    const [editingCatId, setEditingCatId] = useState<number | null>(null);
    const [newCategoriaNombre, setNewCategoriaNombre] = useState('');
    const [newCategoriaProveedor, setNewCategoriaProveedor] = useState('');
    const [catError, setCatError] = useState('');
    const [isSavingCategoria, setIsSavingCategoria] = useState(false);
    const [proveedoresApi, setProveedoresApi] = useState<string[]>([]);
    const [isLoadingProveedoresApi, setIsLoadingProveedoresApi] = useState(false);
    const [proveedoresApiError, setProveedoresApiError] = useState('');

    // Drawer: Crear equipo
    const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
    const [formCategoriaId, setFormCategoriaId] = useState('');
    const [formNombreEquipo, setFormNombreEquipo] = useState('');
    const [isSavingEquipo, setIsSavingEquipo] = useState(false);
    const [createError, setCreateError] = useState('');

    // Drawer: Ver detalle
    const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
    const [detalleEquipo, setDetalleEquipo] = useState<Equipo | null>(null);
    const [detalleComponentes, setDetalleComponentes] = useState<Componente[]>([]);
    const [isLoadingDetalle, setIsLoadingDetalle] = useState(false);
    const [utilidadInternaActiva, setUtilidadInternaActiva] = useState(false);
    const [utilidadInternaValor, setUtilidadInternaValor] = useState('');
    const [isSavingUtilidad, setIsSavingUtilidad] = useState(false);
    const [utilidadError, setUtilidadError] = useState('');
    const [showDeleteEquipoConfirm, setShowDeleteEquipoConfirm] = useState(false);
    const [isDeletingEquipo, setIsDeletingEquipo] = useState(false);
    const [deleteEquipoError, setDeleteEquipoError] = useState('');

    // Modal: Añadir componente
    const [isAddCompModalOpen, setIsAddCompModalOpen] = useState(false);
    const [compNombre, setCompNombre] = useState('');
    const [compShowCosto, setCompShowCosto] = useState(false);
    const [compCosto, setCompCosto] = useState('');
    const [compMoneda, setCompMoneda] = useState('USD');
    const [isSavingComponente, setIsSavingComponente] = useState(false);
    const [compError, setCompError] = useState('');

    const cargarDatos = async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const [resCat, resEq] = await Promise.all([
                authenticatedFetch(`${API_BASE}/categorias`),
                authenticatedFetch(`${API_BASE}/equipos`),
            ]);
            if (!resCat.ok) throw new Error(`Error ${resCat.status} al cargar categorías`);
            if (!resEq.ok) throw new Error(`Error ${resEq.status} al cargar equipos`);
            const catPayload = await resCat.json() as { categorias: Categoria[] };
            const eqPayload = await resEq.json() as { equipos: Equipo[] };
            setCategorias(catPayload.categorias ?? []);
            setEquipos(eqPayload.equipos ?? []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los datos.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void cargarDatos();
    }, []);

    const proveedoresDisponibles = useMemo(
        () => Array.from(new Set(categorias.map(c => c.proveedor))).sort(),
        [categorias]
    );

    const equiposFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return equipos.filter(eq => {
            const coincideTexto = !texto
                || eq.nombre_equipo.toLowerCase().includes(texto)
                || eq.codigo.toLowerCase().includes(texto);
            const coincideProveedor = !filtroProveedor || eq.proveedor === filtroProveedor;
            return coincideTexto && coincideProveedor;
        });
    }, [equipos, busqueda, filtroProveedor]);

    const abrirDrawerCategorias = () => {
        setIsAddingCategoria(false);
        setEditingCatId(null);
        setNewCategoriaNombre('');
        setNewCategoriaProveedor('');
        setCatError('');
        setIsCatDrawerOpen(true);

        if (proveedoresApi.length === 0) {
            setIsLoadingProveedoresApi(true);
            setProveedoresApiError('');
            getProveedoresPlantilla()
                .then(setProveedoresApi)
                .catch((error: unknown) => {
                    setProveedoresApiError(error instanceof Error ? error.message : 'No se pudo cargar la lista de proveedores.');
                })
                .finally(() => setIsLoadingProveedoresApi(false));
        }
    };

    const handleEditCategoria = (cat: Categoria) => {
        setNewCategoriaNombre(cat.nombre);
        setNewCategoriaProveedor(cat.proveedor);
        setEditingCatId(cat.id);
        setIsAddingCategoria(true);
        setCatError('');
    };

    const handleSaveCategoria = async () => {
        if (!newCategoriaNombre.trim() || !newCategoriaProveedor.trim()) return;
        setIsSavingCategoria(true);
        setCatError('');
        try {
            const url = editingCatId ? `${API_BASE}/categorias/${editingCatId}` : `${API_BASE}/categorias`;
            const response = await authenticatedFetch(url, {
                method: editingCatId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newCategoriaNombre.trim(), proveedor: newCategoriaProveedor.trim() }),
            });
            const payload = await response.json().catch(() => null) as { categoria?: Categoria; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);

            if (editingCatId) {
                setCategorias(prev => prev.map(c => c.id === editingCatId ? payload!.categoria! : c));
            } else {
                setCategorias(prev => [...prev, payload!.categoria!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            }
            setNewCategoriaNombre('');
            setNewCategoriaProveedor('');
            setIsAddingCategoria(false);
            setEditingCatId(null);
        } catch (error) {
            setCatError(error instanceof Error ? error.message : 'No se pudo guardar la categoría.');
        } finally {
            setIsSavingCategoria(false);
        }
    };

    const handleDeleteCategoria = async (id: number) => {
        setCatError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/categorias/${id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setCategorias(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            setCatError(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.');
        }
    };

    const codigoPreview = useMemo(() => {
        const prefijo = (texto: string) => texto.trim().substring(0, 3).toUpperCase() || '---';
        const cat = categorias.find(c => c.id.toString() === formCategoriaId);
        if (!cat || !formNombreEquipo.trim()) return '---- -- ---';
        return `${prefijo(cat.proveedor)}-${prefijo(cat.nombre)}-${prefijo(formNombreEquipo)}`;
    }, [categorias, formCategoriaId, formNombreEquipo]);

    const abrirDrawerCrearEquipo = () => {
        setFormCategoriaId('');
        setFormNombreEquipo('');
        setCreateError('');
        setIsCreateDrawerOpen(true);
    };

    const handleSaveEquipo = async () => {
        if (!formCategoriaId || !formNombreEquipo.trim()) return;
        setIsSavingEquipo(true);
        setCreateError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/equipos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoriaId: Number(formCategoriaId), nombreEquipo: formNombreEquipo.trim() }),
            });
            const payload = await response.json().catch(() => null) as { equipo?: Equipo; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setEquipos(prev => [payload!.equipo!, ...prev]);
            setIsCreateDrawerOpen(false);
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'No se pudo crear el equipo.');
        } finally {
            setIsSavingEquipo(false);
        }
    };

    const handleOpenDetail = async (equipo: Equipo) => {
        setDetalleEquipo(equipo);
        setDetalleComponentes([]);
        const utilidadExistente = numeroOCero(equipo.utilidad_interna);
        setUtilidadInternaActiva(utilidadExistente > 0);
        setUtilidadInternaValor(utilidadExistente > 0 ? String(utilidadExistente) : '');
        setUtilidadError('');
        setIsDetailDrawerOpen(true);
        setIsLoadingDetalle(true);
        try {
            const response = await authenticatedFetch(`${API_BASE}/equipos/${equipo.id}`);
            const payload = await response.json().catch(() => null) as { equipo?: Equipo; componentes?: Componente[]; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setDetalleComponentes(payload?.componentes ?? []);
        } catch {
            // Se deja el detalle basico ya cargado desde la tabla si falla el detalle completo.
        } finally {
            setIsLoadingDetalle(false);
        }
    };

    const guardarUtilidadInterna = async (valor: number) => {
        if (!detalleEquipo) return;
        setIsSavingUtilidad(true);
        setUtilidadError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/equipos/${detalleEquipo.id}/utilidad-interna`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ utilidadInterna: valor }),
            });
            const payload = await response.json().catch(() => null) as { equipo?: { id: number; utilidad_interna: number | string }; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            const nuevoValor = payload!.equipo!.utilidad_interna;
            const equipoActualizado: Equipo = { ...detalleEquipo, utilidad_interna: nuevoValor };
            setDetalleEquipo(equipoActualizado);
            setEquipos(prev => prev.map(eq => eq.id === equipoActualizado.id ? equipoActualizado : eq));
        } catch (error) {
            setUtilidadError(error instanceof Error ? error.message : 'No se pudo guardar la utilidad interna.');
        } finally {
            setIsSavingUtilidad(false);
        }
    };

    const handleToggleUtilidadInterna = (activar: boolean) => {
        setUtilidadInternaActiva(activar);
        setUtilidadError('');
        if (!activar) {
            setUtilidadInternaValor('');
            void guardarUtilidadInterna(0);
        }
    };

    const handleBlurUtilidadInterna = () => {
        const valor = Number(utilidadInternaValor || 0);
        if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
            setUtilidadError('Ingrese un porcentaje válido entre 0 y 100.');
            return;
        }
        void guardarUtilidadInterna(valor);
    };

    const cerrarDetalle = () => {
        setIsDetailDrawerOpen(false);
        setDetalleEquipo(null);
        setDetalleComponentes([]);
        setUtilidadInternaActiva(false);
        setUtilidadInternaValor('');
        setUtilidadError('');
        setShowDeleteEquipoConfirm(false);
        setDeleteEquipoError('');
    };

    const handleDeleteEquipo = async () => {
        if (!detalleEquipo) return;
        setIsDeletingEquipo(true);
        setDeleteEquipoError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/equipos/${detalleEquipo.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);

            const equipoEliminadoId = detalleEquipo.id;
            setEquipos(prev => prev.filter(eq => eq.id !== equipoEliminadoId));
            setShowDeleteEquipoConfirm(false);
            cerrarDetalle();
        } catch (error) {
            setDeleteEquipoError(error instanceof Error ? error.message : 'No se pudo eliminar el equipo.');
        } finally {
            setIsDeletingEquipo(false);
        }
    };

    const abrirModalComponente = () => {
        setCompNombre('');
        setCompShowCosto(false);
        setCompCosto('');
        setCompMoneda('USD');
        setCompError('');
        setIsAddCompModalOpen(true);
    };

    const handleSaveComponente = async () => {
        if (!compNombre.trim() || !detalleEquipo) return;
        setIsSavingComponente(true);
        setCompError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/equipos/${detalleEquipo.id}/componentes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: compNombre.trim(),
                    costo: compShowCosto ? compCosto : undefined,
                    moneda: compShowCosto ? compMoneda : undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { componente?: Componente; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);

            const nuevoComponente = payload!.componente!;
            const nuevosComponentes = [...detalleComponentes, nuevoComponente];
            setDetalleComponentes(nuevosComponentes);

            const nuevoTotal = nuevosComponentes.reduce((sum, c) => sum + numeroOCero(c.costo), 0);
            const nuevaMoneda = nuevosComponentes.find(c => c.moneda)?.moneda ?? null;
            const equipoActualizado: Equipo = {
                ...detalleEquipo,
                componentes_count: nuevosComponentes.length,
                costo_total: nuevoTotal,
                moneda: nuevaMoneda,
            };
            setDetalleEquipo(equipoActualizado);
            setEquipos(prev => prev.map(eq => eq.id === equipoActualizado.id ? equipoActualizado : eq));
            setIsAddCompModalOpen(false);
        } catch (error) {
            setCompError(error instanceof Error ? error.message : 'No se pudo agregar el componente.');
        } finally {
            setIsSavingComponente(false);
        }
    };

    const handleDeleteComponente = async (id: number) => {
        if (!detalleEquipo) return;
        try {
            const response = await authenticatedFetch(`${API_BASE}/componentes/${id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);

            const nuevosComponentes = detalleComponentes.filter(c => c.id !== id);
            setDetalleComponentes(nuevosComponentes);
            const nuevoTotal = nuevosComponentes.reduce((sum, c) => sum + numeroOCero(c.costo), 0);
            const nuevaMoneda = nuevosComponentes.find(c => c.moneda)?.moneda ?? null;
            const equipoActualizado: Equipo = {
                ...detalleEquipo,
                componentes_count: nuevosComponentes.length,
                costo_total: nuevoTotal,
                moneda: nuevaMoneda,
            };
            setDetalleEquipo(equipoActualizado);
            setEquipos(prev => prev.map(eq => eq.id === equipoActualizado.id ? equipoActualizado : eq));
        } catch (error) {
            setCompError(error instanceof Error ? error.message : 'No se pudo eliminar el componente.');
        }
    };

    const totalCostoDetalle = detalleComponentes.reduce((sum, c) => sum + numeroOCero(c.costo), 0);
    const monedaDetalle = detalleComponentes.find(c => c.moneda)?.moneda ?? 'USD';

    return (
        <div className="space-y-6 pb-10 max-w-[1400px] mx-auto">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-start gap-4">
                    <div className="text-blue-500 mt-1"><ClipboardList size={28} strokeWidth={1.5} /></div>
                    <div>
                        <h2 className="text-[22px] font-medium text-slate-800 leading-tight">Plantilla de Proveedor</h2>
                        <p className="text-[13px] text-slate-500 mt-1">Gestiona los proveedores disponibles para los diferentes parqueaderos</p>
                    </div>
                </div>
                <button
                    onClick={abrirDrawerCategorias}
                    className="px-5 py-2.5 bg-white border border-blue-400 hover:bg-blue-50 text-blue-600 rounded-lg text-[13px] font-medium transition-all flex flex-col items-center justify-center min-w-[120px] shadow-sm"
                >
                    <ClipboardList size={18} className="mb-1" />
                    Gestionar Categoría
                </button>
            </div>

            {/* Panel Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
                {/* Filtros */}
                <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">BUSCAR</label>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="appearance-none pl-4 pr-4 py-2 border border-slate-200 rounded-full text-[13px] text-slate-600 outline-none focus:border-blue-400 bg-white min-w-[250px] placeholder:text-slate-400"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">PROVEEDOR</label>
                            <div className="relative">
                                <select
                                    value={filtroProveedor}
                                    onChange={e => setFiltroProveedor(e.target.value)}
                                    className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-full text-[13px] text-slate-600 outline-none focus:border-blue-400 cursor-pointer bg-white min-w-[200px]"
                                >
                                    <option value="">Todos</option>
                                    {proveedoresDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex flex-col">
                                    <ChevronUp size={10} className="-mb-1" />
                                    <ChevronDown size={10} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={abrirDrawerCrearEquipo}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium transition-all flex flex-col items-center justify-center min-w-[100px] shadow-sm"
                    >
                        <Plus size={16} className="text-orange-500 mb-1" />
                        Crear Grupo
                    </button>
                </div>

                {/* Tabla */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                            <tr>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Key size={14} className="opacity-50" /> CÓDIGO</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><User size={14} className="opacity-50" /> PROVEEDOR</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Settings2 size={14} className="opacity-50" /> CATEGORÍA</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Cpu size={14} className="opacity-50" /> NOMBRE DEL EQUIPO</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider"><div className="flex items-center gap-2"><Layers size={14} className="opacity-50" /> COMPONENTES</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right"><div className="flex items-center justify-end gap-2"><DollarSign size={14} className="opacity-50" /> COSTO TOTAL</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center"><div className="flex items-center justify-center gap-2"><Landmark size={14} className="opacity-50" /> MONEDA</div></th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr><td colSpan={9} className="py-16 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Cargando...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={9} className="py-16 text-center text-red-500 text-[13px]">{loadError}</td></tr>
                            ) : equiposFiltrados.length > 0 ? (
                                equiposFiltrados.map((eq, index) => (
                                    <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4 text-[13px] text-slate-600">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] font-bold text-slate-800">{eq.codigo}</td>
                                        <td className="px-4 py-4 text-[13px] text-slate-600">{eq.proveedor}</td>
                                        <td className="px-4 py-4 text-[13px] text-slate-600">{eq.categoria_nombre}</td>
                                        <td className="px-4 py-4 text-[13px] font-medium text-slate-700">{eq.nombre_equipo}</td>
                                        <td className="px-4 py-4 text-[13px] text-slate-600">{eq.componentes_count}</td>
                                        <td className="px-4 py-4 text-[13px] font-bold text-emerald-600 text-right">
                                            {numeroOCero(eq.costo_total) > 0 ? numeroOCero(eq.costo_total).toFixed(2) : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {eq.moneda ? <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">{eq.moneda}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => void handleOpenDetail(eq)}
                                                className="px-4 py-1.5 bg-[#004A7C] hover:bg-[#00365a] text-white rounded-full text-[11px] font-medium transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto whitespace-nowrap"
                                            >
                                                <Eye size={14} /> Ver detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <ClipboardList size={32} className="mb-3 opacity-50" />
                                            <p className="text-sm font-medium">No hay registros para mostrar</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DRAWER: GESTIONAR CATEGORÍAS */}
            {isCatDrawerOpen && (
                <div className="fixed inset-0 z-[150] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsCatDrawerOpen(false)} />
                    <div className="relative w-full max-w-[400px] h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white shrink-0">
                            <h3 className="text-[18px] font-medium text-slate-800">Categorías</h3>
                            <button onClick={() => setIsCatDrawerOpen(false)} className="text-blue-300 hover:text-blue-500"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F8FAFC]">
                            {catError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {catError}
                                </div>
                            )}
                            {categorias.map((cat) => (
                                <div key={cat.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                    <div>
                                        <span className="text-[13px] text-slate-600 font-medium">{cat.nombre}</span>
                                        <span className="text-[10px] text-slate-400 block mt-0.5">{cat.proveedor}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => handleEditCategoria(cat)} className="text-[#93C5FD] hover:text-blue-500"><Pencil size={16} /></button>
                                        <button onClick={() => void handleDeleteCategoria(cat.id)} className="text-[#FCA5A5] hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            {isAddingCategoria && (
                                <div className="bg-white p-3 rounded-lg border-2 border-[#0EA5E9] shadow-sm mt-4 flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <input
                                            type="text"
                                            placeholder="Nombre de la categoría"
                                            className="w-full outline-none text-[13px] text-slate-700 bg-transparent placeholder:text-slate-300"
                                            value={newCategoriaNombre}
                                            onChange={(e) => setNewCategoriaNombre(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <button onClick={() => void handleSaveCategoria()} disabled={isSavingCategoria} className="text-[#F97316] hover:text-orange-600 disabled:opacity-50">
                                                {isSavingCategoria ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.5} />}
                                            </button>
                                            <button onClick={() => { setIsAddingCategoria(false); setEditingCatId(null); }} className="text-[#FCA5A5] hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Proveedor</label>
                                        {isLoadingProveedoresApi ? (
                                            <div className="flex items-center gap-2 text-[12px] text-slate-400 px-3 py-2">
                                                <Loader2 size={14} className="animate-spin" /> Cargando proveedores...
                                            </div>
                                        ) : proveedoresApiError ? (
                                            <p className="text-[11px] text-red-600 px-1">{proveedoresApiError}</p>
                                        ) : (
                                            <select
                                                value={newCategoriaProveedor}
                                                onChange={(e) => setNewCategoriaProveedor(e.target.value)}
                                                className="w-full appearance-none px-3 py-2 border border-slate-200 rounded text-[12px] text-slate-600 outline-none focus:border-[#0EA5E9] bg-slate-50 cursor-pointer"
                                            >
                                                <option value="" disabled>Seleccione un proveedor...</option>
                                                {proveedoresApi.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                            <button onClick={() => { setIsAddingCategoria(true); setEditingCatId(null); setNewCategoriaNombre(''); setNewCategoriaProveedor(''); }} className="flex flex-col items-center justify-center text-[#F97316] hover:text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50">
                                <Plus size={20} />
                                <span className="text-[11px] font-medium mt-1">Agregar categoría</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DRAWER: CREAR EQUIPO */}
            {isCreateDrawerOpen && (
                <div className="fixed inset-0 z-[150] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsCreateDrawerOpen(false)} />
                    <div className="relative w-full max-w-[400px] h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white shrink-0">
                            <h3 className="text-[18px] font-medium text-slate-800">Crear equipo</h3>
                            <button onClick={() => setIsCreateDrawerOpen(false)} className="text-blue-300 hover:text-blue-500"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                            <div>
                                <label className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2 block">* CATEGORÍA</label>
                                <div className="relative">
                                    <select
                                        value={formCategoriaId}
                                        onChange={(e) => setFormCategoriaId(e.target.value)}
                                        className="w-full appearance-none px-4 py-3 border border-blue-300 rounded-lg text-[13px] text-slate-700 outline-none focus:border-blue-500 bg-white cursor-pointer"
                                    >
                                        <option value="" disabled>Seleccione una categoría</option>
                                        {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre} ({cat.proveedor})</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none flex flex-col">
                                        <ChevronUp size={12} className="-mb-1" />
                                        <ChevronDown size={12} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2 block">* NOMBRE DEL EQUIPO</label>
                                <input
                                    type="text"
                                    value={formNombreEquipo}
                                    onChange={(e) => setFormNombreEquipo(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-[13px] text-slate-700 outline-none focus:border-blue-400 bg-white"
                                />
                            </div>

                            <div className="pt-2 flex items-center gap-2">
                                <span className="text-[12px] font-bold text-blue-600 uppercase tracking-wider">CÓDIGO:</span>
                                <span className="text-[13px] text-slate-400 font-mono tracking-widest">{codigoPreview}</span>
                            </div>

                            {createError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {createError}
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-white flex justify-end shrink-0">
                            <button
                                onClick={() => void handleSaveEquipo()}
                                disabled={!formCategoriaId || !formNombreEquipo.trim() || isSavingEquipo}
                                className="px-6 py-2.5 rounded-full border border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSavingEquipo ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DRAWER: VER DETALLE */}
            {isDetailDrawerOpen && detalleEquipo && (
                <div className="fixed inset-0 z-[150] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={cerrarDetalle} />
                    <div className="relative w-full max-w-[500px] h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white shrink-0">
                            <h3 className="text-[18px] font-medium text-slate-800">Detalle de Equipo</h3>
                            <button onClick={cerrarDetalle} className="text-blue-300 hover:text-blue-500"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 text-[#00A1E0]">
                                        <Layers size={18} />
                                        <h4 className="font-bold text-[15px]">{detalleEquipo.categoria_nombre}</h4>
                                    </div>
                                    <button
                                        onClick={() => setShowDeleteEquipoConfirm(true)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-lg shrink-0"
                                        title="Eliminar equipo"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">Nombre del Equipo:</p>
                                <p className="text-[14px] font-medium text-slate-800 mb-3">{detalleEquipo.nombre_equipo}</p>

                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">Código:</p>
                                <p className="text-[14px] font-medium text-slate-800 mb-3">{detalleEquipo.codigo}</p>

                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">Proveedor:</p>
                                <p className="text-[14px] font-medium text-slate-800">{detalleEquipo.proveedor}</p>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 text-slate-100"><Landmark size={80} /></div>
                                <div className="relative">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Costo Proveedor Total</label>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-blue-600">{totalCostoDetalle > 0 ? totalCostoDetalle.toFixed(2) : '0.00'}</span>
                                        <span className="text-lg font-bold text-slate-400 mb-1">{totalCostoDetalle > 0 ? monedaDetalle : 'USD'}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5"><AlertCircle size={14} /> Calculado automáticamente según los componentes.</p>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={utilidadInternaActiva}
                                        onChange={(e) => handleToggleUtilidadInterna(e.target.checked)}
                                        disabled={isSavingUtilidad}
                                        className="w-4 h-4 accent-[#2173B9] cursor-pointer"
                                    />
                                    <span className="text-[13px] font-bold text-slate-700">Utilidad Interna</span>
                                    {isSavingUtilidad && <Loader2 size={14} className="animate-spin text-slate-400" />}
                                </label>

                                {utilidadInternaActiva && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.01"
                                            placeholder="Ej: 10"
                                            value={utilidadInternaValor}
                                            onChange={(e) => setUtilidadInternaValor(e.target.value)}
                                            onBlur={handleBlurUtilidadInterna}
                                            disabled={isSavingUtilidad}
                                            className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 bg-white disabled:opacity-60"
                                        />
                                        <span className="text-[13px] text-slate-500">%</span>
                                    </div>
                                )}

                                {utilidadError && (
                                    <p className="text-[11px] text-red-600 mt-2 flex items-center gap-1.5"><AlertCircle size={12} /> {utilidadError}</p>
                                )}
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <h5 className="text-[12px] font-bold text-[#00A1E0] uppercase tracking-wider mb-4">COMPONENTES DEL EQUIPO ({detalleComponentes.length})</h5>

                                {compError && (
                                    <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {compError}
                                    </div>
                                )}

                                {isLoadingDetalle ? (
                                    <div className="py-8 text-center text-slate-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
                                ) : detalleComponentes.length > 0 ? (
                                    <div className="space-y-3 mb-6">
                                        {detalleComponentes.map(comp => (
                                            <div key={comp.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-50 border border-slate-100 rounded text-slate-400"><Cpu size={16} /></div>
                                                    <span className="text-[13px] font-medium text-slate-700">{comp.nombre}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[13px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                                        {comp.costo ? `${numeroOCero(comp.costo).toFixed(2)} ${comp.moneda}` : '0.00 USD'}
                                                    </div>
                                                    <button onClick={() => void handleDeleteComponente(comp.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[13px] text-slate-500 mb-6 py-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200 flex flex-col items-center">
                                        <Cpu size={24} className="mb-2 text-slate-300" />
                                        No hay componentes registrados
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={abrirModalComponente}
                                        className="flex flex-col items-center justify-center text-slate-500 hover:text-[#00A1E0] transition-colors border border-slate-200 rounded-lg px-6 py-3 hover:bg-blue-50/50 shadow-sm bg-white hover:border-blue-300"
                                    >
                                        <Plus size={20} className="text-orange-400 mb-1" />
                                        <span className="text-[11px] font-medium">Añadir componente</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                            <button onClick={cerrarDetalle} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[13px] font-bold transition-colors shadow-sm">Cerrar detalle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: AÑADIR COMPONENTE */}
            {isAddCompModalOpen && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddCompModalOpen(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-[#F8FAFC]">
                            <h3 className="text-[16px] font-bold text-slate-800">Añadir Componente</h3>
                            <button onClick={() => setIsAddCompModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <input
                                    type="text"
                                    placeholder="* NOMBRE DEL COMPONENTE - Ingrese el nombre del componente"
                                    value={compNombre}
                                    onChange={e => setCompNombre(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                                    autoFocus
                                />
                            </div>

                            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-[13px] font-bold text-slate-800">Costo del componente</h4>
                                    {!compShowCosto && (
                                        <button
                                            onClick={() => setCompShowCosto(true)}
                                            className="px-4 py-2 rounded-full border border-orange-400 text-orange-500 text-[11px] font-bold hover:bg-orange-50 flex items-center gap-1.5 bg-white shadow-sm"
                                        >
                                            <Plus size={14} /> Añadir Costo del Componente
                                        </button>
                                    )}
                                </div>

                                {!compShowCosto ? (
                                    <p className="text-[11px] text-slate-500 text-center py-5 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        $ No hay costo. Haz clic en "Añadir Costo del Componente" para agregar uno.
                                    </p>
                                ) : (
                                    <div className="flex gap-3">
                                        <div className="relative w-1/3">
                                            <select
                                                value={compMoneda}
                                                onChange={e => setCompMoneda(e.target.value)}
                                                className="w-full appearance-none px-4 py-3 border border-slate-300 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-500 bg-white cursor-pointer font-bold shadow-sm"
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Ej: 1500.00"
                                            value={compCosto}
                                            onChange={e => setCompCosto(e.target.value)}
                                            className="w-2/3 px-4 py-3 border border-slate-300 rounded-xl text-[14px] font-bold text-slate-800 outline-none focus:border-blue-500 bg-white shadow-sm"
                                        />
                                        <button
                                            onClick={() => { setCompShowCosto(false); setCompCosto(''); }}
                                            className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {compError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {compError}
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-[#F8FAFC] flex justify-end shrink-0">
                            <button
                                onClick={() => void handleSaveComponente()}
                                disabled={!compNombre.trim() || isSavingComponente}
                                className="px-6 py-2.5 bg-white border border-blue-400 text-blue-600 rounded-full text-[13px] font-bold hover:bg-blue-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSavingComponente ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: CONFIRMAR ELIMINAR EQUIPO */}
            {showDeleteEquipoConfirm && detalleEquipo && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isDeletingEquipo && setShowDeleteEquipoConfirm(false)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="mb-4 text-red-500">
                                <AlertTriangle size={48} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-[17px] font-bold text-slate-800 mb-2">¿Eliminar este equipo?</h3>
                            <p className="text-[13px] text-slate-500 leading-relaxed">
                                Se eliminará <span className="font-bold text-slate-700">{detalleEquipo.nombre_equipo}</span> y todos sus componentes configurados. Esta acción no se puede deshacer.
                            </p>
                            {deleteEquipoError && (
                                <p className="mt-3 w-full text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {deleteEquipoError}
                                </p>
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-center gap-4">
                            <button
                                onClick={() => setShowDeleteEquipoConfirm(false)}
                                disabled={isDeletingEquipo}
                                className="px-8 py-2.5 rounded-full border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors w-1/2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => void handleDeleteEquipo()}
                                disabled={isDeletingEquipo}
                                className="px-8 py-2.5 rounded-full bg-[#DC2626] text-white font-medium hover:bg-red-700 shadow-sm transition-colors w-1/2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isDeletingEquipo ? <Loader2 size={16} className="animate-spin" /> : null} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
