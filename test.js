const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value.length) Object.assign(acc, { [key]: value.join('=').trim() });
  return acc;
}, {});

const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supaUrl, supaKey);

async function testQuery() {
  console.log('--- TESTANDO FETCH DE SERVICES_STYLLUS ---');
  const { data, error } = await supabase.from('services_styllus').select('*');
  if (error) {
    console.error('ERRO:', error.message);
  } else {
    console.log(`SUCESSO. Encontrados ${data?.length} registros.`);
    if (data?.length === 0) console.log('AVISO: A tabela está vazia ou bloqueada por RLS para usuários não logados (anon).');
  }
}

testQuery();
