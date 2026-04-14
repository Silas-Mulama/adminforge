import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseCredentials) {
  console.warn('Supabase credentials missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
