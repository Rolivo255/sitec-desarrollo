import { BarChart3, CheckCircle2, Rocket, Settings2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

const nombreDesdeEmail = (email?: string | null): string => {
    if (!email) return 'Usuario';
    const local = email.split('@')[0] || 'Usuario';
    return local
        .split(/[._-]+/)
        .filter(Boolean)
        .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(' ');
};

export default function InicioView() {
    const { session } = useAuth();
    const nombre = nombreDesdeEmail(session?.user?.email);

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-[22px] font-bold text-slate-800">Hola, {nombre}</h1>
                <p className="text-[13px] text-slate-500 mt-1">ahora puedes gestionar todos tus procesos en un solo lugar.</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 flex flex-col md:flex-row items-center gap-10">
                {/* Ilustración decorativa */}
                <div className="relative w-full md:w-[340px] h-[280px] shrink-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-blue-50/60 rounded-[40%_60%_55%_45%/45%_45%_55%_55%]" />
                    <div className="relative flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-3xl bg-[#2173B9] shadow-lg flex items-center justify-center text-white -rotate-6">
                            <Rocket size={40} strokeWidth={1.5} />
                        </div>
                        <div className="flex gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-emerald-500">
                                <CheckCircle2 size={26} />
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-orange-500">
                                <Users size={26} />
                            </div>
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-[#2173B9]">
                                <BarChart3 size={26} />
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-slate-400">
                            <Settings2 size={22} />
                        </div>
                    </div>
                </div>

                {/* Texto */}
                <div className="flex-1 space-y-4">
                    <p className="text-[15px] text-slate-700 leading-relaxed">
                        Pensando en facilitar los procesos internos de las empresas, sus clientes, personal interno y proveedores, hemos creado esta plataforma para que puedas gestionar todos tus procesos en un solo lugar, de manera fácil y rápida.
                    </p>
                    <p className="text-[16px] font-bold text-[#2173B9]">
                        ¡Bienvenido a SITEC-DSP, clientes y proveedores!
                    </p>
                </div>
            </div>
        </div>
    );
}
