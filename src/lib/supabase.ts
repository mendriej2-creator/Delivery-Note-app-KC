import { createClient } from '@supabase/supabase-js';

// Strip whitespace and any quotes that might accidentally get parsed by Vite
const getOrigin = (val: string | undefined, defaultUrl: string) => {
  if (!val) return defaultUrl;
  const cleaned = val.trim().replace(/^["']|["']$/g, '');
  try {
    const url = new URL(cleaned);
    return url.origin; // This strips any /rest/v1 or other paths the user might have accidentally included
  } catch (e) {
    return cleaned;
  }
};

const cleanKey = (val: string | undefined) => val ? val.trim().replace(/^["']|["']$/g, '') : '';

const supabaseUrl = getOrigin(import.meta.env.VITE_SUPABASE_URL, 'https://ypqaziiqzwywsmolfqyt.supabase.co');
const supabaseAnonKey = cleanKey(import.meta.env.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwcWF6aWlxend5d3Ntb2xmcXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjE4MTYsImV4cCI6MjA5MjI5NzgxNn0.3vi-CAw31Aa2KJy-BsLu7oToyEpKXtUKwFFW-IEgrtg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
