import { useEffect, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './authContextValue';

const parseAuthError = (error: unknown): string => {
    if (error instanceof Error) {
        if (/invalid login credentials/i.test(error.message)) {
            return 'Correo o contraseña incorrectos.';
        }
        if (/user already registered/i.test(error.message)) {
            return 'Ya existe una cuenta registrada con este correo.';
        }
        if (/password should be at least/i.test(error.message)) {
            return 'La contraseña debe tener al menos 6 caracteres.';
        }
        return error.message;
    }
    return 'Ocurrió un error inesperado.';
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setIsLoading(false);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nuevaSession: Session | null) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }
            setSession(nuevaSession);
            setIsLoading(false);
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(parseAuthError(error));
    };

    const signUp = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(parseAuthError(error));
        return { requiresEmailConfirmation: !data.session };
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(parseAuthError(error));
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) throw new Error(parseAuthError(error));
    };

    const updatePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(parseAuthError(error));
        // No se limpia isPasswordRecovery aquí: se deja que LoginView muestre el
        // mensaje de éxito y sea el usuario quien salga con clearPasswordRecovery().
    };

    const clearPasswordRecovery = () => setIsPasswordRecovery(false);

    return (
        <AuthContext.Provider value={{ session, isLoading, isPasswordRecovery, signIn, signUp, signOut, resetPassword, updatePassword, clearPasswordRecovery }}>
            {children}
        </AuthContext.Provider>
    );
}
