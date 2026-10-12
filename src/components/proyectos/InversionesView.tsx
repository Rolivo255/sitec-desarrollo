import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Briefcase, Calendar, DollarSign, Download, Eye, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import ExcelJS from 'exceljs';

interface Inversion {
    id: number;
    nombre: string;
    conversion: string | number | null;
    desaduanizacion: string | number | null;
    utilidad: string | number | null;
    interes: string | number | null;
    anios_operacion: string | number | null;
    estado: string;
}

interface PlantillaUrbaparkItem {
    id: number;
    codigo: string;
    proveedor: string;
    categoria: string;
    descripcion: string;
    equipo_id: number;
    costo_proveedor: string | number | null;
    costo_proveedor_dolares: string | number | null;
    desaduanizacion: string | number | null;
    utilidad_interna: string | number | null;
    utilidad: string | number | null;
    costo_urbapark: string | number | null;
    costo_urbapark_referencia: string | number | null;
    precio_venta_inversion: string | number | null;
}

interface InversionItem {
    id: number;
    items: string;
    descripcion: string;
    precio_unit: string | number | null;
    cantidad: string | number | null;
    precio_total: string | number | null;
    observacion: string | null;
}

const API_BASE = '/api/proyectos/inversiones';

const vacioOValor = (valor: string | number | null | undefined): string => {
    if (valor === null || valor === undefined || valor === '') return 'N/A';
    return String(valor);
};

const montoOVacio = (valor: string | number | null | undefined): string => {
    if (valor === null || valor === undefined || valor === '') return 'N/A';
    return `$${valor}`;
};

const porcentajeOVacio = (valor: string | number | null | undefined): string => {
    if (valor === null || valor === undefined || valor === '') return 'N/A';
    return `${valor}%`;
};

const numeroOCero = (valor: string | number | null | undefined): number => {
    const num = Number(valor ?? 0);
    return Number.isFinite(num) ? num : 0;
};

export default function InversionesView() {
    const [inversiones, setInversiones] = useState<Inversion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState<Inversion | null>(null);
    const [detalleNombreEdit, setDetalleNombreEdit] = useState('');
    const [isEditandoDetalle, setIsEditandoDetalle] = useState(false);
    const [detalleConversionEdit, setDetalleConversionEdit] = useState('');
    const [detalleDesaduanizacionEdit, setDetalleDesaduanizacionEdit] = useState('');
    const [detalleUtilidadEdit, setDetalleUtilidadEdit] = useState('');
    const [detalleInteresEdit, setDetalleInteresEdit] = useState('');
    const [detalleAniosOperacionEdit, setDetalleAniosOperacionEdit] = useState('');
    const [isSavingDetalle, setIsSavingDetalle] = useState(false);
    const [saveDetalleError, setSaveDetalleError] = useState('');

    const [nombre, setNombre] = useState('');
    const [conversion, setConversion] = useState('');
    const [desaduanizacion, setDesaduanizacion] = useState('');
    const [utilidad, setUtilidad] = useState('');
    const [interes, setInteres] = useState('');
    const [aniosOperacion, setAniosOperacion] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Consolidado (Plantilla_Urbapark) e items ya guardados para la inversion abierta
    const [plantillaUrbapark, setPlantillaUrbapark] = useState<PlantillaUrbaparkItem[]>([]);
    const [inversionItems, setInversionItems] = useState<InversionItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [itemsError, setItemsError] = useState('');

    // Grupos de Categoría abiertos en el detalle (cada uno es un "universo" que agrupa items)
    const [categoriasAbiertas, setCategoriasAbiertas] = useState<string[]>([]);
    const [mostrarSelectorCategoria, setMostrarSelectorCategoria] = useState(false);
    const [categoriaAAbrir, setCategoriaAAbrir] = useState('');

    // Formulario inline para agregar un item dentro del grupo de categoría activo
    const [grupoAgregandoItem, setGrupoAgregandoItem] = useState<string | null>(null);
    const [descripcionNuevoItem, setDescripcionNuevoItem] = useState('');
    const [codigoNuevoItem, setCodigoNuevoItem] = useState('');
    const [cantidadNuevoItem, setCantidadNuevoItem] = useState('');
    const [observacionNuevoItem, setObservacionNuevoItem] = useState('');
    const [isSavingItem, setIsSavingItem] = useState(false);
    const [saveItemError, setSaveItemError] = useState('');

    // Edicion inline de un item ya guardado: permite cambiar su Descripcion/Codigo,
    // lo que recalcula precio_unit/precio_total en funcion de precio_venta_inversion
    const [itemEditando, setItemEditando] = useState<InversionItem | null>(null);
    const [descripcionEditItem, setDescripcionEditItem] = useState('');
    const [codigoEditItem, setCodigoEditItem] = useState('');
    const [cantidadEditItem, setCantidadEditItem] = useState('');
    const [observacionEditItem, setObservacionEditItem] = useState('');
    const [isSavingEditItem, setIsSavingEditItem] = useState(false);
    const [saveEditItemError, setSaveEditItemError] = useState('');

    // Modal demostrativo "Precios Urbapark": consolidado de Plantilla_Urbapark para la
    // inversion elegida. Solo permite editar utilidad_interna (se guarda en Plantilla_Proveedor,
    // no afecta a Inversiones_Proyectos).
    const [preciosUrbaparkInversion, setPreciosUrbaparkInversion] = useState<Inversion | null>(null);
    const [preciosUrbaparkFilas, setPreciosUrbaparkFilas] = useState<PlantillaUrbaparkItem[]>([]);
    const [isLoadingPreciosUrbapark, setIsLoadingPreciosUrbapark] = useState(false);
    const [preciosUrbaparkError, setPreciosUrbaparkError] = useState('');
    const [cambiosUtilidadInterna, setCambiosUtilidadInterna] = useState<Record<number, string>>({});
    const [isGuardandoUtilidadInterna, setIsGuardandoUtilidadInterna] = useState(false);
    const [guardarUtilidadInternaError, setGuardarUtilidadInternaError] = useState('');

    const cargarInversiones = async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await authenticatedFetch(API_BASE);
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
        setConversion('');
        setDesaduanizacion('');
        setUtilidad('');
        setInteres('');
        setAniosOperacion('');
        setSaveError('');
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const response = await authenticatedFetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre.trim(),
                    conversion: conversion || undefined,
                    desaduanizacion: desaduanizacion || undefined,
                    utilidad: utilidad || undefined,
                    interes: interes || undefined,
                    aniosOperacion: aniosOperacion || undefined,
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

    const abrirDetalle = async (inv: Inversion) => {
        setShowDetailModal(inv);
        setDetalleNombreEdit(inv.nombre);
        setIsEditandoDetalle(false);
        setSaveDetalleError('');
        setCategoriasAbiertas([]);
        setMostrarSelectorCategoria(false);
        setCategoriaAAbrir('');
        setGrupoAgregandoItem(null);
        setDescripcionNuevoItem('');
        setCodigoNuevoItem('');
        setCantidadNuevoItem('');
        setObservacionNuevoItem('');
        setSaveItemError('');
        setItemEditando(null);
        setDescripcionEditItem('');
        setCodigoEditItem('');
        setCantidadEditItem('');
        setObservacionEditItem('');
        setSaveEditItemError('');
        setPlantillaUrbapark([]);
        setInversionItems([]);
        setItemsError('');
        setIsLoadingItems(true);
        try {
            const [resUrbapark, resItems] = await Promise.all([
                authenticatedFetch(`/api/proyectos/plantilla-urbapark?inversionId=${inv.id}`),
                authenticatedFetch(`${API_BASE}/${inv.id}/items`),
            ]);
            if (!resUrbapark.ok) throw new Error(`Error ${resUrbapark.status} al cargar el consolidado`);
            if (!resItems.ok) throw new Error(`Error ${resItems.status} al cargar los items`);
            const urbaparkPayload = await resUrbapark.json() as { items: PlantillaUrbaparkItem[] };
            const itemsPayload = await resItems.json() as { items: InversionItem[] };
            const urbaparkItems = urbaparkPayload.items ?? [];
            const items = itemsPayload.items ?? [];
            setPlantillaUrbapark(urbaparkItems);
            setInversionItems(items);
            // Abre automaticamente los grupos de categoria que ya tienen items guardados
            const categoriasConItems = Array.from(new Set(
                items
                    .map(it => urbaparkItems.find(p => p.codigo === it.items)?.categoria)
                    .filter((c): c is string => Boolean(c))
            ));
            setCategoriasAbiertas(categoriasConItems);
        } catch (error) {
            setItemsError(error instanceof Error ? error.message : 'No se pudo cargar la información de items.');
        } finally {
            setIsLoadingItems(false);
        }
    };

    const activarEdicionDetalle = () => {
        if (!showDetailModal) return;
        setDetalleNombreEdit(showDetailModal.nombre);
        setDetalleConversionEdit(showDetailModal.conversion !== null && showDetailModal.conversion !== undefined ? String(showDetailModal.conversion) : '');
        setDetalleDesaduanizacionEdit(showDetailModal.desaduanizacion !== null && showDetailModal.desaduanizacion !== undefined ? String(showDetailModal.desaduanizacion) : '');
        setDetalleUtilidadEdit(showDetailModal.utilidad !== null && showDetailModal.utilidad !== undefined ? String(showDetailModal.utilidad) : '');
        setDetalleInteresEdit(showDetailModal.interes !== null && showDetailModal.interes !== undefined ? String(showDetailModal.interes) : '');
        setDetalleAniosOperacionEdit(showDetailModal.anios_operacion !== null && showDetailModal.anios_operacion !== undefined ? String(showDetailModal.anios_operacion) : '');
        setSaveDetalleError('');
        setIsEditandoDetalle(true);
    };

    const cancelarEdicionDetalle = () => {
        if (showDetailModal) setDetalleNombreEdit(showDetailModal.nombre);
        setIsEditandoDetalle(false);
        setSaveDetalleError('');
    };

    const handleGuardarDetalle = async () => {
        if (!showDetailModal || !detalleNombreEdit.trim()) return;
        setIsSavingDetalle(true);
        setSaveDetalleError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/${showDetailModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: detalleNombreEdit.trim(),
                    conversion: detalleConversionEdit || undefined,
                    desaduanizacion: detalleDesaduanizacionEdit || undefined,
                    utilidad: detalleUtilidadEdit || undefined,
                    interes: detalleInteresEdit || undefined,
                    aniosOperacion: detalleAniosOperacionEdit || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { inversion?: Inversion; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            const actualizada = payload!.inversion!;
            setShowDetailModal(actualizada);
            setInversiones(prev => prev.map(inv => (inv.id === actualizada.id ? actualizada : inv)));
            setIsEditandoDetalle(false);
        } catch (error) {
            setSaveDetalleError(error instanceof Error ? error.message : 'No se pudo guardar la inversión.');
        } finally {
            setIsSavingDetalle(false);
        }
    };

    const categoriasDisponibles = useMemo(
        () => Array.from(new Set(plantillaUrbapark.map(p => p.categoria))).sort(),
        [plantillaUrbapark]
    );

    const categoriasParaAbrir = useMemo(
        () => categoriasDisponibles.filter(c => !categoriasAbiertas.includes(c)),
        [categoriasDisponibles, categoriasAbiertas]
    );

    const obtenerCategoriaDeItem = (item: InversionItem): string | null =>
        plantillaUrbapark.find(p => p.codigo === item.items)?.categoria ?? null;

    const totalProyecto = useMemo(
        () => inversionItems.reduce((acc, it) => acc + numeroOCero(it.precio_total), 0),
        [inversionItems]
    );

    const equiposDelGrupoActivo = useMemo(
        () => plantillaUrbapark.filter(p => p.categoria === grupoAgregandoItem),
        [plantillaUrbapark, grupoAgregandoItem]
    );

    const descripcionesDelGrupoActivo = useMemo(
        () => Array.from(new Set(equiposDelGrupoActivo.map(eq => eq.descripcion))),
        [equiposDelGrupoActivo]
    );

    const codigosDeDescripcionActiva = useMemo(
        () => equiposDelGrupoActivo.filter(eq => eq.descripcion === descripcionNuevoItem),
        [equiposDelGrupoActivo, descripcionNuevoItem]
    );

    const equipoSeleccionado = useMemo(
        () => plantillaUrbapark.find(p => p.codigo === codigoNuevoItem) ?? null,
        [plantillaUrbapark, codigoNuevoItem]
    );

    const precioUnitNuevo = equipoSeleccionado ? numeroOCero(equipoSeleccionado.precio_venta_inversion) : 0;
    const precioTotalNuevo = precioUnitNuevo * numeroOCero(cantidadNuevoItem);

    const confirmarAbrirCategoria = () => {
        if (!categoriaAAbrir) return;
        setCategoriasAbiertas(prev => prev.includes(categoriaAAbrir) ? prev : [...prev, categoriaAAbrir]);
        setMostrarSelectorCategoria(false);
        setCategoriaAAbrir('');
    };

    const cerrarGrupoVacio = (categoria: string) => {
        setCategoriasAbiertas(prev => prev.filter(c => c !== categoria));
        if (grupoAgregandoItem === categoria) {
            setGrupoAgregandoItem(null);
        }
    };

    const abrirFormAgregarItem = (categoria: string) => {
        setGrupoAgregandoItem(categoria);
        setDescripcionNuevoItem('');
        setCodigoNuevoItem('');
        setCantidadNuevoItem('');
        setObservacionNuevoItem('');
        setSaveItemError('');
    };

    const cancelarFormNuevoItem = () => {
        setGrupoAgregandoItem(null);
        setDescripcionNuevoItem('');
        setCodigoNuevoItem('');
        setCantidadNuevoItem('');
        setObservacionNuevoItem('');
        setSaveItemError('');
    };

    const handleGuardarItem = async () => {
        if (!showDetailModal || !codigoNuevoItem || !cantidadNuevoItem) return;
        setIsSavingItem(true);
        setSaveItemError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/${showDetailModal.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo: codigoNuevoItem,
                    cantidad: cantidadNuevoItem,
                    observacion: observacionNuevoItem.trim() || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { item?: InversionItem; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setInversionItems(prev => [...prev, payload!.item!]);
            setDescripcionNuevoItem('');
            setCodigoNuevoItem('');
            setCantidadNuevoItem('');
            setObservacionNuevoItem('');
        } catch (error) {
            setSaveItemError(error instanceof Error ? error.message : 'No se pudo guardar el item.');
        } finally {
            setIsSavingItem(false);
        }
    };

    const abrirEditarItem = (item: InversionItem) => {
        const equipoActual = plantillaUrbapark.find(p => p.codigo === item.items);
        setItemEditando(item);
        setDescripcionEditItem(equipoActual?.descripcion ?? item.descripcion);
        setCodigoEditItem(item.items);
        setCantidadEditItem(item.cantidad !== null ? String(item.cantidad) : '');
        setObservacionEditItem(item.observacion ?? '');
        setSaveEditItemError('');
    };

    const cancelarEditarItem = () => {
        setItemEditando(null);
        setDescripcionEditItem('');
        setCodigoEditItem('');
        setCantidadEditItem('');
        setObservacionEditItem('');
        setSaveEditItemError('');
    };

    const handleActualizarItem = async () => {
        if (!itemEditando || !codigoEditItem || !cantidadEditItem) return;
        setIsSavingEditItem(true);
        setSaveEditItemError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/items/${itemEditando.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo: codigoEditItem,
                    cantidad: cantidadEditItem,
                    observacion: observacionEditItem.trim() || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { item?: InversionItem; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setInversionItems(prev => prev.map(it => (it.id === payload!.item!.id ? payload!.item! : it)));
            cancelarEditarItem();
        } catch (error) {
            setSaveEditItemError(error instanceof Error ? error.message : 'No se pudo actualizar el item.');
        } finally {
            setIsSavingEditItem(false);
        }
    };

    const handleEliminarItem = async (id: number) => {
        setItemsError('');
        try {
            const response = await authenticatedFetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
            setInversionItems(prev => prev.filter(it => it.id !== id));
            if (itemEditando?.id === id) {
                cancelarEditarItem();
            }
        } catch (error) {
            setItemsError(error instanceof Error ? error.message : 'No se pudo eliminar el item.');
        }
    };

    const abrirPreciosUrbapark = async (inv: Inversion) => {
        setPreciosUrbaparkInversion(inv);
        setCambiosUtilidadInterna({});
        setGuardarUtilidadInternaError('');
        setPreciosUrbaparkError('');
        setIsLoadingPreciosUrbapark(true);
        try {
            const response = await authenticatedFetch(`/api/proyectos/plantilla-urbapark?inversionId=${inv.id}`);
            if (!response.ok) throw new Error(`Error ${response.status} al cargar los precios Urbapark`);
            const payload = await response.json() as { items: PlantillaUrbaparkItem[] };
            setPreciosUrbaparkFilas(payload.items ?? []);
        } catch (error) {
            setPreciosUrbaparkError(error instanceof Error ? error.message : 'No se pudieron cargar los precios Urbapark.');
        } finally {
            setIsLoadingPreciosUrbapark(false);
        }
    };

    const handleCambiarUtilidadInterna = (equipoId: number, valor: string) => {
        setCambiosUtilidadInterna(prev => ({ ...prev, [equipoId]: valor }));
    };

    const handleActualizarValoresUtilidadInterna = async () => {
        const entradas = Object.entries(cambiosUtilidadInterna);
        if (entradas.length === 0) return;
        setIsGuardandoUtilidadInterna(true);
        setGuardarUtilidadInternaError('');
        try {
            for (const [equipoIdStr, valor] of entradas) {
                const response = await authenticatedFetch(`/api/proyectos/plantilla-proveedor/equipos/${equipoIdStr}/utilidad-interna`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ utilidadInterna: Number(valor) }),
                });
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                if (!response.ok) throw new Error(payload?.error || `Error ${response.status} al actualizar un equipo`);
            }
            setPreciosUrbaparkFilas(prev => prev.map(fila => (
                cambiosUtilidadInterna[fila.equipo_id] !== undefined
                    ? { ...fila, utilidad_interna: cambiosUtilidadInterna[fila.equipo_id] }
                    : fila
            )));
            setCambiosUtilidadInterna({});
        } catch (error) {
            setGuardarUtilidadInternaError(error instanceof Error ? error.message : 'No se pudieron actualizar los valores.');
        } finally {
            setIsGuardandoUtilidadInterna(false);
        }
    };

    const hayCambiosUtilidadInterna = Object.keys(cambiosUtilidadInterna).length > 0;

    const descargarExcelPreciosUrbapark = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Precios Urbapark');

        worksheet.columns = [
            { header: 'CÓDIGO', key: 'codigo', width: 16 },
            { header: 'CATEGORÍA', key: 'categoria', width: 22 },
            { header: 'PROVEEDOR', key: 'proveedor', width: 16 },
            { header: 'DESCRIPCIÓN', key: 'descripcion', width: 30 },
            { header: 'COSTO PROVEEDOR $', key: 'costoProveedorDolares', width: 18 },
            { header: 'UTILIDAD INTERNA (%)', key: 'utilidadInterna', width: 18 },
            { header: 'COSTO URBAPARK', key: 'costoUrbapark', width: 16 },
            { header: 'COSTO URBAPARK REFERENCIA', key: 'costoUrbaparkReferencia', width: 22 },
            { header: 'PRECIO VENTA INVERSIÓN', key: 'precioVentaInversion', width: 20 },
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        headerRow.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        preciosUrbaparkFilas.forEach((fila) => {
            const utilidadInternaMostrada = cambiosUtilidadInterna[fila.equipo_id] ?? fila.utilidad_interna;
            const row = worksheet.addRow({
                codigo: fila.codigo,
                categoria: fila.categoria,
                proveedor: fila.proveedor,
                descripcion: fila.descripcion,
                costoProveedorDolares: numeroOCero(fila.costo_proveedor_dolares),
                utilidadInterna: numeroOCero(utilidadInternaMostrada),
                costoUrbapark: numeroOCero(fila.costo_urbapark),
                costoUrbaparkReferencia: numeroOCero(fila.costo_urbapark_referencia),
                precioVentaInversion: numeroOCero(fila.precio_venta_inversion),
            });
            row.eachCell((cell) => {
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        const nombreArchivo = (preciosUrbaparkInversion?.nombre || 'inversion').replace(/\s+/g, '_');
        const fileName = `Precios_Urbapark_${nombreArchivo}.xlsx`;
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
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">NOMBRE INVERSIÓN</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">CONVERSIÓN</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">DESADUANIZACIÓN</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">UTILIDAD</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ESTADO</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider text-center">DETALLE</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider text-center">PRECIOS URBAPARK</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-16 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Cargando...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={7} className="py-16 text-center text-red-500 text-[13px]">{loadError}</td></tr>
                            ) : inversiones.length > 0 ? (
                                inversiones.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-[14px] font-bold text-[#334155]">{inv.nombre}</td>
                                        <td className="px-6 py-4 text-[13px] text-slate-600">{vacioOValor(inv.conversion)}</td>
                                        <td className="px-6 py-4 text-[13px] text-slate-600">{vacioOValor(inv.desaduanizacion)}</td>
                                        <td className="px-6 py-4 text-[13px] font-bold text-emerald-600">{porcentajeOVacio(inv.utilidad)}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-200">
                                                {inv.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => void abrirDetalle(inv)}
                                                className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors mx-auto block"
                                                title="Ver detalle"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => void abrirPreciosUrbapark(inv)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors mx-auto block"
                                                title="Ver precios Urbapark"
                                            >
                                                <DollarSign size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
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
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Conversión a Dólar</label>
                                    <input type="number" step="0.01" placeholder="Ej: 1.2" value={conversion} onChange={e => setConversion(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Desaduanización</label>
                                    <input type="number" step="0.01" placeholder="Ej: 1.2" value={desaduanizacion} onChange={e => setDesaduanizacion(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Utilidad (%)</label>
                                    <input type="number" step="0.1" placeholder="Ej: 20" value={utilidad} onChange={e => setUtilidad(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Interés</label>
                                    <input type="number" step="0.01" placeholder="Ej: 5000" value={interes} onChange={e => setInteres(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Años de Operación</label>
                                    <input type="number" step="1" min={0} placeholder="Ej: 10" value={aniosOperacion} onChange={e => setAniosOperacion(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] outline-none focus:border-blue-400 text-slate-700 bg-white placeholder:text-slate-400" />
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
                    <div className="relative bg-[#F4F9F6] rounded-2xl w-full max-w-[1400px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-emerald-100 bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Calendar size={20} /></div>
                                <h3 className="text-[18px] font-bold text-[#1E293B]">Detalle de Inversión</h3>
                            </div>
                            <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nombre del Proyecto</label>
                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                                    <input
                                        type="text"
                                        value={detalleNombreEdit}
                                        onChange={(e) => setDetalleNombreEdit(e.target.value)}
                                        readOnly={!isEditandoDetalle}
                                        className={`flex-1 text-[14px] font-bold text-[#1E293B] outline-none bg-transparent ${isEditandoDetalle ? '' : 'cursor-default'}`}
                                    />
                                    {!isEditandoDetalle && (
                                        <button
                                            onClick={activarEdicionDetalle}
                                            className="text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                                            title="Editar inversión"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conversión ($)</p>
                                    {isEditandoDetalle ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={detalleConversionEdit}
                                            onChange={(e) => setDetalleConversionEdit(e.target.value)}
                                            className="w-full text-[14px] font-bold text-slate-700 outline-none border border-slate-200 rounded-lg px-2 py-1 focus:border-emerald-400"
                                        />
                                    ) : (
                                        <p className="text-[14px] font-bold text-slate-700">{vacioOValor(showDetailModal.conversion)}</p>
                                    )}
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Desaduanización</p>
                                    {isEditandoDetalle ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={detalleDesaduanizacionEdit}
                                            onChange={(e) => setDetalleDesaduanizacionEdit(e.target.value)}
                                            className="w-full text-[14px] font-bold text-slate-700 outline-none border border-slate-200 rounded-lg px-2 py-1 focus:border-emerald-400"
                                        />
                                    ) : (
                                        <p className="text-[14px] font-bold text-slate-700">{vacioOValor(showDetailModal.desaduanizacion)}</p>
                                    )}
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
                                    {isEditandoDetalle ? (
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={detalleUtilidadEdit}
                                            onChange={(e) => setDetalleUtilidadEdit(e.target.value)}
                                            className="w-full text-[14px] font-bold text-emerald-600 outline-none border border-slate-200 rounded-lg px-2 py-1 focus:border-emerald-400"
                                        />
                                    ) : (
                                        <p className="text-[14px] font-bold text-emerald-600">{porcentajeOVacio(showDetailModal.utilidad)}</p>
                                    )}
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interés</p>
                                    {isEditandoDetalle ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={detalleInteresEdit}
                                            onChange={(e) => setDetalleInteresEdit(e.target.value)}
                                            className="w-full text-[14px] font-bold text-slate-700 outline-none border border-slate-200 rounded-lg px-2 py-1 focus:border-emerald-400"
                                        />
                                    ) : (
                                        <p className="text-[14px] font-bold text-slate-700">{vacioOValor(showDetailModal.interes)}</p>
                                    )}
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Años de Operación</p>
                                    {isEditandoDetalle ? (
                                        <input
                                            type="number"
                                            step="1"
                                            min={0}
                                            value={detalleAniosOperacionEdit}
                                            onChange={(e) => setDetalleAniosOperacionEdit(e.target.value)}
                                            className="w-full text-[14px] font-bold text-slate-700 outline-none border border-slate-200 rounded-lg px-2 py-1 focus:border-emerald-400"
                                        />
                                    ) : (
                                        <p className="text-[14px] font-bold text-slate-700">{vacioOValor(showDetailModal.anios_operacion)}</p>
                                    )}
                                </div>
                            </div>

                            {isEditandoDetalle && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => void handleGuardarDetalle()}
                                        disabled={!detalleNombreEdit.trim() || isSavingDetalle}
                                        className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSavingDetalle ? <Loader2 size={14} className="animate-spin" /> : null} Guardar cambios
                                    </button>
                                    <button
                                        onClick={cancelarEdicionDetalle}
                                        className="px-5 py-2 text-slate-500 hover:text-slate-700 text-[12px] font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    {saveDetalleError && (
                                        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{saveDetalleError}</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <h4 className="text-[16px] font-bold text-[#1E293B]">Items de la Categoría</h4>
                                    {!mostrarSelectorCategoria && (
                                        <button
                                            onClick={() => setMostrarSelectorCategoria(true)}
                                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus size={14} /> Nueva Categoría
                                        </button>
                                    )}
                                </div>

                                {mostrarSelectorCategoria && (
                                    <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4 mb-4">
                                        <div className="min-w-[220px]">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Categoría</label>
                                            <select
                                                value={categoriaAAbrir}
                                                onChange={(e) => setCategoriaAAbrir(e.target.value)}
                                                className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white cursor-pointer"
                                            >
                                                <option value="">Seleccione una categoría...</option>
                                                {categoriasParaAbrir.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <button
                                            onClick={confirmarAbrirCategoria}
                                            disabled={!categoriaAAbrir}
                                            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Agregar
                                        </button>
                                        <button
                                            onClick={() => { setMostrarSelectorCategoria(false); setCategoriaAAbrir(''); }}
                                            className="px-4 py-2 text-slate-500 hover:text-slate-700 text-[12px] font-medium"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}

                                {itemsError && (
                                    <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {itemsError}
                                    </div>
                                )}

                                {isLoadingItems ? (
                                    <div className="bg-white border border-slate-200 rounded-xl py-10 text-center text-[12px] text-slate-400">
                                        <Loader2 size={18} className="animate-spin mx-auto mb-2" /> Cargando items...
                                    </div>
                                ) : categoriasAbiertas.length === 0 ? (
                                    <div className="bg-white border border-slate-200 rounded-xl py-10 text-center text-[12px] text-slate-400">
                                        Aún no has agregado ninguna categoría.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {categoriasAbiertas.map((categoria) => {
                                            const itemsDeCategoria = inversionItems.filter(it => obtenerCategoriaDeItem(it) === categoria);
                                            const estaAgregando = grupoAgregandoItem === categoria;
                                            const equiposDeEstaCategoria = plantillaUrbapark.filter(p => p.categoria === categoria);
                                            const descripcionesEdit = Array.from(new Set(equiposDeEstaCategoria.map(eq => eq.descripcion)));
                                            const codigosDeDescripcionEdit = equiposDeEstaCategoria.filter(eq => eq.descripcion === descripcionEditItem);
                                            const equipoSeleccionadoEdit = plantillaUrbapark.find(p => p.codigo === codigoEditItem) ?? null;
                                            const precioUnitEdit = equipoSeleccionadoEdit ? numeroOCero(equipoSeleccionadoEdit.precio_venta_inversion) : 0;
                                            const precioTotalEdit = precioUnitEdit * numeroOCero(cantidadEditItem);
                                            const subtotalCategoria = itemsDeCategoria.reduce((acc, it) => acc + numeroOCero(it.precio_total), 0);
                                            return (
                                                <div key={categoria} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                                        <div className="flex items-center gap-3">
                                                            <h5 className="text-[13px] font-bold text-slate-700">{categoria}</h5>
                                                            <span className="text-[12px] font-bold text-emerald-600">{montoOVacio(subtotalCategoria.toFixed(2))}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!estaAgregando && (
                                                                <button
                                                                    onClick={() => abrirFormAgregarItem(categoria)}
                                                                    className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5"
                                                                >
                                                                    <Plus size={12} /> Agregar Item
                                                                </button>
                                                            )}
                                                            {itemsDeCategoria.length === 0 && !estaAgregando && (
                                                                <button
                                                                    onClick={() => cerrarGrupoVacio(categoria)}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                                    title="Quitar categoría"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead className="bg-slate-100 border-b border-slate-200">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item</th>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descripcion</th>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Precio Unit</th>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cant</th>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Precio Total</th>
                                                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Observaciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {itemsDeCategoria.length === 0 && !estaAgregando && (
                                                                    <tr>
                                                                        <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-slate-400">
                                                                            Aún no hay items en esta categoría.
                                                                        </td>
                                                                    </tr>
                                                                )}

                                                                {itemsDeCategoria.map((item) => {
                                                                    const estaEditando = itemEditando?.id === item.id;
                                                                    if (!estaEditando) {
                                                                        return (
                                                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                                <td className="px-4 py-3 text-[12px] font-mono text-slate-600">{item.items}</td>
                                                                                <td className="px-4 py-3 text-[13px] font-medium text-slate-700">{item.descripcion}</td>
                                                                                <td className="px-4 py-3 text-[12px] text-slate-600">{montoOVacio(item.precio_unit)}</td>
                                                                                <td className="px-4 py-3 text-[12px] text-slate-600">{vacioOValor(item.cantidad)}</td>
                                                                                <td className="px-4 py-3 text-[12px] font-bold text-emerald-600">{montoOVacio(item.precio_total)}</td>
                                                                                <td className="px-4 py-3 text-[12px] text-slate-500">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <span>{item.observacion || '-'}</span>
                                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                                            <button onClick={() => abrirEditarItem(item)} className="text-slate-400 hover:text-[#2563EB]"><Pencil size={14} /></button>
                                                                                            <button onClick={() => void handleEliminarItem(item.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <tr key={item.id} className="bg-blue-50/40">
                                                                            <td colSpan={6} className="px-4 py-4">
                                                                                <div className="flex flex-wrap items-end gap-3">
                                                                                    <div className="min-w-[200px]">
                                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Descripción (Equipo)</label>
                                                                                        <select
                                                                                            value={descripcionEditItem}
                                                                                            onChange={(e) => { setDescripcionEditItem(e.target.value); setCodigoEditItem(''); }}
                                                                                            className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-400 bg-white cursor-pointer"
                                                                                        >
                                                                                            <option value="">Seleccione...</option>
                                                                                            {descripcionesEdit.map(desc => <option key={desc} value={desc}>{desc}</option>)}
                                                                                        </select>
                                                                                    </div>

                                                                                    {descripcionEditItem && (
                                                                                        <div className="min-w-[160px]">
                                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Código</label>
                                                                                            <select
                                                                                                value={codigoEditItem}
                                                                                                onChange={(e) => setCodigoEditItem(e.target.value)}
                                                                                                className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-400 bg-white cursor-pointer font-mono"
                                                                                            >
                                                                                                <option value="">Seleccione...</option>
                                                                                                {codigosDeDescripcionEdit.map(eq => (
                                                                                                    <option key={eq.codigo} value={eq.codigo}>{eq.codigo}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        </div>
                                                                                    )}

                                                                                    {equipoSeleccionadoEdit && (
                                                                                        <>
                                                                                            <div>
                                                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Unit</label>
                                                                                                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700">{montoOVacio(precioUnitEdit.toFixed(2))}</p>
                                                                                            </div>
                                                                                            <div className="w-24">
                                                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cant</label>
                                                                                                <input
                                                                                                    type="number"
                                                                                                    min={0}
                                                                                                    step="0.01"
                                                                                                    value={cantidadEditItem}
                                                                                                    onChange={(e) => setCantidadEditItem(e.target.value)}
                                                                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-400 bg-white"
                                                                                                />
                                                                                            </div>
                                                                                            <div>
                                                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Total</label>
                                                                                                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-emerald-600">{montoOVacio(precioTotalEdit.toFixed(2))}</p>
                                                                                            </div>
                                                                                            <div className="min-w-[160px]">
                                                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Observaciones</label>
                                                                                                <input
                                                                                                    type="text"
                                                                                                    value={observacionEditItem}
                                                                                                    onChange={(e) => setObservacionEditItem(e.target.value)}
                                                                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-400 bg-white"
                                                                                                />
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={() => void handleActualizarItem()}
                                                                                                disabled={!cantidadEditItem || isSavingEditItem}
                                                                                                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                {isSavingEditItem ? <Loader2 size={14} className="animate-spin" /> : null} Listo
                                                                                            </button>
                                                                                        </>
                                                                                    )}

                                                                                    <button
                                                                                        onClick={cancelarEditarItem}
                                                                                        className="px-4 py-2 text-slate-500 hover:text-slate-700 text-[12px] font-medium"
                                                                                    >
                                                                                        Cancelar
                                                                                    </button>
                                                                                </div>
                                                                                {saveEditItemError && (
                                                                                    <p className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 inline-block">{saveEditItemError}</p>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}

                                                                {estaAgregando && (
                                                                    <tr className="bg-emerald-50/40">
                                                                        <td colSpan={6} className="px-4 py-4">
                                                                            <div className="flex flex-wrap items-end gap-3">
                                                                                <div className="min-w-[200px]">
                                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Descripción (Equipo)</label>
                                                                                    <select
                                                                                        value={descripcionNuevoItem}
                                                                                        onChange={(e) => { setDescripcionNuevoItem(e.target.value); setCodigoNuevoItem(''); }}
                                                                                        className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white cursor-pointer"
                                                                                    >
                                                                                        <option value="">Seleccione...</option>
                                                                                        {descripcionesDelGrupoActivo.map(desc => <option key={desc} value={desc}>{desc}</option>)}
                                                                                    </select>
                                                                                </div>

                                                                                {descripcionNuevoItem && (
                                                                                    <div className="min-w-[160px]">
                                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Código</label>
                                                                                        <select
                                                                                            value={codigoNuevoItem}
                                                                                            onChange={(e) => setCodigoNuevoItem(e.target.value)}
                                                                                            className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white cursor-pointer font-mono"
                                                                                        >
                                                                                            <option value="">Seleccione...</option>
                                                                                            {codigosDeDescripcionActiva.map(eq => (
                                                                                                <option key={eq.codigo} value={eq.codigo}>{eq.codigo}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </div>
                                                                                )}

                                                                                {equipoSeleccionado && (
                                                                                    <>
                                                                                        <div>
                                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Unit</label>
                                                                                            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700">{montoOVacio(precioUnitNuevo.toFixed(2))}</p>
                                                                                        </div>
                                                                                        <div className="w-24">
                                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cant</label>
                                                                                            <input
                                                                                                type="number"
                                                                                                min={0}
                                                                                                step="0.01"
                                                                                                value={cantidadNuevoItem}
                                                                                                onChange={(e) => setCantidadNuevoItem(e.target.value)}
                                                                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white"
                                                                                            />
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Total</label>
                                                                                            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-emerald-600">{montoOVacio(precioTotalNuevo.toFixed(2))}</p>
                                                                                        </div>
                                                                                        <div className="min-w-[160px]">
                                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Observaciones</label>
                                                                                            <input
                                                                                                type="text"
                                                                                                value={observacionNuevoItem}
                                                                                                onChange={(e) => setObservacionNuevoItem(e.target.value)}
                                                                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white"
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => void handleGuardarItem()}
                                                                                            disabled={!cantidadNuevoItem || isSavingItem}
                                                                                            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                        >
                                                                                            {isSavingItem ? <Loader2 size={14} className="animate-spin" /> : null} Listo
                                                                                        </button>
                                                                                    </>
                                                                                )}

                                                                                <button
                                                                                    onClick={cancelarFormNuevoItem}
                                                                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 text-[12px] font-medium"
                                                                                >
                                                                                    Cancelar
                                                                                </button>
                                                                            </div>
                                                                            {saveItemError && (
                                                                                <p className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 inline-block">{saveItemError}</p>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex items-center justify-between px-4 py-3 bg-[#001F3F] rounded-xl">
                                            <span className="text-[13px] font-bold text-white uppercase tracking-wider">Total Proyecto</span>
                                            <span className="text-[16px] font-bold text-white">{montoOVacio(totalProyecto.toFixed(2))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-emerald-100 bg-white flex justify-end shrink-0">
                            <button onClick={() => setShowDetailModal(null)} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold shadow-sm transition-all text-[13px]">Cerrar detalle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Precios Urbapark (consolidado de Plantilla_Urbapark para la inversion elegida) */}
            {preciosUrbaparkInversion && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPreciosUrbaparkInversion(null)} />
                    <div className="relative bg-white rounded-2xl w-full max-w-[1200px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-[#F8FAFC] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={20} /></div>
                                <div>
                                    <h3 className="text-[18px] font-bold text-[#1E293B]">Precios Urbapark — {preciosUrbaparkInversion.nombre}</h3>
                                    <p className="text-[12px] text-slate-500">Consolidado de Plantilla Urbapark para esta inversión. Solo Utilidad Interna es editable aquí.</p>
                                </div>
                            </div>
                            <button onClick={() => setPreciosUrbaparkInversion(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {preciosUrbaparkError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {preciosUrbaparkError}
                                </div>
                            )}
                            {guardarUtilidadInternaError && (
                                <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {guardarUtilidadInternaError}
                                </div>
                            )}
                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={() => void descargarExcelPreciosUrbapark()}
                                    disabled={preciosUrbaparkFilas.length === 0}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={14} /> Descargar Excel
                                </button>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-100 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Código</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descripción</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Costo Proveedor $</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Utilidad Interna (%)</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Costo Urbapark</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Costo Urbapark Referencia</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Precio Venta Inversión</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {isLoadingPreciosUrbapark ? (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-slate-400">
                                                        <Loader2 size={18} className="animate-spin mx-auto mb-2" /> Cargando precios Urbapark...
                                                    </td>
                                                </tr>
                                            ) : preciosUrbaparkFilas.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-slate-400">
                                                        No hay datos de Plantilla Urbapark para esta inversión.
                                                    </td>
                                                </tr>
                                            ) : (
                                                preciosUrbaparkFilas.map((fila) => (
                                                    <tr key={fila.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 text-[12px] font-mono text-slate-600">{fila.codigo}</td>
                                                        <td className="px-4 py-3 text-[13px] text-slate-700">{fila.categoria}</td>
                                                        <td className="px-4 py-3 text-[13px] text-slate-700">{fila.proveedor}</td>
                                                        <td className="px-4 py-3 text-[13px] font-medium text-slate-700">{fila.descripcion}</td>
                                                        <td className="px-4 py-3 text-[12px] text-slate-600">{montoOVacio(fila.costo_proveedor_dolares)}</td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                step="0.01"
                                                                value={cambiosUtilidadInterna[fila.equipo_id] ?? String(fila.utilidad_interna ?? 0)}
                                                                onChange={(e) => handleCambiarUtilidadInterna(fila.equipo_id, e.target.value)}
                                                                className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-[12px] text-slate-700 outline-none focus:border-emerald-400 bg-white"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-[12px] text-slate-600">{montoOVacio(fila.costo_urbapark)}</td>
                                                        <td className="px-4 py-3 text-[12px] text-slate-600">{montoOVacio(fila.costo_urbapark_referencia)}</td>
                                                        <td className="px-4 py-3 text-[12px] font-bold text-emerald-600">{montoOVacio(fila.precio_venta_inversion)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex justify-end gap-3 shrink-0">
                            {hayCambiosUtilidadInterna && (
                                <button
                                    onClick={() => setCambiosUtilidadInterna({})}
                                    className="px-6 py-2.5 font-medium text-slate-600 hover:text-slate-800 transition-colors text-[13px]"
                                >
                                    Descartar cambios
                                </button>
                            )}
                            <button onClick={() => setPreciosUrbaparkInversion(null)} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold shadow-sm transition-all text-[13px]">Cerrar</button>
                            {hayCambiosUtilidadInterna && (
                                <button
                                    onClick={() => void handleActualizarValoresUtilidadInterna()}
                                    disabled={isGuardandoUtilidadInterna}
                                    className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold shadow-sm active:scale-95 transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isGuardandoUtilidadInterna ? <Loader2 size={16} className="animate-spin" /> : null} Actualizar valores
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
