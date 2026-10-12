# SITEC en la cuenta Rolivo

- GitHub: `Rolivo255/sitec-desarrollo`.
- Supabase: organización UBK, proyecto SITEC_PROYECTOS (`yltawmubxibpzilmsroq`).
- Vercel: equipo ubk (`ubk3`), aplicación `sitec-desarrollo`.

El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave publicable).
El backend usa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y una conexión PostgreSQL
con el rol exclusivo `sitec_backend`, el pooler de transacciones y verificación TLS.
La contraseña solo se configura en `.env.local` y en las variables privadas de Vercel.

Las rutas `/api` requieren una sesión válida y un correo autorizado en
`SITEC_ALLOWED_EMAILS`. Inicialmente se autoriza `rolivo@urba-park.com`.
La cuenta de acceso al portal debe existir en Supabase Auth de este proyecto;
la cuenta del panel de Supabase es independiente de los usuarios del portal.

Las tablas de negocio tienen RLS activado y no se exponen directamente a `anon`
ni a `authenticated`; los datos pasan por el backend. Los archivos se guardan
en buckets privados y se descargan mediante enlaces firmados de cinco minutos.

El esquema y los datos base provienen del respaldo incluido del 12 de marzo
de 2026, complementado con el esquema de la versión del código publicada.
No se copiaron los usuarios de Auth ni los objetos de Storage de la cuenta anterior.
Los esquemas SQL reproducibles están en `backend/sql/rolivo_*`.

La integración n8n continúa usando el servidor externo configurado en
`N8N_BASE_URL`. SQL Server requiere sus propias credenciales y permanece
deshabilitado hasta que se configure. Esos servicios no se alojan en Supabase.

Para desarrollo local, copia `.env.example` a `.env.local` y configura la
conexión privada; después ejecuta `npm ci`, `npm run dev:backend` y `npm run dev`.
`GET /api/health` comprueba la conexión real a PostgreSQL sin mostrar credenciales.

Los secretos, los respaldos de datos y `.vercel` no deben publicarse en Git.
