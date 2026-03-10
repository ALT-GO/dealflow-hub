import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'attachments';

export interface StorageProvider {
  upload(path: string, file: File): Promise<{ path: string; error: string | null }>;
  getPublicUrl(path: string): string;
  remove(paths: string[]): Promise<{ error: string | null }>;
}

export const supabaseStorage: StorageProvider = {
  async upload(path: string, file: File) {
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    return { path: data?.path || path, error: error?.message || null };
  },

  getPublicUrl(path: string) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async remove(paths: string[]) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    return { error: error?.message || null };
  },
};

// Active provider — swap this to MinIO/local in the future
export const storage: StorageProvider = supabaseStorage;
