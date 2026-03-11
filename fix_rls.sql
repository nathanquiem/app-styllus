-- =========================================================================
-- SCRIPT DE CORREÇÃO: Política RLS (Row Level Security) para Profiles
-- =========================================================================
-- Rode este script no Editor SQL do seu painel do Supabase.
-- Ele resolve o erro "new row violates row-level security policy for table profiles"
-- permitindo que novos usuários criem as próprias contas.

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Caso a tabela já tivesse o RLS desabilitado, re-habilitamos para garantir:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
