const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_NEXT_PUBLIC; // Service Role Key
const supabase = createClient(supabaseUrl, supabaseKey);

const firstNames = ['Ana', 'Carlos', 'João', 'Maria', 'Pedro', 'Lucas', 'Juliana', 'Fernanda', 'Rafael', 'Bruno', 'Amanda', 'Diego', 'Thiago', 'Beatriz', 'Camila'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho'];

function getRandomName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

async function run() {
  try {
    console.log('Buscando empresa_id, barbeiros e serviços...');
    
    // Obter barbeiros (onde role é admin ou barbeiro, ou apenas ler a tabela 'barbers'?)
    // No projeto parece usar a tabela 'profiles' para barbeiros se for role = admin, ou 'barbers' table? 
    // Vamos checar a tabela 'profiles' onde role='admin' para ser a empresa, e os outros 'barber' ou 'collaborator'
    const { data: admins } = await supabase.from('profiles').select('*').eq('role', 'admin').limit(1);
    if (!admins || admins.length === 0) throw new Error('Admin não encontrado para usar como empresa_id.');
    const empresaId = admins[0].empresa_id || admins[0].id;
    
    // Buscar servicos
    const { data: services } = await supabase.from('services').select('*').eq('active', true);
    if (!services || services.length === 0) throw new Error('Adoção falhou - sem serviços.');
    
    // Buscar barbeiros
    const { data: barbers } = await supabase.from('barbers').select('*').eq('active', true);
    let availableBarbers = barbers || [];
    if (availableBarbers.length === 0) {
      console.log('Sem colaboradores na tabela barbers. Usando o admin como unico barbeiro para os agendamentos.');
      availableBarbers = admins;
    }

    console.log(`Gerando 55 novos clientes (auth.users + profiles) para empresa ${empresaId}...`);
    const clientsToCreate = [];
    
    for (let i = 0; i < 55; i++) {
        const email = `cliente.ficticio.${Date.now()}.${i}@email.com`;
        const phone = `119${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
        
        // Auth Admin CreateUser
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password: 'password123',
            email_confirm: true
        });
        
        if (authErr) {
            console.error(`Erro ao criar user auth ${email}:`, authErr);
            continue;
        }

        const userId = authData.user.id;
        
        // Adicionar a lista de clientes usando o id retornado
        clientsToCreate.push({
            id: userId,
            full_name: getRandomName(),
            email: email,
            phone: phone,
            role: 'client',
            empresa_id: empresaId,
            created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
        });
    }

    // Inserir todos no profiles de uma vez (ou um a um caso a trigger já tenha criado e precise de update)
    console.log(`Clientes gerados: ${clientsToCreate.length}. Fazendo Upsert nos profiles...`);
    const { error: profErr } = await supabase.from('profiles').upsert(clientsToCreate);
    if (profErr) {
        throw new Error(`Erro profiles: ${profErr.message}`);
    }

    console.log('Gerando 70 Agendamentos fictícios...');
    
    const bookingsToCreate = [];
    for (let i = 0; i < 70; i++) {
        const randomClient = clientsToCreate[Math.floor(Math.random() * clientsToCreate.length)];
        const randomService = services[Math.floor(Math.random() * services.length)];
        const randomBarber = availableBarbers[Math.floor(Math.random() * availableBarbers.length)];
        
        // Data aleatoria: entre 10 dias atrás e 10 dias pra frente
        const deltaDays = (Math.random() * 20) - 10;
        const bookDate = new Date();
        bookDate.setDate(bookDate.getDate() + deltaDays);
        bookDate.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
        
        let stat = 'confirmed';
        if (deltaDays < 0 && Math.random() > 0.8) stat = 'cancelled'; // 20% cancelados no passado
        
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

    const { error: bookErr } = await supabase.from('bookings').insert(bookingsToCreate);
    if (bookErr) {
        throw new Error(`Erro agendamentos: ${bookErr.message}`);
    }
    
    console.log('✅ Finalizado! 55 Clientes e 70 Agendamentos gerados com sucesso.');
  } catch (error) {
    console.error('Falhou:', error);
  }
}

run();
