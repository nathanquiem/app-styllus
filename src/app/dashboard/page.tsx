"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { LogOut, Plus, Clock, CalendarDays, Ban, X, Settings, Shield, User as UserIcon } from 'lucide-react'
import { formatPhone, maskPhoneInput } from '@/lib/formatPhone'
import { format, isAfter, subHours, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { BookingModal } from '@/components/BookingModal'
import { Footer } from '@/components/Footer'

export default function DashboardPage() {
  const { user, profile, setProfile, logout, isLoading: authLoading } = useAuthStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookings, setBookings] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [cancelLimit, setCancelLimit] = useState(2) // default 2 hours
  const [mounted, setMounted] = useState(false)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const router = useRouter()
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [supabase] = useState(() => createClient())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/')
    }
  }, [mounted, authLoading, user, router])

  useEffect(() => {
    async function loadData() {
      if (authLoading || !user) return;

      try {
        // Fetch User Profile if not in store
        if (!profile) {
          const { data: prof } = await supabase
            .from('profiles_styllus')
            .select('*')
            .eq('id', user.id)
            
            .maybeSingle()
          if (prof) setProfile(prof)
        }

        // Fetch Business Config for Cancel Limit
        const { data: config } = await supabase
          .from('business_config_styllus')
          .select('cancel_limit_hours')
          
          .limit(1)
          .maybeSingle()
        
        if (config) setCancelLimit(config.cancel_limit_hours)

        // Fetch User Bookings with Service Details
        const { data: userBookings } = await supabase
          .from('bookings_styllus')
          .select(`
            *,
            services_styllus (name, duration_minutes, price),
            barbers_styllus (name)
          `)
          .eq('client_id', user.id)
          
          .order('start_time', { ascending: true })

        if (userBookings) setBookings(userBookings)

      } catch (error) {
        console.error("Error loading dashboard data", error)
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [authLoading, user, profile, supabase, setProfile])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn("Erro ao deslogar no Supabase:", e)
    } finally {
      logout() // Limpa zustand
      window.location.href = '/' // Hard redirect garantido
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    if(!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    
    try {
      // Fetch booking details before canceling to build the webhook payload
      const { data: bookingData } = await supabase
        .from('bookings_styllus')
        .select(`
          start_time,
          services_styllus (name),
          barbers_styllus (name),
          guest_name,
          guest_phone
        `)
        .eq('id', bookingId)
        .single()

      const { error } = await supabase
        .from('bookings_styllus')
        .update({ status: 'canceled' })
        .eq('id', bookingId)

      if (error) throw error

      // Dispatch cancellation webhook if instance is configured
      const { data: bizConfig } = await supabase
        .from('business_config_styllus')
        .select('evolution_instance_id, apikey_id')
        .limit(1)
        .single()

      if (bizConfig?.evolution_instance_id && bookingData) {
        const bookingDate = parseISO(bookingData.start_time)
        fetch('https://n8n.mundoai.com.br/webhook/novo-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: "delete_agendamento",
            instanceName: bizConfig.evolution_instance_id,
            apikey_id: bizConfig.apikey_id,
            phone: profile?.phone || bookingData.guest_phone || '',
            clientName: profile?.full_name || bookingData.guest_name || 'Cliente',
            serviceName: (bookingData.services_styllus as any)?.name || 'Serviço',
            barberName: (bookingData.barbers_styllus as any)?.name || 'Barbeiro',
            bookingDate: format(bookingDate, 'dd/MM/yyyy'),
            bookingTime: format(bookingDate, 'HH:mm')
          })
        }).catch(err => console.error("Erro ao notificar webhook cancelamento:", err))
      }

      setBookings(prev => 
        prev.map(b => b.id === bookingId ? { ...b, status: 'canceled' } : b)
      )
      alert("Agendamento cancelado com sucesso.")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      alert("Erro ao cancelar: " + error.message)
    }
  }

  const checkCanCancel = (startTimeStr: string) => {
    const startTime = parseISO(startTimeStr)
    const limitTime = subHours(startTime, cancelLimit)
    return isAfter(limitTime, new Date())
  }

  if (!mounted || authLoading || dataLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando painel...</div>
  }

  if (!user) return null;

  const upcomingBookings = bookings.filter(b => isAfter(parseISO(b.start_time), new Date()) && b.status === 'confirmed')
  const pastBookings = bookings.filter(b => !isAfter(parseISO(b.start_time), new Date()) || b.status === 'canceled')

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Olá, {profile?.full_name?.split(' ')[0]}</h1>
          <p className="text-sm text-zinc-400">Gerencie seus horários</p>
        </div>
        <div className="flex gap-2 sm:gap-4">
          {profile?.role === 'admin' && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => router.push('/adminstyllus')}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Painel</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => {
              setEditName(profile?.full_name || '')
              setEditPhone(profile?.phone || '')
              setIsSettingsOpen(true)
            }}
          >
            <Settings className="w-4 h-4 hidden sm:block" />
            <span className="hidden sm:inline">Configurações</span>
            <Settings className="w-4 h-4 sm:hidden" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="w-5 h-5 text-zinc-400" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Próximos Agendamentos</h2>
          <Button className="shadow-lg shadow-red-500/20" onClick={() => setIsBookingModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Novo Agendamento</span><span className="sm:hidden">Novo</span>
          </Button>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300">Você não tem horários marcados</h3>
            <p className="text-zinc-500 mt-2">Agende agora para garantir seu estilo em dia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingBookings.map(booking => {
              const date = parseISO(booking.start_time)
              const canCancel = checkCanCancel(booking.start_time)

              return (
                <Card key={booking.id} className="border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex justify-between items-start">
                      <span>{booking.services_styllus?.name}</span>
                      <span className="text-emerald-500 font-bold">R$ {booking.services_styllus?.price}</span>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {booking.services_styllus?.duration_minutes} minutos
                      </span>
                      {booking.barbers_styllus?.name && (
                        <span className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4" /> {booking.barbers_styllus.name}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                      <p className="font-medium text-white capitalize">
                        {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-2xl font-bold text-red-500 mt-1">
                        {format(date, "HH:mm")}
                      </p>
                    </div>
                    
                    {canCancel ? (
                      <Button 
                        variant="outline" 
                        className="w-full text-zinc-400 hover:text-red-500 hover:border-red-500"
                        onClick={() => handleCancelBooking(booking.id)}
                      >
                        Cancelar Horário
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center p-2 text-sm text-zinc-500 bg-zinc-900 rounded-md">
                        <Ban className="w-4 h-4 mr-2" />
                        Cancelamento indisponível ({cancelLimit}h limite)
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <div className="pt-8 border-t border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-300 mb-6">Histórico</h2>
          <div className="space-y-4">
            {pastBookings.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nenhum histórico encontrado.</p>
            ) : (
              pastBookings.map(booking => (
                <div key={booking.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-zinc-800/50 bg-zinc-900/30 gap-4">
                  <div>
                    <p className="font-medium text-zinc-300">{booking.services_styllus?.name}</p>
                    <p className="text-sm text-zinc-500">
                      {format(parseISO(booking.start_time), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      booking.status === 'canceled' 
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {booking.status === 'canceled' ? 'Cancelado' : 'Concluído'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)} 
        onSuccess={() => window.location.reload()} 
        userId={user.id}
        empresaId={process.env.NEXT_PUBLIC_EMPRESA_ID!} 
      />

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Configurações do Perfil</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-400">Nome</label>
                <input 
                  type="text" 
                  className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-400">Telefone</label>
                <input 
                  type="text" 
                  className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
                  value={editPhone}
                  onChange={e => setEditPhone(maskPhoneInput(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-400">E-mail</label>
                <input 
                  type="email" 
                  disabled
                  className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-500 cursor-not-allowed"
                  value={user.email || ''}
                />
                <p className="text-xs text-zinc-600 mt-1">O e-mail vinculado à conta não pode ser alterado.</p>
              </div>
              <Button 
                className="w-full mt-6 shadow-lg shadow-red-500/20" 
                disabled={editLoading}
                onClick={async () => {
                  setEditLoading(true)
                  const { error } = await supabase
                    .from('profiles_styllus')
                    .update({ full_name: editName, phone: editPhone })
                    .eq('id', user.id)
                  
                  if (!error) {
                    setProfile({ ...profile, full_name: editName, phone: editPhone, id: user.id } as any)
                    setIsSettingsOpen(false)
                    alert("Perfil atualizado com sucesso!")
                  } else {
                    alert("Erro ao atualizar perfil: " + error.message)
                  }
                  setEditLoading(false)
                }}
              >
                {editLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
