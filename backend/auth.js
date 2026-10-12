import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const auth = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

export async function requireSession(req, res, next) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  if (!auth) return res.status(503).json({ error: 'Autenticación no configurada.' });
  try {
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
    const allowed = (process.env.SITEC_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!allowed.length || !allowed.includes((data.user.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'Tu cuenta no tiene acceso a SITEC.' });
    }
    req.user = data.user;
    next();
  } catch {
    res.status(503).json({ error: 'No se pudo verificar la sesión.' });
  }
}
