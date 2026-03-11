-- Migration for App Barbearia

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Profiles Table (Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin')),
    empresa_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Services Table
CREATE TABLE public.services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    image_url TEXT,
    empresa_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bookings Table
CREATE TABLE public.bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional, null if guest
    guest_name TEXT,
    guest_phone TEXT,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled')),
    notification_sent BOOLEAN DEFAULT false NOT NULL,
    empresa_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure either client_id OR guest info is provided
    CONSTRAINT client_or_guest CHECK (
        (client_id IS NOT NULL) OR 
        (guest_name IS NOT NULL AND guest_phone IS NOT NULL)
    )
);

-- Business Config Table
CREATE TABLE public.business_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cancel_limit_hours INTEGER DEFAULT 2 NOT NULL,
    evolution_instance_id TEXT,
    empresa_id UUID NOT NULL UNIQUE, -- One config per business
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- 2. Indexes for Performance (Especially on empresa_id)
-- ==========================================
CREATE INDEX idx_profiles_empresa_id ON public.profiles(empresa_id);
CREATE INDEX idx_services_empresa_id ON public.services(empresa_id);
CREATE INDEX idx_bookings_empresa_id ON public.bookings(empresa_id);
CREATE INDEX idx_bookings_start_time ON public.bookings(start_time);


-- ==========================================
-- 3. Row Level Security (RLS) Setup
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_config ENABLE ROW LEVEL SECURITY;

-- Note: In a real multi-tenant system, these policies should check if auth.uid() belongs to the same empresa_id.
-- For this MVP, we will set up basic policies. We assume a secure backend for some admin actions.

-- --- PROFILES ---
-- Admins can read all profiles in their company. Users can read their own profile.
CREATE POLICY "Admins read all, users read own"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = profiles.empresa_id)
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- --- SERVICES ---
-- Anyone can read services
CREATE POLICY "Services are viewable by everyone"
ON public.services FOR SELECT
USING (true);

-- Only admins can modify services
CREATE POLICY "Only admins can insert services"
ON public.services FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = services.empresa_id)
);
CREATE POLICY "Only admins can update services"
ON public.services FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = services.empresa_id)
);
CREATE POLICY "Only admins can delete services"
ON public.services FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = services.empresa_id)
);


-- --- BOOKINGS ---
-- Admins read all bookings in their company. Users read their own bookings.
CREATE POLICY "Admins read all bookings, users read own"
ON public.bookings FOR SELECT
USING (
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = bookings.empresa_id)
);

-- Anyone authenticated can insert a booking (as themselves), or Admins can insert guest bookings
CREATE POLICY "Users can create bookings"
ON public.bookings FOR INSERT
WITH CHECK (
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = bookings.empresa_id)
);

-- Users can update their own booking (e.g. cancel), Admins can update any
CREATE POLICY "Users can update own bookings, admins can update any"
ON public.bookings FOR UPDATE
USING (
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = bookings.empresa_id)
);

-- --- BUSINESS CONFIG ---
-- Anyone can view config (e.g., to see cancel limits)
CREATE POLICY "Config viewable by everyone"
ON public.business_config FOR SELECT
USING (true);

-- Only admins can update config
CREATE POLICY "Only admins can update config"
ON public.business_config FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = business_config.empresa_id)
);


-- ==========================================
-- 4. Triggers (Optional but good practice)
-- ==========================================
-- Create a trigger function to automatically update 'updated_at' columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_modtime BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_modtime BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_config_modtime BEFORE UPDATE ON public.business_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
