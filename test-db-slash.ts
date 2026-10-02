import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://ypqaziiqzwywsmolfqyt.supabase.co/';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwcWF6aWlxend5d3Ntb2xmcXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjE4MTYsImV4cCI6MjA5MjI5NzgxNn0.3vi-CAw31Aa2KJy-BsLu7oToyEpKXtUKwFFW-IEgrtg';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('organizations').select('*').limit(1);
  console.log({data, error});
}
run();
