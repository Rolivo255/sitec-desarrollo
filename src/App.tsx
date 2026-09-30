import { lazy, Suspense, useEffect, useState } from 'react';
import { Menu, ChevronDown, ChevronRight, LogOut, Cpu, Wallet, Wrench, Users, BarChart3, Network, Key, Loader2, Briefcase } from 'lucide-react';
import { Placeholder } from "./components/commons/Placeholder";
import LucidBotWebchat from "./components/LucidBotWebchat";
import LoginView from "./components/auth/LoginView";
import { useAuth } from "./contexts/useAuth";

const TicketsView = lazy(() => import("./components/operaciones/TicketsView"));
const PagosView = lazy(() => import("./components/pagos/PagosView"));
const HumanaView = lazy(() => import("./components/nomina/HumanaView"));
const GestionDescuentosTabsView = lazy(() => import("./components/nomina/GestionDescuentosTabsView"));
const ValetsFijosView = lazy(() => import("./components/nomina/ValetsFijosView"));
const ConfiguracionDistribucionView = lazy(() => import("./components/nomina/ConfiguracionDistribucionView.tsx"));
const DistribucionFacturaView = lazy(() => import("./components/nomina/DistribucionFacturaView.tsx"));
const ProcesamientoNominazView = lazy(() => import("./components/nomina/ProcesamientoNominazView"));
const BancosView = lazy(() => import("./components/pagos/BancosView"));
const SolicitudAccesoriosTabsView = lazy(() => import("./components/mantenimiento/SolicitudAccesoriosTabsView"));
const PyGView = lazy(() => import("./components/contabilidad/PyGView"));
const RecaudacionView = lazy(() => import("./components/contabilidad/RecaudacionView"));
const LiquidacionBancosView = lazy(() => import("./components/contabilidad/LiquidacionBancosView"));
const PlantillaProveedorView = lazy(() => import("./components/proyectos/PlantillaProveedorView"));
const InversionesProyectosView = lazy(() => import("./components/proyectos/InversionesView"));

interface PlaceholderContent {
  title: string;
  description: string;
}

const PLACEHOLDER_TABS: Record<string, PlaceholderContent> = {
  matriculas: { title: 'Matriculas', description: 'Gestion de matriculas de vehiculos' },
  bicicletas: { title: 'Bicicletas', description: 'Sistema de bikes compartidas' },
  ocupacion: { title: 'Ocupacion', description: 'Estado de ocupacion de parqueaderos' },
  boletas: { title: 'Boletas', description: 'Gestion de boletas de estacionamiento' },
  facturas: { title: 'Facturas', description: 'Emision y seguimiento de facturas' },
  niubiz: { title: 'Niubiz', description: 'Integracion de pagos Niubiz' },
  agora: { title: 'Agora', description: 'Gestion de pasarela Agora' },
  izipay: { title: 'Izipay', description: 'Integracion de pagos Izipay' },
  movilizaciones: { title: 'Movilizaciones', description: 'Asignacion de movilizacion a empleados' },
  erol: { title: 'EROL', description: 'Gestion de riesgos laborales' },
  bonos: { title: 'Bonos', description: 'Asignacion de bonos y gratificaciones' },
  prestamos: { title: 'Prestamos', description: 'Gestion de prestamos a empleados' },
  celular: { title: 'Celular', description: 'Control de lineas telefonicas' },
  alimentacion: { title: 'Alimentacion', description: 'Subsidio de alimentacion' },
  fondos: { title: 'Fondos', description: 'Gestion de fondos de solidaridad' },
  horas: { title: 'Horas', description: 'Gestion de horas extraordinarias' },
  contab_general: { title: 'Contabilidad General', description: 'Registro de asientos contables' },
  contab_reportes: { title: 'Reportes Contables', description: 'Generacion de reportes financieros' },
  api_meypar: { title: 'Integracion Meypar', description: 'Sincronizacion con plataforma Meypar' },
  api_tgw: { title: 'Integracion TGW', description: 'Gateway de pagos TGW' },
  api_matricula_error: { title: 'API Matricula Error', description: 'Gestion de incidencias de matricula' },
  api_proceso_reverso: { title: 'API Proceso Reverso', description: 'Ejecucion de reversos automaticos' },
  mant_plantilla: { title: 'Plantilla de Mantenimiento', description: 'Plantillas de ordenes de trabajo' },
  mant_tecnicos: { title: 'Tecnicos', description: 'Gestion de tecnicos de mantenimiento' },
  mant_parqueaderos: { title: 'Parqueaderos', description: 'Gestion de espacios de estacionamiento' },
  mant_planificacion: { title: 'Planificacion y Gestion', description: 'Planificacion de mantenimiento' },
  solicitud_accesorios: { title: 'Solicitud Accesorios', description: 'Gestion de solicitudes de accesorios y repuestos' },
};

interface MenuState {
  operaciones: boolean;
  contabilidad: boolean;
  nomina: boolean;
  desarrollo: boolean;
  pagos_facturacion: boolean;
  integraciones: boolean;
  mantenimiento: boolean;
  proyectos: boolean;
}

function App() {
  const { session, isLoading, isPasswordRecovery, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });
  const [activeTab, setActiveTab] = useState('tickets');
  const [expandedMenus, setExpandedMenus] = useState<MenuState>({
    operaciones: false,
    contabilidad: false,
    nomina: true,
    desarrollo: false,
    pagos_facturacion: false,
    integraciones: false,
    mantenimiento: false,
    proyectos: false
  });

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleMenu = (menuId: keyof MenuState) =>
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#2173B9]" />
      </div>
    );
  }

  if (!session || isPasswordRecovery) {
    return <LoginView />;
  }

  const isItemActive = (id: string) => activeTab === id;
  const esTabDescuentos = activeTab === 'descuentos';
  const esTabConfiguracionDistribucion = activeTab === 'configuracion_distribucion';
  const esTabDistribucionFactura = activeTab === 'distribucion_factura';

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'tickets':
        return <TicketsView />;
      case 'pagos':
        return <PagosView />;
      case 'bancos':
        return <BancosView />;
      case 'pyg':
        return <PyGView />;
      case 'recaudacion':
        return <RecaudacionView />;
      case 'liquidacion_bancos':
        return <LiquidacionBancosView />;
      case 'descuentos':
        return <GestionDescuentosTabsView />;
      case 'valets_fijos':
        return <ValetsFijosView />;
      case 'humana':
        return <HumanaView />;
      case 'procesamiento_nominaz':
        return <ProcesamientoNominazView />;
      case 'configuracion_distribucion':
        return <ConfiguracionDistribucionView />;
      case 'distribucion_factura':
        return <DistribucionFacturaView />;
      case 'solicitud_accesorios':
        return <SolicitudAccesoriosTabsView />;
      case 'plantilla_proveedor':
        return <PlantillaProveedorView />;
      case 'inversion_proyectos':
        return <InversionesProyectosView />;
      default: {
        const placeholder = PLACEHOLDER_TABS[activeTab];
        if (placeholder) {
          return <Placeholder title={placeholder.title} description={placeholder.description} />;
        }

        return <Placeholder title="Modulo en construccion" description="Esta opcion aun no tiene una vista disponible." />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-800">
      <LucidBotWebchat />
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 text-slate-600 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col overflow-hidden`}>
        {/* LOGO */}
        <div className="p-8 pb-4 flex items-center justify-start flex-shrink-0 cursor-pointer" onClick={() => setActiveTab('tickets')}>
          <div className="flex items-center gap-2 text-orange-500">
            <Cpu size={32} strokeWidth={2.5} />
            <span className="text-[32px] leading-none font-medium tracking-wide text-[#2173B9] uppercase">SITEC</span>
          </div>
        </div>

        {/* SELECTOR DE EMPRESA */}
        <div className="px-8 pb-6">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-bold text-slate-700">Urbapark</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-6 tracking-wider">SERVICIOS</p>
        </div>

        {/* NAVEGACION */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {/* PAGOS Y FACTURACION */}
          <div>
            <button onClick={() => toggleMenu('pagos_facturacion')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Wallet size={20} /><span className="text-sm font-medium">Pagos y Facturación</span></div>
              {expandedMenus.pagos_facturacion ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.pagos_facturacion && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('pagos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('pagos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Pagos</button>
                <button onClick={() => setActiveTab('boletas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('boletas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>TCI boletas</button>
                <button onClick={() => setActiveTab('facturas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('facturas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>TCI facturas</button>
                <button onClick={() => setActiveTab('niubiz')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('niubiz') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Niubiz</button>
                <button onClick={() => setActiveTab('agora')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('agora') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Ágora</button>
                <button onClick={() => setActiveTab('izipay')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('izipay') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Izipay</button>
              </div>
            )}
          </div>

          {/* OPERACIONES */}
          <div>
            <button onClick={() => toggleMenu('operaciones')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-[20px] h-[20px] border-2 border-current rounded-full flex items-center justify-center text-[10px] font-bold">P</div>
                <span className="text-sm font-medium">Op. de Parqueaderos</span>
              </div>
              {expandedMenus.operaciones ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.operaciones && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('matriculas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('matriculas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de matrículas</button>
                <button onClick={() => setActiveTab('bicicletas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('bicicletas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de bicicletas</button>
                <button onClick={() => setActiveTab('pagos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('pagos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de pagos</button>
                <button onClick={() => setActiveTab('ocupacion')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('ocupacion') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de ocupación</button>
                <button onClick={() => setActiveTab('tickets')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('tickets') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de tickets abiertos</button>
              </div>
            )}
          </div>

          {/* MANTENIMIENTO */}
          <div>
            <button onClick={() => toggleMenu('mantenimiento')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Wrench size={20} /><span className="text-sm font-medium">Mantenimiento</span></div>
              {expandedMenus.mantenimiento ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.mantenimiento && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('mant_plantilla')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('mant_plantilla') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Plantilla de equipos</button>
                <button onClick={() => setActiveTab('mant_tecnicos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('mant_tecnicos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Técnicos</button>
                <button onClick={() => setActiveTab('mant_parqueaderos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('mant_parqueaderos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Parqueaderos</button>
                <button onClick={() => setActiveTab('mant_planificacion')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('mant_planificacion') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Planificación y gestión</button>
              </div>
            )}
          </div>

          {/* PROYECTOS */}
          <div>
            <button onClick={() => toggleMenu('proyectos')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Briefcase size={20} /><span className="text-sm font-medium">Proyectos</span></div>
              {expandedMenus.proyectos ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.proyectos && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('plantilla_proveedor')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('plantilla_proveedor') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Plantilla Proveedor</button>
                <button onClick={() => setActiveTab('inversion_proyectos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('inversion_proyectos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Inversión</button>
              </div>
            )}
          </div>

          {/* NOMINA */}
          <div>
            <button onClick={() => toggleMenu('nomina')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Users size={20} /><span className="text-sm font-medium">Gestión de Personal</span></div>
              {expandedMenus.nomina ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.nomina && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('movilizaciones')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('movilizaciones') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Movilizaciones</button>
                <button onClick={() => setActiveTab('erol')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('erol') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>E-Rol</button>
                <button onClick={() => setActiveTab('bonos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('bonos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Bono eventos</button>
                <button onClick={() => setActiveTab('prestamos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('prestamos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Préstamos</button>
                <button onClick={() => setActiveTab('celular')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('celular') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Descuento celular</button>
                <button onClick={() => setActiveTab('alimentacion')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('alimentacion') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Alimentación</button>
                <button onClick={() => setActiveTab('fondos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('fondos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Fondos de reserva</button>
                <button onClick={() => setActiveTab('descuentos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('descuentos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Gestión de descuentos</button>
                <button onClick={() => setActiveTab('valets_fijos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('valets_fijos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Valets fijos</button>
                <button onClick={() => setActiveTab('configuracion_distribucion')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('configuracion_distribucion') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Detalle de distribución</button>
                <button onClick={() => setActiveTab('horas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('horas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Registro de horas</button>
                <button onClick={() => setActiveTab('humana')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('humana') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Humana</button>
                <button onClick={() => setActiveTab('solicitud_accesorios')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('solicitud_accesorios') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Solicitud Accesorios</button>
                <button onClick={() => setActiveTab('procesamiento_nominaz')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('procesamiento_nominaz') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Procesamiento a Nominaz</button>
              </div>
            )}
          </div>

          {/* DESARROLLO */}
          <div>
            <button onClick={() => toggleMenu('desarrollo')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Cpu size={20} /><span className="text-sm font-medium">Desarrollo</span></div>
              {expandedMenus.desarrollo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.desarrollo && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('distribucion_factura')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('distribucion_factura') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Distribución por factura</button>
              </div>
            )}
          </div>

          {/* CONTABILIDAD */}
          <div>
            <button onClick={() => toggleMenu('contabilidad')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><BarChart3 size={20} /><span className="text-sm font-medium">Contabilidad y Finanzas</span></div>
              {expandedMenus.contabilidad ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.contabilidad && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('pyg')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('pyg') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Pérdidas y Ganancias</button>
                <button onClick={() => setActiveTab('bancos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('bancos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Bancos</button>
                <button onClick={() => setActiveTab('presupuestos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('presupuestos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Presupuestos</button>
                <button onClick={() => setActiveTab('cajas_chicas')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('cajas_chicas') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Cajas Chicas</button>
                <button onClick={() => setActiveTab('recaudacion')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('recaudacion') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Recaudación</button>
                <button onClick={() => setActiveTab('liquidacion_bancos')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('liquidacion_bancos') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Liquidación Bancos</button>
              </div>
            )}
          </div>

          {/* INTEGRACIONES */}
          <div>
            <button onClick={() => toggleMenu('integraciones')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <div className="flex items-center gap-3"><Network size={20} /><span className="text-sm font-medium">Integraciones & APIs</span></div>
              {expandedMenus.integraciones ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedMenus.integraciones && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1 mt-1 mb-2">
                <button onClick={() => setActiveTab('api_meypar')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('api_meypar') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Apis Meypar</button>
                <button onClick={() => setActiveTab('api_tgw')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('api_tgw') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Apis TGW</button>
                <button onClick={() => setActiveTab('api_matricula_error')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('api_matricula_error') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Apis matrícula error</button>
                <button onClick={() => setActiveTab('api_proceso_reverso')} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${isItemActive('api_proceso_reverso') ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Apis proceso reverso</button>
              </div>
            )}
          </div>
        </nav>

        {/* FOOTER USUARIO */}
        <div className="p-6 border-t border-slate-100 flex-shrink-0 mt-auto space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              {(session.user.email || '??').slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-700 truncate">{session.user.email}</p>
            </div>
          </div>
          <button className="w-full flex items-center gap-3 text-slate-500 hover:text-slate-800 text-sm font-medium"><Key size={18} />Llaves de acceso</button>
          <button onClick={() => void signOut()} className="w-full flex items-center gap-3 text-slate-500 hover:text-slate-800 text-sm font-medium"><LogOut size={18} />Cerrar sesión</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* HEADER */}
        <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-lg lg:hidden"><Menu size={24} /></button>
            {activeTab !== 'tickets' && (
              esTabDescuentos ? (
                <div>
                  <h2 className="text-lg font-bold text-slate-700">Gestión de descuentos</h2>
                  <p className="text-xs text-slate-500">Control de descuentos salariales</p>
                </div>
              ) : esTabConfiguracionDistribucion ? (
                <div>
                  <h2 className="text-lg font-bold text-slate-700">Detalle de distribución</h2>
                  <p className="text-xs text-slate-500">Reglas y parámetros de distribución de nómina</p>
                </div>
              ) : esTabDistribucionFactura ? (
                <div>
                  <h2 className="text-lg font-bold text-slate-700">Distribución por factura</h2>
                  <p className="text-xs text-slate-500">Genera distribución por parqueadero y exporta a Excel</p>
                </div>
              ) : (
                <h2 className="text-lg font-bold text-slate-700 capitalize">{activeTab.replace('_', ' ')}</h2>
              )
            )}
          </div>
          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-bold text-slate-700">Urbapark</span>
              <ChevronDown size={14} />
            </div>
            <div className="w-9 h-9 bg-slate-200 rounded-full"></div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto w-full">
            <Suspense
              fallback={(
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  Cargando modulo...
                </div>
              )}
            >
              {renderActiveContent()}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;