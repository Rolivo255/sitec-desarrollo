import type { ReactNode } from 'react';
import {
  AlertCircle,
  Calendar,
  Car,
  Clock,
  Eye,
  FileText,
  Gift,
  Landmark,
  Layers,
  List,
  Loader2,
  PiggyBank,
  Smartphone,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';

interface Rubro {
  id: string;
  titulo: string;
  icon: ReactNode;
  color: 'blue' | 'purple';
  hasDistribuido: boolean;
}

interface SolicitudReciente {
  fecha: string;
  modulo: string;
  estado: string;
  progreso: string;
}

const RUBROS: Rubro[] = [
  { id: 'movilizaciones', titulo: 'Procesar movilizaciones', icon: <Car size={20} />, color: 'blue', hasDistribuido: true },
  { id: 'erol', titulo: 'Procesar E-Rol', icon: <FileText size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'bonos', titulo: 'Procesar bonos', icon: <Gift size={20} />, color: 'blue', hasDistribuido: true },
  { id: 'hipotecarios', titulo: 'Procesar préstamos hipotecarios', icon: <Landmark size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'quirografarios', titulo: 'Procesar préstamos quirografarios', icon: <Landmark size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'celular', titulo: 'Procesar descuento celular', icon: <Smartphone size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'alimentacion', titulo: 'Procesar alimentación', icon: <Utensils size={20} />, color: 'purple', hasDistribuido: true },
  { id: 'fondos', titulo: 'Procesar fondos de reserva', icon: <PiggyBank size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'enfermedad', titulo: 'Procesar subsidio enfermedad', icon: <FileText size={20} />, color: 'purple', hasDistribuido: false },
  { id: 'maternidad', titulo: 'Procesar subsidio maternidad', icon: <FileText size={20} />, color: 'purple', hasDistribuido: false },
  { id: 'multas', titulo: 'Procesar multas por memos', icon: <FileText size={20} />, color: 'purple', hasDistribuido: false },
  { id: 'recaudacion', titulo: 'Procesar faltantes e incidentes de recaudación', icon: <Wallet size={20} />, color: 'purple', hasDistribuido: false },
  { id: 'humana', titulo: 'Procesar Humana', icon: <Users size={20} />, color: 'blue', hasDistribuido: false },
  { id: 'horas', titulo: 'Procesar Registro de Horas', icon: <Clock size={20} />, color: 'blue', hasDistribuido: true },
];

const SOLICITUDES_RECIENTES: SolicitudReciente[] = [
  { fecha: '6/9/2026, 7:36:26 p. m.', modulo: 'Procesar faltantes e incidentes a Nominaz', estado: 'completo', progreso: 'Total: 0 | Enviados: 0 | Incompletos: 0 | Éxitos: 0 | Errores: 0' },
  { fecha: '6/9/2026, 7:31:00 p. m.', modulo: 'Procesar subsidio maternidad a Nominaz', estado: 'completo', progreso: 'Total: 0 | Enviados: 0 | Incompletos: 0 | Éxitos: 0 | Errores: 0' },
  { fecha: '4/9/2026, 5:07:51 p. m.', modulo: 'Procesar multas por memos a Nominaz', estado: 'completo', progreso: 'Total: 2 | Enviados: 2 | Incompletos: 0 | Éxitos: 2 | Errores: 0' },
  { fecha: '4/9/2026, 5:05:11 p. m.', modulo: 'Procesar faltantes e incidentes a Nominaz', estado: 'completo', progreso: 'Total: 0 | Enviados: 0 | Incompletos: 0 | Éxitos: 0 | Errores: 0' },
  { fecha: '4/9/2026, 5:01:53 p. m.', modulo: 'Procesar subsidio enfermedad a Nominaz', estado: 'completo', progreso: 'Total: 1 | Enviados: 1 | Incompletos: 0 | Éxitos: 1 | Errores: 0' },
];

const IconoNominaz = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
  </svg>
);

const ProcesamientoNominazView = () => {
  return (
    <div className="space-y-6 fade-up max-w-[1200px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-4">
          <div className="text-blue-500 mt-1"><Landmark size={28} strokeWidth={1.5} /></div>
          <div>
            <h2 className="text-[22px] font-medium text-slate-800 leading-tight">Procesamiento hacia Nominaz</h2>
            <p className="text-[13px] text-slate-500 mt-2 max-w-4xl leading-relaxed">
              Este módulo le permite enviar solicitudes de procesamiento de registros del sistema SITEC-DSP al sistema de nómina Nominaz. El procesamiento de los registros se realiza de manera asíncrona, por lo que puede tardar algunos minutos en completarse.
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-[#001F3F] font-bold flex items-center gap-2 mb-2 text-sm">
          <AlertCircle size={16} className="text-blue-500" /> Información del periodo a ser procesado en las solicitudes
        </h3>
        <p className="text-[12px] text-slate-600 ml-6">
          Los rubros de RRHH a procesar de manera General y Distribuido correspondientes al periodo 2026-09
        </p>
      </div>

      {/* Processing List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100 mb-8">
        {RUBROS.map((rubro) => (
          <div key={rubro.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0
                  ${rubro.color === 'purple' ? 'border-purple-200 bg-purple-50 text-purple-500' : 'border-blue-200 bg-blue-50 text-blue-500'}
                `}
              >
                {rubro.icon}
              </div>
              <h4 className={`text-[14px] font-medium ${rubro.color === 'purple' ? 'text-purple-600' : 'text-[#004E7C]'}`}>
                {rubro.titulo}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[12px] font-semibold hover:bg-emerald-100 transition-colors" title="Procesar General">
                <IconoNominaz />
                Procesar General
              </button>
              {rubro.hasDistribuido && (
                <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#004E7C] text-white text-[12px] font-semibold hover:bg-[#003b5e] transition-colors" title="Procesar Distribuido">
                  <IconoNominaz />
                  Procesar Distribuido
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Global Action Buttons */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#004E7C] text-white font-medium text-[13px] hover:bg-[#003b5e] transition-colors shadow-sm">
            <IconoNominaz />
            Procesar/Reprocesar General
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#004E7C] text-white font-medium text-[13px] hover:bg-[#003b5e] transition-colors shadow-sm">
            <List size={16} strokeWidth={2.5} />
            Procesar Distribuido General
          </button>
        </div>
      </div>

      {/* Solicitudes Recientes Section */}
      <div>
        <h3 className="text-xl font-bold text-[#001F3F] mb-1">Solicitudes recientes</h3>
        <p className="text-[12px] text-slate-500 mb-4">Se muestran las 30 solicitudes más recientes.</p>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><div className="flex items-center gap-2"><Calendar size={14} /> SOLICITUD</div></th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><div className="flex items-center gap-2"><Layers size={14} /> SUBMÓDULO</div></th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><div className="flex items-center gap-2"><Loader2 size={14} /> ESTADO</div></th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><div className="flex items-center gap-2"><List size={14} /> PROGRESO</div></th>
                  <th className="px-6 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SOLICITUDES_RECIENTES.map((sol, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-[12px] text-slate-600">{sol.fecha}</td>
                    <td className="px-6 py-4 text-[12px] text-slate-700 font-medium">{sol.modulo}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold">
                        {sol.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[12px] text-slate-600">{sol.progreso}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-1.5 border border-blue-200 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors">
                        <Eye size={16} />
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
  );
};

export default ProcesamientoNominazView;
