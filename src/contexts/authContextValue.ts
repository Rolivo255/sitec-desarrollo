import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextValue {
    session: Session | null;
    isLoading: boolean;
    isPasswordRecovery: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<{ requiresEmailConfirmation: boolean }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updatePassword: (newPassword: string) => Promise<void>;
    clearPasswordRecovery: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
