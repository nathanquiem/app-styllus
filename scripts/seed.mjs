import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load env vars from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const firstNames = ['Ana', 'Carlos', 'João', 'Maria', 'Pedro', 'Lucas', 'Juliana', 'Fernanda', 'Rafael', 'Bruno', 'Amanda', 'Diego', 'Thiago', 'Beatriz', 'Camila', 'Vitor', 'Letícia', 'Felipe', 'Mariana', 'Ricardo'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Melo', 'Nunes', 'Rocha', 'Mendes', 'Dias'];

function getRandomName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

const fixedServices = [
  { id: '0ac88c24-3807-474d-8cf5-9f1c8297d05f', name: 'Sombrancelha Masculina', price: 15 },
  { id: '3d4bff95-3d1b-4b3c-84aa-b9bc98aa6de6', name: 'Platinado', price: 0 },
  { id: '4429ee9d-d9a5-42bb-9f79-48357b9b77c3', name: 'Infantil', price: 45 },
  { id: '62e107fd-668a-44ce-bb37-6d45fead5c08', name: 'Penteado', price: 30 },
  { id: '7d3869a7-5f24-4fdc-aeab-71b64b7d08bb', name: 'Corte Nomal', price: 50 },
  { id: '7f2bd6b7-c6e2-47b1-af09-041152c265ed', name: 'Lateral Feminina', price: 35 },
  { id: 'a25cc0fb-01b4-45df-a58c-330234829aee', name: 'Tranças e Dreads', price: 0 },
  { id: 'bb37c978-5d8a-4a76-8593-f15ba86dfbe4', name: 'Corte Navalha', price: 50 },
  { id: 'e5238411-d616-41d6-a925-c50757a2dba7', name: 'Sombrancelha Feminina', price: 30 }
];

async function run() {
  try {
    console.log('Buscando empresa_id e barbeiros...');
    
    const { data: admins } = await supabase.from('profiles').select('*').eq('role', 'admin').limit(1);
    if (!admins || admins.length === 0) throw new Error('Admin não encontrado no DB. Nenhuma empresa_id pra usar.');
    const empresaId = admins[0].empresa_id || admins[0].id; // Fallback
    
    let { data: barbers } = await supabase.from('barbers').select('*').eq('active', true);
    if (!barbers || barbers.length === 0) {
      console.log('Nenhum barbeiro "active" encontrado, inserindo agendamento para o admin.');
      barbers = admins;
    }
    console.log('IDs de Barbeiros selecionados:', barbers.map(b => b.id).join(', '));

    console.log(`Gerando 55 usuários/clientes fictícios (Auth + Profile)...`);
    const clientsToCreate = [];
    
    for (let i = 0; i < 55; i++) {
        const email = `cliente${Date.now()}${i}@barbeariateste.com`;
        const phone = `119${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
        
        // CUIDADO: admin.createUser ignora RLS bypass no Supabase-js padrão se n for service role (estamos com service role).
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password: 'password123',
            email_confirm: true
        });
        
        if (authErr) {
            console.error(`Aviso: Erro user auth ${email}:`, authErr.message);
            continue;
        }

        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 180)); // clientes cadastrados nos últimos 6 meses

        clientsToCreate.push({
            id: authData.user.id,
            full_name: getRandomName(),
            email: email,
            phone: phone,
            role: 'client',
            empresa_id: empresaId,
            created_at: createdAt.toISOString()
        });
    }

    if (clientsToCreate.length > 0) {
        console.log(`Criados ${clientsToCreate.length} no Auth. Inserindo no profiles...`);
        const { error: profErr } = await supabase.from('profiles').upsert(clientsToCreate);
        if (profErr) console.error(`Erro ao inserir no profiles (mas Auth foi criado!):`, profErr.message);
    }

    console.log('Gerando 70 Agendamentos Paginados no Histórico e Futuro...');
    
    const bookingsToCreate = [];
    for (let i = 0; i < 70; i++) {
        const randomClient = clientsToCreate[Math.floor(Math.random() * clientsToCreate.length)];
        if(!randomClient) continue;

        const randomService = fixedServices[Math.floor(Math.random() * fixedServices.length)];
        const randomBarber = barbers[Math.floor(Math.random() * barbers.length)];
        
        // Data entre 15 dias no passado e 7 dias pro futuro
        const deltaDays = (Math.random() * 22) - 15;
        const bookDate = new Date();
        bookDate.setDate(bookDate.getDate() + deltaDays);
        bookDate.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0); // Entre 9h e 18h
        
        let stat = 'confirmed';
        if (deltaDays < 0 && Math.random() > 0.8) stat = 'canceled'; // 20% de chance de estar cancelado se for no passado
        
        bookingsToCreate.push({
            client_id: randomClient.id,
            barber_id: randomBarber.id,
            service_id: randomService.id,
            empresa_id: empresaId,
            guest_name: randomClient.full_name,
            guest_phone: randomClient.phone,
            start_time: bookDate.toISOString(),
            status: stat
        });
    }

    if (bookingsToCreate.length > 0) {
        console.log(`Tentando inserir ${bookingsToCreate.length} agendamentos...`);
        const { error: bookErr } = await supabase.from('bookings').insert(bookingsToCreate);
        if (bookErr) {
           console.log('ERRO DETALHADO AO INSERIR AGENDAMENTOS:');
           console.dir(bookErr, { depth: null });
           throw new Error(`Erro ao inserir agendamentos: ${bookErr.message}`);
        }
    }
    
    console.log('✅ Tudo finalizado! Recarregue a página (clientes/agendamentos).');
  } catch (error) {
    console.error('Script Falhou Definitivamente:', error);
  }
}

run();
