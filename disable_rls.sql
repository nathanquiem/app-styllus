-- =========================================================================
-- SCRIPT DE CORREÇÃO: Desabilitar provisoriamente o RLS (Row Level Security)
-- =========================================================================
-- Rode este script no Editor SQL do seu painel do Supabase.
-- Ele vai desativar as barreiras de segurança durante sua fase de testes,
-- permitindo que as tabelas sejam lidas e gravadas sem bloqueios.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_config DISABLE ROW LEVEL SECURITY;

-- Nota: Quando for para produção oficial, recomendo reativar (ENABLE) 
-- e configurar as políticas corretamente para evitar que qualquer pessoa 
-- acesse dados de outros clientes.
