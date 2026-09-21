import { useState } from 'react';
import ExcelJS from 'exceljs';
import {
    AlertTriangle,
    Building,
    ChevronLeft,
    ChevronRight,
    Download,
    Loader2,
    Search,
} from 'lucide-react';
import type { ReporteRecaudacionDetalleItem } from '../../services/n8nApi';

interface ResultadoLiquidacion {
    fechaRegistro: string;
    parqueadero: string;
    centroCosto: string;
    totalDeposito: string;
    totalTransferencia: string;
    banco: string;
    comprobante: string;
    documento: string;
    montoBanco: string;
    fechaDeposito: string;
    codBanco: string;
    concepto: string;
    tipo: string;
    oficinaDep: string;
    numCuenta: string;
}

const formatearFechaSoloDia = (valor?: string | null): string => {
    if (!valor) return '';
    return valor.includes('T') ? valor.split('T')[0] : valor;
};

const formatearMontoBanco = (valor?: number | string | null): string => {
    if (valor === undefined || valor === null || valor === '') return '';
    const numero = typeof valor === 'number' ? valor : Number(valor);
    return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : String(valor);
};

const textoOVacio = (valor?: string | null): string => (valor ?? '').toString().trim();

const FILAS_POR_PAGINA = 30;

interface DetalleBusquedaViewProps {
    titulo: string;
    fetchDetalle: (trOtro: string, fechaReporte: string) => Promise<ReporteRecaudacionDetalleItem[]>;
}

export default function DetalleBusquedaView({ titulo, fetchDetalle }: DetalleBusquedaViewProps) {
    const [fecha, setFecha] = useState('');
    const [centroCosto, setCentroCosto] = useState('');
    const [showResultados, setShowResultados] = useState(false);
    const [resultados, setResultados] = useState<ResultadoLiquidacion[]>([]);
    const [isBuscando, setIsBuscando] = useState(false);
    const [buscarError, setBuscarError] = useState('');
    const [pagina, setPagina] = useState(1);

    const handleBuscar = async () => {
        if (!fecha) return;

        setIsBuscando(true);
        setBuscarError('');

        try {
            const items = await fetchDetalle(centroCosto.trim(), fecha);
            setResultados(items.filter(Boolean).map((item) => ({
                fechaRegistro: formatearFechaSoloDia(item?.fecha_registro),
                parqueadero: textoOVacio(item?.parqueadero),
                centroCosto: textoOVacio(item?.centro_costo),
                totalDeposito: textoOVacio(item?.total_deposito),
                totalTransferencia: textoOVacio(item?.total_transferencia),
                banco: textoOVacio(item?.banco),
                comprobante: textoOVacio(item?.comprobante),
                documento: textoOVacio(item?.documento),
                montoBanco: formatearMontoBanco(item?.monto),
                fechaDeposito: formatearFechaSoloDia(item?.fecha),
                codBanco: textoOVacio(item?.codigo),
                concepto: textoOVacio(item?.concepto),
                tipo: textoOVacio(item?.tipo),
                oficinaDep: textoOVacio(item?.oficina),
                numCuenta: textoOVacio(item?.num_cuenta),
            })));
            setPagina(1);
            setShowResultados(true);
        } catch (error) {
            setBuscarError(error instanceof Error ? error.message : 'No se pudo obtener el reporte.');
            setResultados([]);
            setShowResultados(false);
        } finally {
            setIsBuscando(false);
        }
    };

    const descargarReporte = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(titulo);

        worksheet.columns = [
            { header: 'FECHA REGISTRO', key: 'fechaRegistro', width: 16 },
            { header: 'PARQUEADERO', key: 'parqueadero', width: 26 },
            { header: 'CENTRO DE COSTO', key: 'centroCosto', width: 18 },
            { header: 'TOTAL DEPÓSITO', key: 'totalDeposito', width: 16 },
            { header: 'TOTAL TRANSFERENCIA', key: 'totalTransferencia', width: 18 },
            { header: 'BANCO', key: 'banco', width: 22 },
            { header: 'COMPROBANTE', key: 'comprobante', width: 16 },
            { header: 'DOCUMENTO', key: 'documento', width: 16 },
            { header: 'MONTO BANCO', key: 'montoBanco', width: 14 },
            { header: 'FECHA DEPÓSITO', key: 'fechaDeposito', width: 16 },
            { header: 'COD BANCO', key: 'codBanco', width: 12 },
            { header: 'CONCEPTO', key: 'concepto', width: 20 },
            { header: 'TIPO', key: 'tipo', width: 10 },
            { header: 'OFICINA DEP', key: 'oficinaDep', width: 18 },
            { header: 'NUM CUENTA', key: 'numCuenta', width: 16 },
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        headerRow.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        resultados.forEach((res) => {
            const row = worksheet.addRow(res);
            row.eachCell((cell) => {
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        const centroCostoArchivo = centroCosto.trim() ? `_${centroCosto.trim()}` : '';
        const tituloArchivo = titulo.replace(/\s+/g, '_');
        const fileName = `Reporte_${tituloArchivo}_${fecha}${centroCostoArchivo}.xlsx`;
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

    const totalPaginas = Math.max(1, Math.ceil(resultados.length / FILAS_POR_PAGINA));
    const resultadosPagina = resultados.slice(
        (pagina - 1) * FILAS_POR_PAGINA,
        pagina * FILAS_POR_PAGINA
    );

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px] flex flex-col">
            <div className="flex flex-wrap items-end gap-5 mb-6 pb-6 border-b border-slate-100">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                        <span className="text-red-500">*</span> FECHA OBLIGATORIA
                    </label>
                    <input
                        type="date"
                        value={fecha}
                        onChange={e => { setFecha(e.target.value); setShowResultados(false); setBuscarError(''); }}
                        className="appearance-none px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer bg-white min-w-[160px] transition-all"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">CENTRO DE COSTO</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Ejm: 02306327"
                            value={centroCosto}
                            onChange={e => { setCentroCosto(e.target.value); setShowResultados(false); setBuscarError(''); }}
                            className="appearance-none px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white min-w-[200px] transition-all placeholder:text-slate-300"
                        />
                        <Building className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                    </div>
                </div>
                <button
                    onClick={handleBuscar}
                    disabled={!fecha || isBuscando}
                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all h-[42px]
                        ${fecha && !isBuscando ? 'bg-[#004E7C] text-white hover:bg-[#003b5e] shadow-sm hover:shadow active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                    {isBuscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
                </button>
            </div>

            {isBuscando ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                    <Loader2 size={32} className="animate-spin text-slate-300 mb-4" />
                    <p className="text-[14px] font-medium text-slate-500">Consultando el reporte...</p>
                </div>
            ) : buscarError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-red-500 py-16">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5 border border-red-100">
                        <AlertTriangle size={32} className="text-red-400" />
                    </div>
                    <h3 className="text-[18px] font-bold text-red-600 mb-1">No se pudo obtener el reporte</h3>
                    <p className="text-[13px] text-red-500 max-w-md text-center">{buscarError}</p>
                </div>
            ) : showResultados ? (
                resultados.length > 0 ? (
                    <>
                    <div className="flex justify-end mb-3">
                        <button
                            onClick={() => void descargarReporte()}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#10B981] text-white text-[13px] font-bold hover:bg-emerald-600 shadow-sm transition-colors"
                        >
                            <Download size={16} /> Descargar Reporte
                        </button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#F8FAFC] border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">FECHA REGISTRO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">PARQUEADERO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CENTRO DE COSTO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">TOTAL DEPÓSITO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">TOTAL TRANSFERENCIA</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">BANCO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">COMPROBANTE</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DOCUMENTO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">MONTO BANCO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">FECHA DEPÓSITO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">COD BANCO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CONCEPTO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">TIPO</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">OFICINA DEP</th>
                                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">NUM CUENTA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resultadosPagina.map((res, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.fechaRegistro}</td>
                                        <td className="px-5 py-4 text-[13px] font-bold text-slate-700">{res.parqueadero}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-500 font-mono">{res.centroCosto}</td>
                                        <td className="px-5 py-4 text-[13px] font-bold text-[#10B981] bg-emerald-50/50">{res.totalDeposito}</td>
                                        <td className="px-5 py-4 text-[13px] font-bold text-slate-700">{res.totalTransferencia}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.banco}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-500 font-mono bg-slate-50/50">{res.comprobante}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-500 font-mono">{res.documento}</td>
                                        <td className="px-5 py-4 text-[13px] font-bold text-slate-700">{res.montoBanco}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.fechaDeposito}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-500 font-mono">{res.codBanco}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.concepto}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.tipo}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-600">{res.oficinaDep}</td>
                                        <td className="px-5 py-4 text-[13px] text-slate-500 font-mono">{res.numCuenta}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalPaginas > 1 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-[#F8FAFC]">
                                <span className="text-[12px] text-slate-500">
                                    Mostrando <span className="font-bold text-slate-700">{(pagina - 1) * FILAS_POR_PAGINA + 1}-{Math.min(pagina * FILAS_POR_PAGINA, resultados.length)}</span> de <span className="font-bold text-slate-700">{resultados.length}</span> registros — hoja {pagina} de {totalPaginas}
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
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
                            <Search size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-[18px] font-bold text-slate-700 mb-1">Sin resultados</h3>
                        <p className="text-[14px] font-medium text-slate-500">No se encontraron registros para los filtros aplicados.</p>
                    </div>
                )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
                        <Search size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-[18px] font-bold text-slate-700 mb-1">Esperando búsqueda</h3>
                    <p className="text-[14px] font-medium text-slate-500">Ingrese la fecha obligatoria y presione "Buscar"</p>
                    <p className="text-[12px] text-slate-400 mt-2 max-w-md text-center">Podrá visualizar el detalle según los filtros de fecha y centro de costo aplicados.</p>
                </div>
            )}
        </div>
    );
}
