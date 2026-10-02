import { createClient } from '@supabase/supabase-js'

async function run() {
  const url = 'https://ypqaziiqzwywsmolfqyt.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwcWF6aWlxend5d3Ntb2xmcXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjE4MTYsImV4cCI6MjA5MjI5NzgxNn0.3vi-CAw31Aa2KJy-BsLu7oToyEpKXtUKwFFW-IEgrtg';
  const supabase = createClient(url, key);

  try {
     const path = 'delivery-notes/059e5f82-9b7d-4826-b809-857f5f321913/delivery-note-68060733.pdf';
     
     // Scenario 1: Path has bucket name
     const parts = path.split('/');
     const bucket = parts[0];
     const filePath = parts.slice(1).join('/');

     console.log("Bucket:", bucket);
     console.log("File Path:", filePath);

     let publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
     console.log("Public URL:", publicUrl);

     let signedUrlResp = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
     console.log("Signed URL:", signedUrlResp);
  } catch (e) {
     console.error(e);
  }
}
run();

