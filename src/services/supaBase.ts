import { SUPABASE_URL as supabaseUrl, SUPABASE_ANON_KEY as supabaseKey } from './supabaseConfig';
import { supabase } from './supabaseClient';

export interface SupabaseUploadInput {
  bucket: string;
  objectPath: string;
  file: File;
  upsert?: boolean;
  accessToken?: string;
}

export const uploadToSupabaseStorage = async (input: SupabaseUploadInput): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = input.accessToken || session?.access_token;
  if (!token) throw new Error('Debes iniciar sesión para subir archivos.');
  const endpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(input.bucket)}/${input.objectPath}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
      'x-upsert': input.upsert ? 'true' : 'false',
      'Content-Type': input.file.type || 'application/octet-stream',
    },
    body: input.file,
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const payload = await response.json() as { error?: string; message?: string };
      details = payload.error || payload.message || details;
    } catch {
      // no-op
    }
    throw new Error(`No se pudo subir archivo a Supabase Storage: ${details}`);
  }

  return `supabase://${encodeURIComponent(input.bucket)}/${input.objectPath}`;
};

export async function getStorageDownloadUrl(reference: string): Promise<string> {
  if (!reference.startsWith('supabase://')) return reference;
  const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(reference);
  if (!match) throw new Error('Referencia de archivo inválida.');
  const { data, error } = await supabase.storage.from(decodeURIComponent(match[1])).createSignedUrl(match[2], 300);
  if (error) throw error;
  return data.signedUrl;
}
