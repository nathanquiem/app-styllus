import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  let out = "";
  
  // Try querying profiles directly to see if we hit the RLS error from Node too
  const { data: pData, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  out += "Profiles Query:\n" + JSON.stringify(pData) + "\nError: " + JSON.stringify(pErr) + "\n\n";

  const { data: sData, error: sErr } = await supabase.from('services').select('*').limit(5);
  out += "Services Query:\n" + JSON.stringify(sData, null, 2) + "\nError: " + JSON.stringify(sErr) + "\n\n";
  
  const { data: bData, error: bErr } = await supabase.from('bookings').select('*').limit(5);
  out += "Bookings Query:\n" + JSON.stringify(bData, null, 2) + "\nError: " + JSON.stringify(bErr) + "\n\n";

  fs.writeFileSync('schema_info.txt', out);
}

checkSchema();
