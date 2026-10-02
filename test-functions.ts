import { createClient } from '@supabase/supabase-js'

async function run() {
  const url = 'https://ypqaziiqzwywsmolfqyt.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwcWF6aWlxend5d3Ntb2xmcXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjE4MTYsImV4cCI6MjA5MjI5NzgxNn0.3vi-CAw31Aa2KJy-BsLu7oToyEpKXtUKwFFW-IEgrtg';
  const supabase = createClient(url, key);

  try {
     console.log("Invoking render-delivery-note with empty body...");
     const res = await supabase.functions.invoke('render-delivery-note', {
         body: {}
     });
     
     if (res.error) {
        if (res.error.context && res.error.context.text) {
            console.log(await res.error.context.text());
        }
     } else {
        console.log(res);
     }
  } catch (e) {
     console.error("Exception:", e);
  }
}
run();
