import { useState, type FormEvent } from 'react';
import {
    AlertCircle,
    Cpu,
    Eye,
    EyeOff,
    Fingerprint,
    Loader2,
    Lock,
    Mail,
    ShieldCheck,
    UserPlus,
    KeyRound,
    CheckCircle2,
    ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

type Modo = 'login' | 'signup' | 'recuperar';

export default function LoginView() {
    const { signIn, signUp, resetPassword, updatePassword, isPasswordRecovery, clearPasswordRecovery } = useAuth();

    const [modo, setModo] = useState<Modo>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    const cambiarModo = (nuevoModo: Modo) => {
        setModo(nuevoModo);
        setError('');
        setMensajeExito('');
        setPassword('');
        setConfirmPassword('');
    };

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await signIn(email.trim(), password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignup = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { requiresEmailConfirmation } = await signUp(email.trim(), password);
            if (requiresEmailConfirmation) {
                setMensajeExito('Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
                cambiarModo('login');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRecuperar = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await resetPassword(email.trim());
            setMensajeExito('Te enviamos un correo con las instrucciones para recuperar tu contraseña.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo enviar el correo de recuperación.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNuevaPassword = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            await updatePassword(password);
            setMensajeExito('Contraseña actualizada correctamente.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
            <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                {/* PANEL IZQUIERDO */}
                <div className="hidden lg:flex flex-col gap-8 px-4">
                    <div className="flex items-center gap-2 text-orange-500">
                        <Cpu size={36} strokeWidth={2.5} />
                        <span className="text-[36px] leading-none font-medium tracking-wide text-[#2173B9] uppercase">SITEC</span>
                    </div>
                    <div className="relative w-full aspect-square max-w-sm mx-auto">
                        <div className="absolute inset-0 bg-blue-50 rounded-full" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-3xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-[#2173B9]">
                                <Fingerprint size={48} strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="absolute top-6 right-6 w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-emerald-500">
                            <ShieldCheck size={28} />
                        </div>
                        <div className="absolute bottom-10 left-2 w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-orange-500">
                            <Lock size={26} />
                        </div>
                        <div className="absolute bottom-4 right-10 w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-[#2173B9]">
                            <Mail size={24} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm max-w-sm">
                        Portal SITEC — accede a los módulos de operaciones, contabilidad, nómina y mantenimiento con tu cuenta.
                    </p>
                </div>

                {/* PANEL DERECHO */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-10">
                    {isPasswordRecovery ? (
                        <>
                            <h1 className="text-[22px] font-bold text-slate-800 mb-1">Elige una nueva contraseña</h1>
                            <p className="text-[13px] text-slate-500 mb-6">Ingresa y confirma tu nueva contraseña para continuar.</p>

                            {mensajeExito ? (
                                <div className="flex flex-col items-center text-center py-6">
                                    <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                                    <p className="text-[14px] text-slate-700 mb-4">{mensajeExito}</p>
                                    <button
                                        onClick={() => { clearPasswordRecovery(); setMensajeExito(''); cambiarModo('login'); }}
                                        className="text-[#2173B9] text-sm font-bold hover:underline"
                                    >
                                        Ir a iniciar sesión
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleNuevaPassword} className="space-y-4">
                                    <CampoPassword
                                        label="NUEVA CONTRASEÑA"
                                        value={password}
                                        onChange={setPassword}
                                        mostrar={mostrarPassword}
                                        onToggleMostrar={() => setMostrarPassword(v => !v)}
                                    />
                                    <CampoPassword
                                        label="CONFIRMAR CONTRASEÑA"
                                        value={confirmPassword}
                                        onChange={setConfirmPassword}
                                        mostrar={mostrarPassword}
                                        onToggleMostrar={() => setMostrarPassword(v => !v)}
                                    />
                                    {error && <MensajeError texto={error} />}
                                    <BotonEnviar isSubmitting={isSubmitting} texto="Guardar contraseña" />
                                </form>
                            )}
                        </>
                    ) : modo === 'login' ? (
                        <>
                            <h1 className="text-[22px] font-bold text-slate-800 mb-1">Accede a tu cuenta</h1>
                            <p className="text-[13px] text-slate-500 mb-6">Bienvenido a Sitec DSP, ingresa tu correo y contraseña para acceder a tu cuenta.</p>

                            {mensajeExito && <MensajeExito texto={mensajeExito} />}

                            <form onSubmit={handleLogin} className="space-y-4">
                                <CampoEmail value={email} onChange={setEmail} />
                                <CampoPassword
                                    label="CONTRASEÑA"
                                    value={password}
                                    onChange={setPassword}
                                    mostrar={mostrarPassword}
                                    onToggleMostrar={() => setMostrarPassword(v => !v)}
                                />
                                {error && <MensajeError texto={error} />}

                                <div className="pt-2">
                                    <BotonEnviar isSubmitting={isSubmitting} texto="Acceder" />
                                </div>
                            </form>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                                <div className="relative flex justify-center text-[11px] text-slate-400 bg-white px-3 mx-auto w-fit">
                                    crea tu cuenta, o recupera tu contraseña
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <button onClick={() => cambiarModo('signup')} className="flex items-center gap-2 text-slate-500 hover:text-[#2173B9] text-[13px] font-medium transition-colors">
                                    <UserPlus size={16} /> Crear cuenta
                                </button>
                                <button onClick={() => cambiarModo('recuperar')} className="flex items-center gap-2 text-slate-500 hover:text-[#2173B9] text-[13px] font-medium transition-colors">
                                    <KeyRound size={16} /> Recuperar contraseña
                                </button>
                            </div>
                        </>
                    ) : modo === 'signup' ? (
                        <>
                            <button onClick={() => cambiarModo('login')} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-[12px] font-medium mb-4">
                                <ArrowLeft size={14} /> Volver
                            </button>
                            <h1 className="text-[22px] font-bold text-slate-800 mb-1">Crea tu cuenta</h1>
                            <p className="text-[13px] text-slate-500 mb-6">Regístrate con tu correo para acceder al Portal SITEC.</p>

                            <form onSubmit={handleSignup} className="space-y-4">
                                <CampoEmail value={email} onChange={setEmail} />
                                <CampoPassword
                                    label="CONTRASEÑA"
                                    value={password}
                                    onChange={setPassword}
                                    mostrar={mostrarPassword}
                                    onToggleMostrar={() => setMostrarPassword(v => !v)}
                                />
                                <CampoPassword
                                    label="CONFIRMAR CONTRASEÑA"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    mostrar={mostrarPassword}
                                    onToggleMostrar={() => setMostrarPassword(v => !v)}
                                />
                                {error && <MensajeError texto={error} />}
                                <BotonEnviar isSubmitting={isSubmitting} texto="Crear cuenta" />
                            </form>
                        </>
                    ) : (
                        <>
                            <button onClick={() => cambiarModo('login')} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-[12px] font-medium mb-4">
                                <ArrowLeft size={14} /> Volver
                            </button>
                            <h1 className="text-[22px] font-bold text-slate-800 mb-1">Recupera tu contraseña</h1>
                            <p className="text-[13px] text-slate-500 mb-6">Ingresa tu correo y te enviaremos las instrucciones para restablecerla.</p>

                            {mensajeExito ? (
                                <div className="flex flex-col items-center text-center py-6">
                                    <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                                    <p className="text-[14px] text-slate-700">{mensajeExito}</p>
                                </div>
                            ) : (
                                <form onSubmit={handleRecuperar} className="space-y-4">
                                    <CampoEmail value={email} onChange={setEmail} />
                                    {error && <MensajeError texto={error} />}
                                    <BotonEnviar isSubmitting={isSubmitting} texto="Enviar instrucciones" />
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function CampoEmail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tu email</label>
            <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                    type="email"
                    required
                    placeholder="ejm: info@sitec-dsp.com"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                />
            </div>
        </div>
    );
}

function CampoPassword({ label, value, onChange, mostrar, onToggleMostrar }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    mostrar: boolean;
    onToggleMostrar: () => void;
}) {
    return (
        <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{label}</label>
            <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                    type={mostrar ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="········"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                />
                <button type="button" onClick={onToggleMostrar} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}

function MensajeError({ texto }: { texto: string }) {
    return (
        <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {texto}
        </div>
    );
}

function MensajeExito({ texto }: { texto: string }) {
    return (
        <div className="flex items-start gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {texto}
        </div>
    );
}

function BotonEnviar({ isSubmitting, texto }: { isSubmitting: boolean; texto: string }) {
    return (
        <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2173B9] text-white text-[14px] font-bold hover:bg-[#185a94] shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {texto}
        </button>
    );
}
