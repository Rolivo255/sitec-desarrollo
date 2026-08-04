import { Coins } from 'lucide-react';

export default function RecaudacionView() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Coins size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Recaudación</h2>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-full">
                        <Coins size={40} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Recaudación</h3>
                    <p className="text-slate-500">Módulo en construcción.</p>
                </div>
            </div>
        </div>
    );
}
