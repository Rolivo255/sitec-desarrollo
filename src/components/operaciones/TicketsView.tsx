import { useEffect, useRef, useState } from "react";
import { ChevronDown, Ticket, Building, Filter, Calendar, MoreVertical, Car, Image as Loader2, History, LayoutList } from 'lucide-react';
import { INITIAL_TICKETS_DATA, JUSTIFICATION_GROUPS } from "../../data/mockData";
import { JustificationModal } from "../modals/JustificationModal";
import { HistoryDetailModal } from "../modals/HistoryDetailModal";
import { getNominaCostCenters } from "../../services/n8nApi";

type TicketItem = (typeof INITIAL_TICKETS_DATA)[number] & {
  justificationData?: {
    justificationType?: string;
    selectedGroup?: string;
    selectedReason?: string;
    exitEquipment?: string;
    additionalComments?: string;
  };
};

const PhotoPlaceholder = () => (
  <div className="w-16 h-12 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
    <Loader2 size={20} />
  </div>
);

const TicketsView = () => {
  const [searchFilters, setSearchFilters] = useState({ park: '', dateFrom: '', dateTo: '', type: '' });
  const [justifyingTicket, setJustifyingTicket] = useState<TicketItem | null>(null);
  const [detailsTicket, setDetailsTicket] = useState<TicketItem | null>(null);
  const [isIgorMode, setIsIgorMode] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'gestion' | 'historial'>('gestion');
  const [historyGroupFilter, setHistoryGroupFilter] = useState('Todos');
  const [parkingLots, setParkingLots] = useState<string[]>([]);
  const [isLoadingParks, setIsLoadingParks] = useState(false);
  const loadingTimerRef = useRef<number | null>(null);

  // Cargar Parqueaderos desde la API n8n
  useEffect(() => {
    const loadParkingLots = async () => {
      setIsLoadingParks(true);
      try {
        const centros = await getNominaCostCenters();
        const lots = centros.map(c => c.CENTROCOSTO).filter(Boolean);
        setParkingLots(lots.length > 0 ? lots : ["Parqueadero Central", "Parqueadero Sur", "Parqueadero Norte", "Parqueadero Este"]);
      } catch (error) {
        console.error("Error cargando parqueaderos:", error);
        setParkingLots(["Parqueadero Central", "Parqueadero Sur", "Parqueadero Norte", "Parqueadero Este"]);
      } finally {
        setIsLoadingParks(false);
      }
    };
    loadParkingLots();
  }, []);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  const applyFilters = (nextFilters: typeof searchFilters) => {
    setSearchFilters(nextFilters);

    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current);
    }

    const areFiltersComplete = Boolean(nextFilters.park && nextFilters.dateFrom && nextFilters.dateTo && nextFilters.type);
    if (!areFiltersComplete) {
      setTickets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setTickets([]);
    loadingTimerRef.current = window.setTimeout(() => {
      setTickets(INITIAL_TICKETS_DATA as TicketItem[]);
      setIsLoading(false);
    }, 800);
  };

  const handleTicketUpdate = (id: string, justificationData: TicketItem['justificationData']) => {
    setTickets((currentTickets) =>
      currentTickets.map((t) =>
        t.id === id
          ? {
              ...t,
              estado: 'Justificado',
              justificationData,
            }
          : t,
      ),
    );
  };

  const handleTypeChange = (type: string) => {
    applyFilters({ ...searchFilters, type });
    setIsIgorMode(type === 'igor');
  };

  const getStatusColor = (estado: string) => {
    if (['Abierto', 'Entrada', 'Pagado', 'Validado'].includes(estado)) {
      return 'bg-red-50 text-red-600 border-red-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getStatusDotColor = (estado: string) => {
    if (['Abierto', 'Entrada', 'Pagado', 'Validado'].includes(estado)) {
      return 'bg-red-500';
    }
    return 'bg-slate-500';
  };

  const justifiedTickets = tickets.filter((t) => {
    if (t.estado !== 'Justificado') return false;
    if (historyGroupFilter === 'Todos') return true;
    return t.justificationData?.selectedGroup === historyGroupFilter;
  });

  const openTickets = tickets.filter((t) => t.estado !== 'Justificado');

  return (
    <div className="relative">
      {justifyingTicket && (
        <JustificationModal
          ticket={justifyingTicket}
          onClose={() => setJustifyingTicket(null)}
          onSave={handleTicketUpdate}
        />
      )}

      {detailsTicket && (
        <HistoryDetailModal ticket={detailsTicket} onClose={() => setDetailsTicket(null)} />
      )}

      <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Parqueadero</label>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
                value={searchFilters.park}
                onChange={(e) => applyFilters({ ...searchFilters, park: e.target.value })}
                disabled={isLoadingParks}
              >
                <option value="">Seleccione...</option>
                {parkingLots.map((lot, index) => (
                  <option key={index} value={lot}>{lot}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
            {isLoadingParks && <p className="text-xs text-blue-600 mt-1">Cargando parqueaderos desde sistema...</p>}
          </div>

          <div className="w-full md:w-auto flex gap-2">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Desde</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
                  value={searchFilters.dateFrom}
                  onChange={(e) => applyFilters({ ...searchFilters, dateFrom: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Hasta</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
                  value={searchFilters.dateTo}
                  onChange={(e) => applyFilters({ ...searchFilters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="w-full md:w-64">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tipo de Ticket</label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
                value={searchFilters.type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="" disabled>Seleccione tipo...</option>
                <option value="normal">Tickets Normales</option>
                <option value="igor">Tickets IGOR</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 mb-6 border-b border-slate-200 pb-2">
          <button onClick={() => setViewMode('gestion')} className={`px-4 py-2 text-sm font-bold transition-all relative ${viewMode === 'gestion' ? 'text-[#001F3F]' : 'text-slate-400 hover:text-slate-600'}`}>
            <div className="flex items-center gap-2"><LayoutList size={16} />Gestión de tickets</div>
            {viewMode === 'gestion' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FFCC00]"></div>}
          </button>
          <button onClick={() => setViewMode('historial')} className={`px-4 py-2 text-sm font-bold transition-all relative ${viewMode === 'historial' ? 'text-[#001F3F]' : 'text-slate-400 hover:text-slate-600'}`}>
            <div className="flex items-center gap-2"><History size={16} />Historial de Tickets</div>
            {viewMode === 'historial' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FFCC00]"></div>}
          </button>
        </div>

        {viewMode === 'gestion' ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[400px]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Ticket className="text-[#001F3F]" size={24} />
                {isIgorMode ? 'Tickets Abiertos - IGOR' : 'Tickets Abiertos'}
              </h2>
              {(searchFilters.park || (searchFilters.dateFrom && searchFilters.dateTo)) && (
                <p className="text-sm text-slate-500 font-medium mt-1 ml-8 animate-in fade-in">
                  {searchFilters.park || 'Parqueadero no seleccionado'} • {searchFilters.dateFrom && searchFilters.dateTo ? `${searchFilters.dateFrom} - ${searchFilters.dateTo}` : 'Rango de fechas incompleto'}
                </p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Número de Ticket</th>
                    <th className="px-6 py-4 whitespace-nowrap">Equipo de Entrada</th>
                    <th className="px-6 py-4 whitespace-nowrap">Fecha</th>
                    <th className="px-6 py-4 whitespace-nowrap">Matrícula</th>
                    <th className="px-6 py-4 whitespace-nowrap">LPR</th>
                    <th className="px-6 py-4 whitespace-nowrap">Foto Perimetral</th>
                    <th className="px-6 py-4 whitespace-nowrap">Estado</th>
                    <th className="px-6 py-4 whitespace-nowrap">Equipo Estado</th>
                    <th className="px-6 py-4 whitespace-nowrap">Fecha Estado</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 size={32} className="animate-spin text-[#001F3F]" />
                          <span className="text-sm font-medium text-slate-500">Cargando tickets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : openTickets.length > 0 ? (
                    openTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-[#FFFDF5] transition-colors group">
                        <td className="px-6 py-4 font-mono text-sm font-bold text-[#001F3F]">{ticket.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">{ticket.equipo}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{ticket.fecha}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200"><Car size={14} className="text-slate-400" /><span className="text-sm font-bold text-slate-700 font-mono tracking-wide">{ticket.matricula}</span></div>
                        </td>
                        <td className="px-6 py-4"><PhotoPlaceholder /></td>
                        <td className="px-6 py-4"><PhotoPlaceholder /></td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.estado)}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(ticket.estado)}`}></div>
                            {ticket.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{ticket.equipo_estado}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{ticket.fecha_estado}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setJustifyingTicket(ticket)} className="p-2 text-slate-400 hover:text-[#001F3F] hover:bg-slate-100 rounded-lg transition-colors" title="Agregar justificación">
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Filter size={32} className="text-slate-300" />
                          <p>Seleccione todos los filtros para ver los tickets.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && openTickets.length > 0 && <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center"><span className="text-xs font-medium text-slate-400">Mostrando {openTickets.length} resultados</span></div>}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[400px]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <History className="text-[#001F3F]" size={24} />
                Historial de Justificaciones
              </h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <select
                    className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-700 cursor-pointer appearance-none shadow-sm"
                    value={historyGroupFilter}
                    onChange={(e) => setHistoryGroupFilter(e.target.value)}
                  >
                    <option value="Todos">Todos los grupos</option>
                    {Object.keys(JUSTIFICATION_GROUPS).map((group, index) => (
                      <option key={index} value={group}>{group}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Número de Ticket</th>
                    <th className="px-6 py-4">Equipo de Entrada</th>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Matrícula</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">LPR</th>
                    <th className="px-6 py-4">Foto Perimetral</th>
                    <th className="px-6 py-4 text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {justifiedTickets.length > 0 ? (
                    justifiedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm font-bold text-[#001F3F]">{ticket.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{ticket.equipo}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{ticket.fecha}</td>
                        <td className="px-6 py-4"><span className="font-bold text-slate-700 font-mono">{ticket.matricula}</span></td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">{ticket.justificationData?.selectedReason || '-'}</td>
                        <td className="px-6 py-4">
                          {ticket.justificationData?.justificationType === 'no_justificada' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                              No Justificado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                              Justificado
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4"><PhotoPlaceholder /></td>
                        <td className="px-6 py-4"><PhotoPlaceholder /></td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setDetailsTicket(ticket)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mx-auto"
                            title="Ver Detalle"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                        No hay tickets justificados en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsView;