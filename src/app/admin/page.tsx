"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { LogOut, Plus, Settings, Users, Scissors, Trash2, Save, X, Clock, Calendar, Image as ImageIcon, CheckCircle, Info, Menu, MapPin, Edit, Phone, User as UserIcon, BarChart3, ArrowUpRight, TrendingUp, Smartphone, QrCode, Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { format, parseISO, isAfter, subHours, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, eachMonthOfInterval, isSameDay, differenceInDays, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Area, AreaChart } from 'recharts'
import { formatPhone, maskPhoneInput } from '@/lib/formatPhone'

export default function PainelStyllus() {
  const { user, profile, logout } = useAuthStore()
  const { isLoading: authLoading } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'agenda' | 'quick' | 'services' | 'barbers' | 'config' | 'metrics' | 'clients' | 'whatsapp'>('agenda')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  // --- AGENDA STATE ---
  const [agendaFilter, setAgendaFilter] = useState<'today' | 'week' | 'future' | 'past'>('today')
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [agendaBookings, setAgendaBookings] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedClientDetails, setSelectedClientDetails] = useState<any>(null)
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false)
  const [agendaPage, setAgendaPage] = useState(0)
  const [hasMoreAgenda, setHasMoreAgenda] = useState(false)

  // --- QUICK BOOKING STATE ---
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickServiceId, setQuickServiceId] = useState('')
  const [quickBarberId, setQuickBarberId] = useState('')
  const [quickDate, setQuickDate] = useState('')
  const [quickTime, setQuickTime] = useState('')
  const [isQuickBooking, setIsQuickBooking] = useState(false)
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([])

  // --- SERVICES STATE ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [services, setServices] = useState<any[]>([])
  const [isCreatingService, setIsCreatingService] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', duration: '', description: '', image_url: '' })
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null)
  const [isSavingService, setIsSavingService] = useState(false)

  // --- BARBERS STATE ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [barbersList, setBarbersList] = useState<any[]>([])
  const [isCreatingBarber, setIsCreatingBarber] = useState(false)
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null)
  const [barberForm, setBarberForm] = useState({ name: '', active: true, selectedServices: [] as string[], photo_url: '' })
  const [barberImageFile, setBarberImageFile] = useState<File | null>(null)
  const [isSavingBarber, setIsSavingBarber] = useState(false)

  // --- CLIENTS STATE ---
  const [clientsList, setClientsList] = useState<any[]>([])
  const [clientsSearch, setClientsSearch] = useState('')
  const [isClientsLoading, setIsClientsLoading] = useState(false)
  const [clientsPage, setClientsPage] = useState(0)
  const [hasMoreClients, setHasMoreClients] = useState(false)

  // --- WHATSAPP STATE ---
  const [waInstances, setWaInstances] = useState<Array<{ instanceName: string; state: string; [key: string]: any }>>([])
  const [waQrCode, setWaQrCode] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState<'fetch' | 'connect' | 'disconnect' | null>(null)
  const [waError, setWaError] = useState<string | null>(null)
  const [waLastUpdated, setWaLastUpdated] = useState<Date | null>(null)
  const [waConnectingInstance, setWaConnectingInstance] = useState<string | null>(null)

  // --- CONFIG STATE ---
  const [config, setConfig] = useState<any>({ open_time: '09:00', close_time: '19:00', open_days: [1,2,3,4,5,6] })
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // --- METRICS STATE ---

  // Initialization
  useEffect(() => {
    if (activeTab === 'agenda') {
      setAgendaPage(0)
      fetchAgenda(0)
    }
    if (activeTab === 'quick') {
       fetchServices().then(() => fetchBarbers())
       fetchConfig()
    }
    if (activeTab === 'services') fetchServices()
    if (activeTab === 'barbers') { fetchBarbers(); fetchServices(); }
    if (activeTab === 'config') fetchConfig()
    if (activeTab === 'metrics') { /* handled by dedicated useEffect on date state */ }
    if (activeTab === 'whatsapp') handleWaFetchInstances()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, agendaFilter, historyMonth])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'clients') {
        setClientsPage(0)
        fetchClients(0, clientsSearch)
      }
    }, 500)
    return () => clearTimeout(delayDebounce)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsSearch, activeTab])

  useEffect(() => {
    if (activeTab === 'quick' && config && !quickDate) {
      let d = new Date()
      let foundDate = ''
      for (let i = 0; i < 30; i++) {
        const dateStr = format(d, 'yyyy-MM-dd')
        const dayOfWeek = d.getDay()
        const isClosedDate = config?.closed_dates?.includes(dateStr)
        const isOpenDay = !config?.open_days || config.open_days.includes(dayOfWeek)
        
        let hasSlotsLeft = true
        if (i === 0 && config?.close_time) {
           const [closeH, closeM] = config.close_time.split(':').map(Number)
           const closeTotal = closeH * 60 + closeM
           const currentTotal = d.getHours() * 60 + d.getMinutes()
           if (currentTotal + 30 >= closeTotal) {
              hasSlotsLeft = false
           }
        }

        if (!isClosedDate && isOpenDay && hasSlotsLeft) {
          foundDate = dateStr
          break
        }
        d.setDate(d.getDate() + 1)
      }
      if (foundDate) setQuickDate(foundDate)
    }
  }, [config, activeTab, quickDate])

  // --- AGENDA LOGIC ---
  const fetchAgenda = async (pageIndex = agendaPage) => {
    setIsLoadingAgenda(pageIndex === 0)
    try {
      const now = new Date()
      let startStr = ''
      let endStr = ''

      if (agendaFilter === 'today') {
        startStr = startOfDay(now).toISOString()
        endStr = endOfDay(now).toISOString()
      } else if (agendaFilter === 'week') {
        startStr = startOfWeek(now, { weekStartsOn: 0 }).toISOString()
        endStr = endOfWeek(now, { weekStartsOn: 0 }).toISOString()
      } else if (agendaFilter === 'future') {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        startStr = startOfDay(tomorrow).toISOString()
        // Fetch up to 90 days ahead
        const futureLimit = new Date(now)
        futureLimit.setDate(futureLimit.getDate() + 90)
        endStr = endOfDay(futureLimit).toISOString()
      } else if (agendaFilter === 'past') {
        const [y, m] = historyMonth.split('-').map(Number)
        const selectedDate = new Date(y, m - 1, 1)
        startStr = startOfMonth(selectedDate).toISOString()
        endStr = endOfMonth(selectedDate).toISOString()
      }

      const from = pageIndex * 50
      const to = from + 49

      const { data, count, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (name, price, duration_minutes),
          profiles:client_id (id, full_name, created_at, phone),
          barbers (name)
        `, { count: 'exact' })
        .gte('start_time', startStr)
        .lte('start_time', endStr)
        .order('start_time', { ascending: agendaFilter !== 'past' })
        .range(from, to)

      if (error) throw error
      
      if (pageIndex === 0) setAgendaBookings(data || [])
      else setAgendaBookings(prev => [...prev, ...(data || [])])
      
      setHasMoreAgenda(count !== null && count > to + 1)
    } catch (error: any) {
      console.error("Erro ao buscar agenda:", error.message)
    } finally {
      setIsLoadingAgenda(false)
    }
  }

  const loadMoreAgenda = () => {
    const nextPage = agendaPage + 1
    setAgendaPage(nextPage)
    fetchAgenda(nextPage)
  }

  const handleOpenBookingDetails = async (booking: any) => {
    if (selectedBooking?.id === booking.id) {
       setSelectedBooking(null)
       return
    }
    setSelectedBooking(booking)
    setSelectedClientDetails(null)

    if (!booking.profiles?.id) {
       setSelectedClientDetails({
         totalCuts: 'N/A (Walk-in)',
         registeredSince: 'N/A',
         totalSpent: 'R$ ' + (booking.services?.price || 0)
       })
       return
    }

    try {
      const { data: pastBookings, error } = await supabase
        .from('bookings')
        .select(`status, services(price)`)
        .eq('client_id', booking.profiles.id)
        .eq('status', 'confirmed')
        
      if (!error && pastBookings) {
        const totalSpent = pastBookings.reduce((acc: number, curr: any) => acc + (Number(curr.services?.price) || 0), 0)
        setSelectedClientDetails({
          totalCuts: pastBookings.length || 0,
          registeredSince: booking.profiles.created_at 
            ? format(parseISO(booking.profiles.created_at), "MMM yyyy", { locale: ptBR })
            : 'Desconhecido',
          totalSpent: 'R$ ' + totalSpent.toFixed(2).replace('.', ',')
        })
      }
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err)
    }
  }

  const handleCancelAgendaBooking = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // prevent opening details
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return

    try {
      const { error } = await supabase.from('bookings').update({ status: 'canceled' }).eq('id', id)
      if (error) throw error
      setAgendaBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'canceled' } : b))
      if (selectedBooking?.id === id) setSelectedBooking(null)
    } catch (err: any) {
      alert("Erro ao cancelar: " + err.message)
    }
  }

  // --- SERVICES LOGIC ---
  const fetchServices = async () => {
    const empresaId = profile?.empresa_id
    if (!empresaId) return
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('name')
    if (data) setServices(data)
  }

  const handleEditService = (service: any) => {
    setIsCreatingService(true)
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration_minutes.toString(),
      description: service.description || '',
      image_url: service.image_url || ''
    })
    setServiceImageFile(null)
  }

  const handleSaveService = async () => {
    if (!serviceForm.name || !serviceForm.price || !serviceForm.duration) {
      alert("Preencha nome, preço e duração.")
      return
    }
    setIsSavingService(true)
    try {
      let imageUrl = serviceForm.image_url

      if (serviceImageFile) {
        const fileExt = serviceImageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('services').upload(fileName, serviceImageFile)
        if (uploadError) throw new Error("Erro upload: " + uploadError.message)
        const { data: urlData } = supabase.storage.from('services').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      const payload = {
        name: serviceForm.name,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration, 10),
        description: serviceForm.description,
        image_url: imageUrl,
        empresa_id: profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b"
      }

      if (editingServiceId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingServiceId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('services').insert(payload)
        if (error) throw error
      }

      setIsCreatingService(false)
      setEditingServiceId(null)
      setServiceForm({ name: '', price: '', duration: '', description: '', image_url: '' })
      setServiceImageFile(null)
      fetchServices()
      alert("Serviço salvo com sucesso!")
    } catch (err: any) {
      alert("Erro ao salvar serviço: " + err.message)
    } finally {
      setIsSavingService(false)
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return
    try {
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
      fetchServices()
      alert("Serviço excluído com sucesso!")
    } catch (err: any) {
      alert("Erro ao excluir serviço: " + err.message)
    }
  }

  // --- BARBERS LOGIC ---
  const fetchBarbers = async () => {
    const empresaId = profile?.empresa_id
    if (!empresaId) return
    const { data } = await supabase
      .from('barbers')
      .select('*, barber_services(service_id)')
      .eq('empresa_id', empresaId)
      .order('name')
    if (data) setBarbersList(data)
  }

  const handleEditBarber = (barber: any) => {
    setIsCreatingBarber(true)
    setEditingBarberId(barber.id)
    setBarberForm({
      name: barber.name,
      active: barber.active !== false,
      selectedServices: barber.barber_services?.map((bs: any) => bs.service_id) || [],
      photo_url: barber.photo_url || ''
    })
    setBarberImageFile(null)
  }

  const handleSaveBarber = async () => {
    if (!barberForm.name) return alert("Preencha o nome do barbeiro.")
    setIsSavingBarber(true)
    try {
      let imageUrl = barberForm.photo_url

      if (barberImageFile) {
        const fileExt = barberImageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('barbers').upload(fileName, barberImageFile)
        if (uploadError) {
          console.warn("Upload barbers image error (bucket may not exist):", uploadError.message)
          // continuing without image if bucket doesn't exist
        } else {
          const { data: urlData } = supabase.storage.from('barbers').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }

      const payload = { 
        name: barberForm.name, 
        active: barberForm.active,
        photo_url: imageUrl,
        empresa_id: profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b"
      }
      
      let barberId = editingBarberId

      if (editingBarberId) {
        const { error } = await supabase.from('barbers').update(payload).eq('id', editingBarberId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('barbers').insert(payload).select().single()
        if (error) throw error
        barberId = data.id
      }

      // Link services
      if (barberId) {
        await supabase.from('barber_services').delete().eq('barber_id', barberId)
        if (barberForm.selectedServices.length > 0) {
          const links = barberForm.selectedServices.map(sid => ({ barber_id: barberId, service_id: sid }))
          await supabase.from('barber_services').insert(links)
        }
      }

      setIsCreatingBarber(false)
      setEditingBarberId(null)
      setBarberForm({ name: '', active: true, selectedServices: [], photo_url: '' })
      setBarberImageFile(null)
      fetchBarbers()
      alert("Barbeiro salvo com sucesso! Se a imagem não subiu, verifique se criou o bucket 'barbers' PÚBLICO no Supabase.")
    } catch (err: any) {
      alert("Erro ao salvar barbeiro: " + err.message)
    } finally {
      setIsSavingBarber(false)
    }
  }

  const handleDeleteBarber = async (id: string) => {
    if (!confirm("Apagar barbeiro?")) return
    await supabase.from('barbers').delete().eq('id', id)
    fetchBarbers()
  }

  const toggleServiceForBarber = (serviceId: string) => {
    setBarberForm(prev => {
      const s = new Set(prev.selectedServices)
      if (s.has(serviceId)) s.delete(serviceId)
      else s.add(serviceId)
      return { ...prev, selectedServices: Array.from(s) }
    })
  }

  // --- CONFIG LOGIC ---
  const fetchConfig = async () => {
    const empresaId = profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b"
    const { data } = await supabase
      .from('business_config')
      .select('*')
      .eq('empresa_id', empresaId)
      .limit(1)
      .single()
    if (data) setConfig(data)
  }

  const handleSaveConfig = async () => {
    setIsSavingConfig(true)
    try {
      const payload: any = {
        open_time: config.open_time || '09:00',
        close_time: config.close_time || '19:00',
        open_days: config.open_days || [1,2,3,4,5,6],
        closed_dates: config.closed_dates || [],
        cancel_limit_hours: config.cancel_limit_hours ?? 2
      }
      
      if (!config.id) {
        payload.empresa_id = profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b"
        const { data, error } = await supabase.from('business_config').insert(payload).select().single()
        if (error) {
          if (error.message.includes('closed_dates')) {
            throw new Error("A coluna 'closed_dates' não existe na tabela 'business_config'. Execute o comando SQL fornecido.")
          }
          throw error
        }
        setConfig(data)
      } else {
        const { error } = await supabase.from('business_config')
          .update(payload)
          .eq('id', config.id)
        if (error) {
          if (error.message.includes('closed_dates')) {
            throw new Error("A coluna 'closed_dates' não existe na tabela 'business_config'. Execute o comando SQL fornecido.")
          }
          throw error
        }
      }
      alert("Configurações salvas!")
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message)
    } finally {
      setIsSavingConfig(false)
    }
  }

  const toggleDay = (day: number) => {
    setConfig((prev: any) => {
      const current = new Set(prev.open_days || [])
      if (current.has(day)) current.delete(day)
      else current.add(day)
      return { ...prev, open_days: Array.from(current).sort() }
    })
  }

  const addClosedDate = (date: string) => {
    if (!date) return
    setConfig((prev: any) => {
      const dates = new Set(prev.closed_dates || [])
      dates.add(date)
      return { ...prev, closed_dates: Array.from(dates).sort() }
    })
  }

  const removeClosedDate = (dateToRemove: string) => {
    setConfig((prev: any) => {
      const dates = (prev.closed_dates || []).filter((d: string) => d !== dateToRemove)
      return { ...prev, closed_dates: dates }
    })
  }

  // --- QUICK BOOKING LOGIC ---
  useEffect(() => {
    if (quickDate) fetchOccupiedSlots()
    else setOccupiedSlots([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, quickBarberId])

  const fetchOccupiedSlots = async () => {
    const [year, month, day] = quickDate.split('-').map(Number)
    const startOfDayStr = new Date(year, month - 1, day, 0, 0, 0).toISOString()
    const endOfDayStr = new Date(year, month - 1, day, 23, 59, 59).toISOString()

    let query = supabase.from('bookings').select('start_time, service_id').gte('start_time', startOfDayStr).lte('start_time', endOfDayStr).neq('status', 'canceled')
    if (quickBarberId) query = query.eq('barber_id', quickBarberId)
      
    const { data: bookings } = await query
    if (!bookings || bookings.length === 0) return setOccupiedSlots([])

    const serviceIds = [...new Set(bookings.map((b: any) => b.service_id).filter(Boolean))]
    const durationMap: Record<string, number> = {}

    if (serviceIds.length > 0) {
      const { data: svcData } = await supabase.from('services').select('id, duration_minutes').in('id', serviceIds)
      if (svcData) svcData.forEach((s: any) => { durationMap[s.id] = s.duration_minutes })
    }

    const blocked = new Set<string>()
    bookings.forEach((b: any) => {
      const start = new Date(b.start_time)
      const duration = durationMap[b.service_id] ?? 30
      const end = new Date(start.getTime() + duration * 60 * 1000)

      let cursor = new Date(start)
      while (cursor < end) {
        const hh = cursor.getHours().toString().padStart(2, '0')
        const mm = cursor.getMinutes().toString().padStart(2, '0')
        blocked.add(`${hh}:${mm}`)
        cursor = new Date(cursor.getTime() + 30 * 60 * 1000)
      }
    })
    setOccupiedSlots(Array.from(blocked))
  }

  const generateQuickTimeSlots = () => {
    const slots = []
    let startHour = 9
    let endHour = 19
    let startMin = 0

    if (config?.open_time && config?.close_time) {
       const [openH, openM] = config.open_time.split(':').map(Number)
       const [closeH, closeM] = config.close_time.split(':').map(Number)
       startHour = openH
       endHour = closeH
       startMin = openM
    }

    let cursorH = startHour
    let cursorM = startMin

    const now = new Date()
    const isToday = quickDate === format(now, 'yyyy-MM-dd')
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()

    while (cursorH < endHour || (cursorH === endHour && cursorM === 0)) {
      const slotStr = `${cursorH.toString().padStart(2, '0')}:${cursorM.toString().padStart(2, '0')}`
      
      let isValidSlot = true
      if (isToday) {
        const slotTotalMinutes = cursorH * 60 + cursorM
        if (slotTotalMinutes < currentTotalMinutes + 30) {
          isValidSlot = false
        }
      }

      if (isValidSlot) {
        slots.push(slotStr)
      }

      cursorM += 30
      if (cursorM >= 60) {
        cursorM -= 60
        cursorH += 1
      }
    }
    return slots
  }

  const handleConfirmQuickBooking = async () => {
    if (!quickName || !quickServiceId || !quickDate || !quickTime) {
      return alert("Preencha Nome, Serviço, Data e Horário.")
    }

    setIsQuickBooking(true)
    try {
      const [year, month, day] = quickDate.split('-').map(Number)
      const [hours, minutes] = quickTime.split(':').map(Number)
      const bookingDate = new Date(year, month - 1, day, hours, minutes)

      // 1. Fetch Service details to calculate end_time and get names for webhook
      const { data: svcData } = await supabase.from('services').select('name, duration_minutes').eq('id', quickServiceId).single()
      const duration = svcData?.duration_minutes || 30
      const serviceName = svcData?.name || 'Serviço'
      
      const endTime = new Date(bookingDate.getTime() + duration * 60000)

      const payload: any = {
        client_id: user?.id,
        service_id: quickServiceId,
        start_time: bookingDate.toISOString(),
        end_time: endTime.toISOString(),
        empresa_id: profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b",
        status: 'confirmed',
        guest_name: quickName,        
        guest_phone: quickPhone || null
      }
      if (quickBarberId) payload.barber_id = quickBarberId

      const { data: newBooking, error } = await supabase.from('bookings').insert(payload).select().single()
      if (error) throw error

      // 2. Dispatch the WhatsApp Webhook if instance is configured
      if (config?.evolution_instance_id && quickPhone) {
        let barberName = 'Barbeiro'
        if (quickBarberId) {
          const { data: barbData } = await supabase.from('barbers').select('name').eq('id', quickBarberId).single()
          if (barbData) barberName = barbData.name
        }

        const webhookPayload = {
          event: "novo_agendamento",
          instanceName: config.evolution_instance_id,
          apikey_id: config.apikey_id,
          phone: quickPhone,
          clientName: quickName,
          serviceName: serviceName,
          barberName: barberName,
          bookingDate: bookingDate.toLocaleDateString('pt-BR'),
          bookingTime: quickTime
        }

        // Fire & Forget webhook
        fetch('https://n8n.mundoai.com.br/webhook/novo-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        }).catch(err => console.error("Erro ao notificar webhook whatsapp:", err))
      }

      alert("Encaixe confirmado com sucesso!")
      setQuickName(''); setQuickPhone(''); setQuickServiceId(''); setQuickBarberId(''); setQuickDate(''); setQuickTime('')
      setActiveTab('agenda')
    } catch (error: any) {
      alert("Erro no agendamento: " + error.message)
    } finally {
      setIsQuickBooking(false)
    }
  }

  // --- CLIENTS LOGIC ---
  const fetchClients = async (pageIndex = clientsPage, search = clientsSearch) => {
    setIsClientsLoading(pageIndex === 0)
    const from = pageIndex * 50
    const to = from + 49
    const empresaId = profile?.empresa_id
    
    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('full_name', { ascending: true })
    
    if (empresaId) query = query.eq('empresa_id', empresaId)
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    
    const { data, count, error } = await query.range(from, to)

    
    if (data && !error) {
      if (pageIndex === 0) setClientsList(data)
      else setClientsList(prev => [...prev, ...data])
      
      setHasMoreClients(count !== null && count > to + 1)
    }
    setIsClientsLoading(false)
  }

  const loadMoreClients = () => {
    const nextPage = clientsPage + 1
    setClientsPage(nextPage)
    fetchClients(nextPage)
  }

  // --- METRICS LOGIC ---
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsData, setMetricsData] = useState<any>({ daily: [], monthly: [], topServices: [], summary: {}, compSummary: {} })
  const [metricDateStart, setMetricDateStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [metricDateEnd, setMetricDateEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [metricCompare, setMetricCompare] = useState(true)
  const [metricPreset, setMetricPreset] = useState<string>('month')

  const applyMetricPreset = (preset: string) => {
    const now = new Date()
    setMetricPreset(preset)
    switch (preset) {
      case '7d':
        setMetricDateStart(format(subDays(now, 6), 'yyyy-MM-dd'))
        setMetricDateEnd(format(now, 'yyyy-MM-dd'))
        break
      case '30d':
        setMetricDateStart(format(subDays(now, 29), 'yyyy-MM-dd'))
        setMetricDateEnd(format(now, 'yyyy-MM-dd'))
        break
      case 'month':
        setMetricDateStart(format(startOfMonth(now), 'yyyy-MM-dd'))
        setMetricDateEnd(format(now, 'yyyy-MM-dd'))
        break
      case 'lastMonth': {
        const lm = subMonths(now, 1)
        setMetricDateStart(format(startOfMonth(lm), 'yyyy-MM-dd'))
        setMetricDateEnd(format(endOfMonth(lm), 'yyyy-MM-dd'))
        break
      }
      case '6m':
        setMetricDateStart(format(subMonths(now, 5), 'yyyy-MM-dd'))
        setMetricDateEnd(format(now, 'yyyy-MM-dd'))
        break
    }
  }

  useEffect(() => {
    if (activeTab === 'metrics' && metricDateStart && metricDateEnd) {
      fetchMetrics()
    }
  }, [activeTab, metricDateStart, metricDateEnd, metricCompare])

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const [sY, sM, sD] = metricDateStart.split('-').map(Number)
      const [eY, eM, eD] = metricDateEnd.split('-').map(Number)
      const rangeStart = startOfDay(new Date(sY, sM - 1, sD))
      const rangeEnd = endOfDay(new Date(eY, eM - 1, eD))
      const rangeDays = differenceInDays(rangeEnd, rangeStart) + 1

      // Calculate comparison period (same duration, immediately before)
      const compEnd = subDays(rangeStart, 1)
      const compStart = subDays(compEnd, rangeDays - 1)

      // Fetch all bookings for both periods at once
      const fetchStart = metricCompare ? startOfDay(compStart) : rangeStart

      const { data: allBookings, error } = await supabase
        .from('bookings')
        .select('start_time, status, service_id, services(name, price)')
        .gte('start_time', fetchStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())

      if (error) throw error

      const bookings = allBookings || []

      // Split into current and comparison periods
      const currentBookings = bookings.filter((b: any) => {
        const d = parseISO(b.start_time)
        return isWithinInterval(d, { start: rangeStart, end: rangeEnd })
      })
      const compBookings = metricCompare ? bookings.filter((b: any) => {
        const d = parseISO(b.start_time)
        return isWithinInterval(d, { start: startOfDay(compStart), end: endOfDay(compEnd) })
      }) : []

      const confirmed = currentBookings.filter((b: any) => b.status === 'confirmed')
      const canceled = currentBookings.filter((b: any) => b.status === 'canceled')
      const compConfirmed = compBookings.filter((b: any) => b.status === 'confirmed')

      // KPIs
      const totalRev = confirmed.reduce((s: number, b: any) => s + (Number(b.services?.price) || 0), 0)
      const totalBookingsCount = confirmed.length
      const canceledCount = canceled.length
      const totalAll = currentBookings.length
      const cancelRate = totalAll > 0 ? (canceledCount / totalAll) * 100 : 0
      const ticketMedio = totalBookingsCount > 0 ? totalRev / totalBookingsCount : 0

      // Comparison KPIs
      const compRev = compConfirmed.reduce((s: number, b: any) => s + (Number(b.services?.price) || 0), 0)
      const compBookingsCount = compConfirmed.length
      const compTicket = compBookingsCount > 0 ? compRev / compBookingsCount : 0
      const compCancelRate = compBookings.length > 0 ? (compBookings.filter((b: any) => b.status === 'canceled').length / compBookings.length) * 100 : 0

      const pct = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev * 100) : (curr > 0 ? 100 : 0)

      // Top services
      const svcMap: Record<string, { name: string; count: number; revenue: number }> = {}
      confirmed.forEach((b: any) => {
        const key = b.service_id || 'unknown'
        if (!svcMap[key]) svcMap[key] = { name: b.services?.name || 'Desconhecido', count: 0, revenue: 0 }
        svcMap[key].count++
        svcMap[key].revenue += Number(b.services?.price) || 0
      })
      const topServices = Object.values(svcMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6)
        .map(s => ({ name: s.name, Receita: s.revenue, Agendamentos: s.count }))

      const topServiceName = topServices.length > 0 ? topServices[0].name : 'N/A'

      // Daily chart data (current period)
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
      const dailyData = days.map(day => {
        const dayBookings = confirmed.filter((b: any) => isSameDay(parseISO(b.start_time), day))
        const revenue = dayBookings.reduce((sum: number, b: any) => sum + (Number(b.services?.price) || 0), 0)
        return {
          name: rangeDays <= 14
            ? format(day, 'EEE dd', { locale: ptBR })
            : format(day, 'dd/MM', { locale: ptBR }),
          Receita: revenue,
          Agendamentos: dayBookings.length,
        }
      })

      // Monthly chart data (if range > 31 days)
      const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
      const monthlyData = months.length > 1
        ? months.map(month => {
            const monthStr = format(month, 'yyyy-MM')
            const monthBookings = confirmed.filter((b: any) => b.start_time.startsWith(monthStr))
            const revenue = monthBookings.reduce((sum: number, b: any) => sum + (Number(b.services?.price) || 0), 0)
            return {
              name: format(month, 'MMM yy', { locale: ptBR }),
              Receita: revenue,
              Agendamentos: monthBookings.length,
            }
          })
        : []

      setMetricsData({
        daily: dailyData,
        monthly: monthlyData,
        topServices,
        summary: {
          totalRevenue: totalRev,
          totalBookings: totalBookingsCount,
          ticketMedio,
          cancelRate,
          topService: topServiceName,
          revGrowth: pct(totalRev, compRev).toFixed(1),
          bookGrowth: pct(totalBookingsCount, compBookingsCount).toFixed(1),
          ticketGrowth: pct(ticketMedio, compTicket).toFixed(1),
          cancelGrowth: (cancelRate - compCancelRate).toFixed(1),
        },
      })
    } catch (err: any) {
      console.error('Erro ao buscar métricas:', err.message)
    } finally {
      setMetricsLoading(false)
    }
  }

  // --- LOGOUT ---
  const handleLogout = async () => {
    try { await supabase.auth.signOut() } catch (e) {} 
    finally { logout(); window.location.href = '/' }
  }

  // --- WHATSAPP LOGIC ---
  // Helper: get WhatsApp config directly from DB (avoids race with config state)
  const getWaConfig = async () => {
    const empresaId = profile?.empresa_id || "a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b"
    const { data } = await supabase
      .from('business_config')
      .select('evolution_instance_id, apikey_id')
      .eq('empresa_id', empresaId)
      .limit(1)
      .single()
    return data
  }

  const handleWaFetchInstances = async () => {
    setWaLoading('fetch')
    setWaError(null)
    setWaQrCode(null)
    setWaConnectingInstance(null)
    try {
      const waConfig = await getWaConfig()
      const instanceId = waConfig?.evolution_instance_id || waConfig?.apikey_id
      if (!instanceId) throw new Error('Instância do WhatsApp não configurada. Preencha o campo "evolution_instance_id" nas Configurações.')

      const res = await fetch(`https://n8n.mundoai.com.br/webhook/instancia?instance=${instanceId}&apikey=${waConfig?.apikey_id || ''}`)
      if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
      const payload = await res.json()
      
      let list = []
      if (payload.success && Array.isArray(payload.data)) {
        list = payload.data
      } else if (Array.isArray(payload)) {
        list = payload
      } else {
        list = [payload]
      }

      const normalized = list.map((item: any) => ({
        instanceName: item.instanceName || item.instance?.instanceName || item.name || 'Desconhecido',
        state: (item.state || item.instance?.state || item.status || item.connectionStatus || 'unknown').toLowerCase(),
        ...item,
      }))
      
      setWaInstances(normalized)
      setWaLastUpdated(new Date())
    } catch (err: any) {
      setWaError(err.message || 'Erro ao consultar instâncias.')
      setWaInstances([])
    } finally {
      setWaLoading(null)
    }
  }

  const handleWaConnect = async (instanceName?: string) => {
    setWaLoading('connect')
    setWaError(null)
    setWaQrCode(null)
    try {
      const waConfig = await getWaConfig()
      const instanceId = waConfig?.evolution_instance_id || waConfig?.apikey_id
      if (!instanceId) throw new Error('Instância não configurada.')

      const payload = { 
        instanceName: instanceId, 
        apikey_id: waConfig?.apikey_id 
      }
      const res = await fetch('https://n8n.mundoai.com.br/webhook/conectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('image')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setWaQrCode(url)
      } else {
        const data = await res.json()
        const qrBase64 = data.qrcode || data.qr || data.base64 || (data.data && data.data.qrcode) || (data.data && data.data.base64)
        if (qrBase64) {
          const src = qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`
          setWaQrCode(src)
        } else {
          await handleWaFetchInstances()
        }
      }
    } catch (err: any) {
      setWaError(err.message || 'Erro ao conectar.')
    } finally {
      setWaLoading(null)
    }
  }

  const handleWaDisconnect = async (instanceName?: string) => {
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return
    setWaLoading('disconnect')
    setWaError(null)
    setWaQrCode(null)
    setWaConnectingInstance(null)
    try {
      const waConfig = await getWaConfig()
      const instanceId = waConfig?.evolution_instance_id || waConfig?.apikey_id
      if (!instanceId) throw new Error('Instância não configurada.')

      const payload = { 
        instanceName: instanceId, 
        apikey_id: waConfig?.apikey_id 
      }
      const res = await fetch('https://n8n.mundoai.com.br/webhook/desconectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
      await res.json()
      await handleWaFetchInstances()
    } catch (err: any) {
      setWaError(err.message || 'Erro ao desconectar.')
    } finally {
      setWaLoading(null)
    }
  }

  const getWaTimeSinceUpdate = () => {
    if (!waLastUpdated) return ''
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - waLastUpdated.getTime()) / 1000)
    if (diffSec < 5) return 'Atualizado agora'
    if (diffSec < 60) return `Atualizado há ${diffSec}s`
    const diffMin = Math.floor(diffSec / 60)
    return `Atualizado há ${diffMin}min`
  }

  // --- METRICS STATE ---

  useEffect(() => {
    if (!authLoading && (!user || (profile?.role !== 'admin' && profile?.role !== 'admin-barbearia' && profile?.role !== 'admin-styllus'))) {
      router.push('/')
    }
  }, [authLoading, user, profile, router])

  if (authLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando...</div>
  }
  if (!user || (profile?.role !== 'admin' && profile?.role !== 'admin-barbearia' && profile?.role !== 'admin-styllus')) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Acesso negado. Redirecionando...</div>
  }

  const NAV_ITEMS = [
    { id: 'agenda', icon: Calendar, label: 'Agenda Geral' },
    { id: 'quick', icon: Plus, label: 'Agendar Manual' },
    { id: 'clients', icon: UserIcon, label: 'Clientes' },
    { id: 'barbers', icon: Users, label: 'Colaboradores' },
    { id: 'services', icon: Scissors, label: 'Serviços' },
    { id: 'config', icon: Settings, label: 'Configurações' },
    { id: 'metrics', icon: BarChart3, label: 'Métricas' },
    { id: 'whatsapp', icon: Smartphone, label: 'WhatsApp' },
  ] as const

  return (
    <div className="min-h-screen flex bg-black">
      {/* SIDEBAR PC */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white tracking-tight"><span className="text-red-500">Painel</span>Styllus</h2>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          {NAV_ITEMS.map(item => (
            <Button key={item.id} variant={activeTab === item.id ? 'default' : 'ghost'} className="justify-start shadow-none" onClick={() => setActiveTab(item.id)}>
              <item.icon className="w-4 h-4 mr-3" /> {item.label}
            </Button>
          ))}
          <Button variant="ghost" className="justify-start shadow-none text-zinc-500 hover:text-red-500 mt-auto" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-3" /> Sair
          </Button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* MOBILE HEADER */}
        <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex justify-between items-center md:hidden shrink-0 z-20 relative">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-zinc-400 hover:text-white">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg font-bold text-white"><span className="text-red-500">Painel</span>Styllus</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5 text-zinc-400" />
          </Button>
        </header>

        {/* MOBILE SIDEBAR DROPDOWN */}
        {isMobileMenuOpen && (
          <div className="absolute top-[60px] left-0 right-0 bg-zinc-950 border-b border-zinc-800 z-30 p-2 flex flex-col gap-1 md:hidden shadow-2xl">
            {NAV_ITEMS.map(item => (
              <Button key={item.id} variant={activeTab === item.id ? 'default' : 'ghost'} className="justify-start" onClick={() => {setActiveTab(item.id); setIsMobileMenuOpen(false)}}>
                 <item.icon className="w-4 h-4 mr-3" /> {item.label}
              </Button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 text-white">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* AGENDA TAB */}
            {activeTab === 'agenda' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold">Gestão de Agenda</h2>
                  <div className="w-full sm:w-auto grid grid-cols-2 sm:flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1 sm:gap-0">
                    <button className={`w-full text-center px-2 py-1.5 text-sm rounded-md font-medium transition-colors ${agendaFilter === 'today' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`} onClick={() => setAgendaFilter('today')}>Hoje</button>
                    <button className={`w-full text-center px-2 py-1.5 text-sm rounded-md font-medium transition-colors ${agendaFilter === 'week' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`} onClick={() => setAgendaFilter('week')}>Semana</button>
                    <button className={`w-full text-center px-2 py-1.5 text-sm rounded-md font-medium transition-colors ${agendaFilter === 'future' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`} onClick={() => setAgendaFilter('future')}>Futuros</button>
                    <button className={`w-full text-center px-2 py-1.5 text-sm rounded-md font-medium transition-colors ${agendaFilter === 'past' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`} onClick={() => setAgendaFilter('past')}>Histórico</button>
                  </div>
                </div>

                {agendaFilter === 'past' && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-zinc-400 whitespace-nowrap">Selecione o Mês:</Label>
                    <select 
                      className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-red-500"
                      value={historyMonth}
                      onChange={(e) => setHistoryMonth(e.target.value)}
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const d = subMonths(new Date(), i)
                        return (
                          <option key={i} value={format(d, 'yyyy-MM')}>
                            {format(d, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}

                {isLoadingAgenda ? <p className="text-zinc-500">Carregando...</p> : agendaBookings.length === 0 ? (
                  <div className="text-center py-12 border border-zinc-800 rounded-2xl bg-zinc-900/30">
                    <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">Nenhum agendamento encontrado.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {agendaBookings.map(booking => {
                      const bDate = parseISO(booking.start_time)
                      const isSelected = selectedBooking?.id === booking.id
                      const isActive = booking.status === 'confirmed'
                      // group by days visually when looking at 'week' or 'past' ? 
                      // Simple approach: just show date in card if not today
                      
                      return (
                        <div key={booking.id}>
                          <Card 
                            className={`cursor-pointer transition-colors border-zinc-800 hover:bg-zinc-900/80 ${isSelected ? 'bg-zinc-900 ring-1 ring-zinc-700' : 'bg-zinc-950/50'} ${!isActive && 'opacity-60'}`}
                            onClick={() => handleOpenBookingDetails(booking)}
                          >
                            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="flex items-center gap-4">
                                <div className="bg-zinc-900 rounded-lg p-3 text-center min-w-[80px]">
                                  {agendaFilter !== 'today' && <p className="text-xs text-zinc-500 uppercase">{format(bDate, 'dd MMM')}</p>}
                                  <p className="text-xl font-bold text-white">{format(bDate, 'HH:mm')}</p>
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-lg">
                                    {booking.guest_name ? booking.guest_name : (booking.profiles?.full_name || 'Desconhecido')}
                                  </h4>
                                  <div className="text-zinc-400 text-sm flex flex-col gap-1 mt-1">
                                    <span className="flex items-center gap-2">
                                      <Scissors className="w-3 h-3" /> {booking.services?.name}
                                    </span>
                                    {booking.barbers?.name && (
                                      <span className="flex items-center gap-2 text-xs text-zinc-500">
                                        <UserIcon className="w-3 h-3" /> {booking.barbers.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end">
                                <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {isActive ? 'Confirmado' : 'Cancelado'}
                                </span>
                                {isActive && (
                                  <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10 h-8" onClick={(e) => handleCancelAgendaBooking(e, booking.id)}>
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                          
                          {/* Expanded Details */}
                          {isSelected && (
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-b-xl -mt-2 pt-6 pb-4 px-6 mb-4 animate-in slide-in-from-top-2">
                              {selectedClientDetails ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                  <div>
                                    <p className="text-xs text-zinc-500 mb-1">Telefone</p>
                                    <p className="text-sm font-medium text-white flex items-center gap-2">
                                      <Phone className="w-3 h-3 text-zinc-400" /> {formatPhone(booking.guest_phone || booking.profiles?.phone) || 'Não informado'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-zinc-500 mb-1">Total de Cortes ({isActive ? 'Com este' : ''})</p>
                                    <p className="text-sm font-medium text-white">{selectedClientDetails.totalCuts}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-zinc-500 mb-1">Total Gasto na Barbearia</p>
                                    <p className="text-sm font-medium text-emerald-400">{selectedClientDetails.totalSpent}</p>
                                  </div>
                                  <div className="sm:col-span-3 pt-4 border-t border-zinc-800/50">
                                    <p className="text-xs text-zinc-500 mb-1">Cliente desde</p>
                                    <p className="text-sm font-medium text-white">{selectedClientDetails.registeredSince}</p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-500">Carregando detalhes do cliente...</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {hasMoreAgenda && agendaBookings.length > 0 && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={loadMoreAgenda} disabled={isLoadingAgenda} className="border-zinc-800 bg-zinc-950 text-white hover:bg-zinc-900 px-8">
                       {isLoadingAgenda ? 'Carregando...' : 'Carregar Mais'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* QUICK BOOKING */}
            {activeTab === 'quick' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Agendamento Manual</h2>
                  <p className="text-zinc-400 text-sm">Para clientes que chegam sem horário no aplicativo (Balcão).</p>
                </div>
                <Card className="border-zinc-800 bg-zinc-950/50">
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Cliente *</Label>
                        <Input placeholder="Ex: Carlos" value={quickName} onChange={e => setQuickName(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone / WhatsApp (Opcional)</Label>
                        <Input placeholder="(11) 99999-9999" value={quickPhone} onChange={e => setQuickPhone(maskPhoneInput(e.target.value))} className="bg-zinc-900 border-zinc-800" maxLength={15} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Serviço *</Label>
                        <select 
                          value={quickServiceId} 
                          onChange={e => setQuickServiceId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                        >
                          <option value="">Selecione...</option>
                          {services
                            .filter(s => barbersList.some((b: any) => b.active !== false && b.barber_services?.some((bs: any) => bs.service_id === s.id)))
                            .map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.price}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Barbeiro (Opcional)</Label>
                        <select 
                          value={quickBarberId} 
                          onChange={e => setQuickBarberId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                        >
                          <option value="">Qualquer Barbeiro...</option>
                          {barbersList.filter((b: any) => b.active !== false).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <div className="space-y-2 max-w-[200px]">
                        <Label className="flex items-center gap-2"><Calendar className="w-4 h-4 text-zinc-500" /> Data *</Label>
                        <Input 
                          type="date" 
                          min={format(new Date(), 'yyyy-MM-dd')} 
                          value={quickDate} 
                          onChange={e => {
                            const val = e.target.value
                            if (config?.closed_dates?.includes(val)) {
                              alert('A barbearia estará fechada nesta data.')
                              setQuickDate('')
                              return
                            }
                            if (val && config?.open_days) {
                               const [y, m, d] = val.split('-').map(Number)
                               const dayOfWeek = new Date(y, m - 1, d).getDay()
                               if (!config.open_days.includes(dayOfWeek)) {
                                  alert('A barbearia não abre neste dia da semana.')
                                  setQuickDate('')
                                  return
                               }
                            }
                            setQuickDate(val)
                          }} 
                          className="bg-zinc-900 border-zinc-800" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-500" /> Horário *</Label>
                        {!quickDate ? <p className="text-sm text-zinc-500 italic">Selecione uma data primeiro</p> : (
                          generateQuickTimeSlots().length === 0 ? (
                            <p className="text-sm text-red-500">Nenhum horário disponível para esta data hoje.</p>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                              {generateQuickTimeSlots().map(slot => {
                                const isOccupied = occupiedSlots.includes(slot)
                                return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => !isOccupied && setQuickTime(slot)}
                                  disabled={isOccupied}
                                  className={`py-2 text-sm rounded-lg border transition-all ${
                                    isOccupied
                                      ? 'bg-zinc-950 border-zinc-900 text-zinc-600 cursor-not-allowed opacity-50 line-through'
                                      : quickTime === slot
                                      ? 'bg-red-500 border-red-500 text-white font-medium'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                  }`}
                                >
                                  {slot}
                                </button>
                                )
                              })}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <Button className="w-full mt-4 bg-red-600 hover:bg-red-700" onClick={handleConfirmQuickBooking} disabled={isQuickBooking}>
                      {isQuickBooking ? 'Salvando...' : 'Confirmar Encaixe'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SERVICES GESTÃO */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Serviços Oferecidos</h2>
                    <p className="text-zinc-400 text-sm">Gerencie os cortes e os valores cobrados.</p>
                  </div>
                  {!isCreatingService && (
                    <Button onClick={() => { setIsCreatingService(true); setEditingServiceId(null); setServiceForm({name:'', price:'', duration:'', description:'', image_url:''}) }} className="bg-red-600 hover:bg-red-700 shrink-0">
                      <Plus className="w-4 h-4 mr-2" /> Novo Serviço
                    </Button>
                  )}
                </div>

                {isCreatingService && (
                  <Card className="border-zinc-700 bg-zinc-950 shadow-2xl relative overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <CardTitle>{editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsCreatingService(false)} className="h-8 w-8 hover:bg-zinc-800">
                          <X className="w-4 h-4 text-zinc-400" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nome do Serviço</Label>
                            <Input value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} className="bg-zinc-900 border-zinc-800" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Preço (R$)</Label>
                              <Input type="number" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: e.target.value})} className="bg-zinc-900 border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                              <Label>Duração (Minutos)</Label>
                              <Input type="number" value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: e.target.value})} className="bg-zinc-900 border-zinc-800" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <textarea 
                              className="flex w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 min-h-[80px]"
                              value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})}
                              placeholder="Detalhes sobre o serviço..."
                            />
                          </div>
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-4">
                          <Label>Imagem (Opcional, 1:1 Quadrada)</Label>
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors relative h-40">
                            <input 
                              type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                              onChange={(e) => { if(e.target.files && e.target.files[0]) setServiceImageFile(e.target.files[0]) }}
                            />
                            {serviceImageFile ? (
                              <div className="text-center font-medium text-emerald-500">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                                {serviceImageFile.name}
                              </div>
                            ) : serviceForm.image_url ? (
                              <div className="absolute inset-0 p-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={serviceForm.image_url} alt="Current Preview" className="w-full h-full object-contain rounded-lg" />
                              </div>
                            ) : (
                              <div className="text-center text-zinc-500">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <span className="text-sm">Clique para upload</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveService} disabled={isSavingService}>
                        {isSavingService ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Guardar Alterações</>}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map(service => (
                    <Card key={service.id} className="border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex gap-4">
                        {service.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={service.image_url} alt={service.name} className="w-20 h-20 rounded-lg object-cover bg-zinc-900 shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                            <Scissors className="w-8 h-8 text-zinc-700" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white truncate">{service.name}</h4>
                          <p className="text-sm text-zinc-400 mt-1 line-clamp-1">{service.description || 'Sem descrição'}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">R$ {service.price}</span>
                            <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {service.duration_minutes}m</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white bg-zinc-900" onClick={() => handleEditService(service)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500 bg-zinc-900" onClick={() => handleDeleteService(service.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* COLABORADORES (BARBERS) */}
            {activeTab === 'barbers' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Equipe de Barbeiros</h2>
                    <p className="text-zinc-400 text-sm">Gerencie os profissionais e os serviços que cada um realiza.</p>
                  </div>
                  {!isCreatingBarber && (
                    <Button onClick={() => { setIsCreatingBarber(true); setEditingBarberId(null); setBarberForm({name:'', active:true, selectedServices:[], photo_url: ''}); setBarberImageFile(null) }} className="bg-red-600 hover:bg-red-700 shrink-0">
                      <Plus className="w-4 h-4 mr-2" /> Novo Barbeiro
                    </Button>
                  )}
                </div>

                {isCreatingBarber && (
                  <Card className="border-zinc-700 bg-zinc-950">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <CardTitle>{editingBarberId ? 'Editar Colaborador' : 'Adicionar Colaborador'}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsCreatingBarber(false)} className="h-8 w-8 hover:bg-zinc-800">
                          <X className="w-4 h-4 text-zinc-400" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Nome do Profissional</Label>
                          <Input value={barberForm.name} onChange={e => setBarberForm({...barberForm, name: e.target.value})} className="bg-zinc-900 border-zinc-800" placeholder="Ex: João Ferreira" />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Foto do Perfil (1:1 Quadrada)</Label>
                          <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors relative h-20">
                            <input 
                              type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                              onChange={(e) => { if(e.target.files && e.target.files[0]) setBarberImageFile(e.target.files[0]) }}
                            />
                            {barberImageFile ? (
                              <div className="text-center font-medium text-emerald-500 flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                {barberImageFile.name}
                              </div>
                            ) : barberForm.photo_url ? (
                              <div className="absolute inset-0 p-1 flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={barberForm.photo_url} alt="Barber Preview" className="h-full object-contain rounded-full" />
                              </div>
                            ) : (
                              <div className="text-center text-zinc-500 flex flex-col items-center">
                                <ImageIcon className="w-4 h-4 mb-1 opacity-50" />
                                <span className="text-xs">Upload de Foto</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/50">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={barberForm.active} 
                            onChange={e => setBarberForm({...barberForm, active: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <span className={`text-sm font-medium ${barberForm.active ? 'text-emerald-400' : 'text-red-400'}`}>
                          {barberForm.active ? 'Ativo - Disponível para agendamentos' : 'Inativo - Não aparece para clientes'}
                        </span>
                      </div>

                      <div className="space-y-3 pt-2">
                        <Label>Serviços Realizados por este profissional</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {services.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => toggleServiceForBarber(s.id)}
                              className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${barberForm.selectedServices.includes(s.id) ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${barberForm.selectedServices.includes(s.id) ? 'bg-red-500 border-red-500' : 'border-zinc-600'}`}>
                                {barberForm.selectedServices.includes(s.id) && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm font-medium text-white line-clamp-1">{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveBarber} disabled={isSavingBarber}>
                        {isSavingBarber ? 'Salvando...' : 'Salvar Barbeiro'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {barbersList.map((barber: any) => (
                    <Card key={barber.id} className={`border-zinc-800 bg-zinc-950 p-5 ${!barber.active ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          {barber.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={barber.photo_url} alt={barber.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                              <UserIcon className="w-6 h-6 text-zinc-500" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-white text-lg">{barber.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${barber.active !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {barber.active !== false ? 'Ativo' : 'Inativo'}
                              </span>
                              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{barber.barber_services?.length || 0} Serviços</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => handleEditBarber(barber)} className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteBarber(barber.id)} className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {barbersList.length === 0 && !isCreatingBarber && (
                     <div className="col-span-full text-center p-8 border border-zinc-800 border-dashed rounded-xl">
                       <p className="text-zinc-500">Nenhum barbeiro cadastrado. Os agendamentos não exibirão escolha de profissional.</p>
                     </div>
                  )}
                </div>
              </div>
            )}

            {/* METRICS DASHBOARD */}
            {activeTab === 'metrics' && (
              <div className="space-y-6">
                {/* Header + Date Range Controls */}
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <BarChart3 className="w-6 h-6 text-red-500" /> Dashboard de Métricas
                    </h2>
                    <p className="text-zinc-400 text-sm">Acompanhe o desempenho financeiro e os agendamentos.</p>
                  </div>

                  {/* Date Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: '7d', label: '7 dias' },
                      { key: '30d', label: '30 dias' },
                      { key: 'month', label: 'Este Mês' },
                      { key: 'lastMonth', label: 'Mês Anterior' },
                      { key: '6m', label: '6 meses' },
                    ].map(p => (
                      <button
                        key={p.key}
                        onClick={() => applyMetricPreset(p.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          metricPreset === p.key
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Range + Compare Toggle */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500">De:</label>
                      <input
                        type="date"
                        value={metricDateStart}
                        onChange={e => { setMetricDateStart(e.target.value); setMetricPreset('custom') }}
                        className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500">Até:</label>
                      <input
                        type="date"
                        value={metricDateEnd}
                        onChange={e => { setMetricDateEnd(e.target.value); setMetricPreset('custom') }}
                        className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
                      <span className="text-xs text-zinc-400">Comparar período anterior</span>
                      <div
                        onClick={() => setMetricCompare(!metricCompare)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          metricCompare ? 'bg-red-600' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            metricCompare ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {metricsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      {/* Revenue */}
                      <Card className="border-zinc-800 bg-zinc-950 p-5 col-span-2 lg:col-span-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Receita</p>
                        <h3 className="text-2xl font-bold text-white mt-1">
                          R$ {(metricsData.summary.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        {metricCompare && (
                          <div className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-1.5 py-0.5 rounded ${
                            Number(metricsData.summary.revGrowth) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            <TrendingUp className={`w-3 h-3 ${Number(metricsData.summary.revGrowth) < 0 ? 'rotate-180' : ''}`} />
                            {metricsData.summary.revGrowth}%
                          </div>
                        )}
                      </Card>

                      {/* Bookings */}
                      <Card className="border-zinc-800 bg-zinc-950 p-5">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Agendamentos</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{metricsData.summary.totalBookings || 0}</h3>
                        {metricCompare && (
                          <div className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-1.5 py-0.5 rounded ${
                            Number(metricsData.summary.bookGrowth) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            <TrendingUp className={`w-3 h-3 ${Number(metricsData.summary.bookGrowth) < 0 ? 'rotate-180' : ''}`} />
                            {metricsData.summary.bookGrowth}%
                          </div>
                        )}
                      </Card>

                      {/* Ticket Médio */}
                      <Card className="border-zinc-800 bg-zinc-950 p-5">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Ticket Médio</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                          R$ {(metricsData.summary.ticketMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        {metricCompare && (
                          <div className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-1.5 py-0.5 rounded ${
                            Number(metricsData.summary.ticketGrowth) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            <TrendingUp className={`w-3 h-3 ${Number(metricsData.summary.ticketGrowth) < 0 ? 'rotate-180' : ''}`} />
                            {metricsData.summary.ticketGrowth}%
                          </div>
                        )}
                      </Card>

                      {/* Cancelamento */}
                      <Card className="border-zinc-800 bg-zinc-950 p-5">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Cancelamentos</p>
                        <h3 className="text-2xl font-bold text-orange-400 mt-1">
                          {(metricsData.summary.cancelRate || 0).toFixed(1)}%
                        </h3>
                        {metricCompare && (
                          <div className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-1.5 py-0.5 rounded ${
                            Number(metricsData.summary.cancelGrowth) <= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            <TrendingUp className={`w-3 h-3 ${Number(metricsData.summary.cancelGrowth) > 0 ? 'rotate-180' : ''}`} />
                            {Math.abs(Number(metricsData.summary.cancelGrowth))}pp
                          </div>
                        )}
                      </Card>

                      {/* Top Serviço */}
                      <Card className="border-zinc-800 bg-zinc-950 p-5">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Top Serviço</p>
                        <h3 className="text-lg font-bold text-white mt-1 truncate" title={metricsData.summary.topService}>
                          {metricsData.summary.topService || 'N/A'}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-2">Mais agendado</p>
                      </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Receita Diária (AreaChart) */}
                      <Card className="border-zinc-800 bg-zinc-950">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Receita Diária</CardTitle>
                          <CardDescription>Receita confirmada por dia no período selecionado</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div style={{ width: '100%', height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={metricsData.daily}>
                                <defs>
                                  <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                <RechartsTooltip
                                  cursor={{ stroke: '#71717a', strokeDasharray: '4 4' }}
                                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                  formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, 'Receita'] as any}
                                />
                                <Area type="monotone" dataKey="Receita" stroke="#ef4444" strokeWidth={2} fill="url(#gradRed)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Agendamentos Diários (Bar) */}
                      <Card className="border-zinc-800 bg-zinc-950">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Agendamentos por Dia</CardTitle>
                          <CardDescription>Volume de agendamentos confirmados</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div style={{ width: '100%', height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={metricsData.daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RechartsTooltip
                                  cursor={{ fill: '#27272a80' }}
                                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                />
                                <Bar dataKey="Agendamentos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Row 3: Top Services + Monthly Growth */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Services */}
                      {metricsData.topServices?.length > 0 && (
                        <Card className="border-zinc-800 bg-zinc-950">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Receita por Serviço</CardTitle>
                            <CardDescription>Serviços com maior faturamento no período</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div style={{ width: '100%', height: 280 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metricsData.topServices} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                  <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                  <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                    formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, 'Receita'] as any}
                                  />
                                  <Bar dataKey="Receita" fill="#10b981" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Monthly Growth (if multi-month range) */}
                      {metricsData.monthly?.length > 1 && (
                        <Card className="border-zinc-800 bg-zinc-950">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Crescimento Mensal</CardTitle>
                            <CardDescription>Receita e agendamentos por mês</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div style={{ width: '100%', height: 280 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metricsData.monthly}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                  />
                                  <Line type="monotone" dataKey="Agendamentos" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                                  <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CONFIGURAÇÕES */}
            {activeTab === 'config' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-2xl font-bold">Configurações do Negócio</h2>
                  <p className="text-zinc-400 text-sm">Defina os horários e informações globais do sistema.</p>
                </div>
                
                <Card className="border-zinc-800 bg-zinc-950">
                  <CardHeader>
                    <CardTitle>Horário de Funcionamento</CardTitle>
                    <CardDescription>Estes horários definem se o estabelecimento consta como Aberto ou Fechado no site.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Abertura (HH:MM)</Label>
                        <Input type="time" value={config?.open_time || '09:00'} onChange={e => setConfig({...config, open_time: e.target.value})} className="bg-zinc-900 border-zinc-800" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fechamento (HH:MM)</Label>
                        <Input type="time" value={config?.close_time || '19:00'} onChange={e => setConfig({...config, close_time: e.target.value})} className="bg-zinc-900 border-zinc-800" />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-zinc-800/50 pt-6">
                      <Label>Limite para Cancelamento (horas)</Label>
                      <p className="text-zinc-500 text-xs">Quantas horas antes do horário agendado o cliente ainda pode cancelar.</p>
                      <Input 
                        type="number" 
                        min="0" 
                        max="48" 
                        value={config?.cancel_limit_hours ?? 2} 
                        onChange={e => setConfig({...config, cancel_limit_hours: parseInt(e.target.value) || 0})} 
                        className="bg-zinc-900 border-zinc-800 w-32" 
                      />
                    </div>

                    <div className="space-y-3 border-t border-zinc-800/50 pt-6">
                      <Label>Dias de Funcionamento</Label>
                      <div className="flex flex-wrap gap-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, ix) => (
                          <button
                            key={ix}
                            onClick={() => toggleDay(ix)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              (config?.open_days || []).includes(ix) 
                                ? 'bg-red-600 border-red-500 text-white' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-zinc-800/50 pt-6">
                      <Label>Exceções (Dias Fechados)</Label>
                      <CardDescription>Adicione datas específicas onde a barbearia estará de folga/fechada, e horários não serão gerados.</CardDescription>
                      <div className="flex gap-2">
                        <Input 
                          type="date" 
                          id="new-closed-date"
                          min={format(new Date(), 'yyyy-MM-dd')}
                          className="bg-zinc-900 border-zinc-800" 
                        />
                        <Button 
                          type="button" 
                          className="bg-zinc-800 hover:bg-zinc-700" 
                          onClick={() => {
                            const input = document.getElementById('new-closed-date') as HTMLInputElement
                            addClosedDate(input.value)
                            input.value = ''
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(config?.closed_dates || []).map((dateStr: string) => (
                          <div key={dateStr} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-sm text-zinc-300">
                            {format(parseISO(dateStr), "dd/MM/yyyy")}
                            <button onClick={() => removeClosedDate(dateStr)} className="text-zinc-500 hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full mt-4 bg-red-600 hover:bg-red-700">
                      {isSavingConfig ? 'Salvando...' : 'Guardar Configurações'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ABA DE CLIENTES */}
            {activeTab === 'clients' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">Base de Clientes</h2>
                    <p className="text-zinc-400 text-sm">Gerencie todos os clientes cadastrados na plataforma.</p>
                  </div>
                </div>

                <div className="relative mb-6">
                  <Input 
                    type="text"
                    placeholder="Buscar cliente por nome ou email..."
                    value={clientsSearch}
                    onChange={(e) => setClientsSearch(e.target.value)}
                    className="w-full bg-zinc-900 border-zinc-800 text-white pl-4 rounded-xl"
                  />
                </div>

                {isClientsLoading ? (
                  <div className="flex justify-center items-center py-12">
                     <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clientsList.filter(c => c.full_name?.toLowerCase().includes(clientsSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientsSearch.toLowerCase())).map((client) => {
                      return (
                        <Card key={client.id} className="border-zinc-800 bg-zinc-950 p-5 hover:bg-zinc-900/80 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                               <UserIcon className="w-6 h-6 text-zinc-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white text-lg truncate capitalize">{client.full_name || 'Desconhecido'}</h4>
                              <p className="text-sm text-zinc-400 mt-1 truncate">{client.email}</p>
                              {client.phone && (
                                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-500" /> {formatPhone(client.phone)}
                                </p>
                              )}
                              <p className="text-[10px] text-zinc-600 mt-2">
                                Associado em {client.created_at ? format(parseISO(client.created_at), 'MMM yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                    {clientsList.length === 0 && (
                      <div className="col-span-full text-center p-8 border border-zinc-800 border-dashed rounded-xl">
                        <p className="text-zinc-500">Nenhum cliente cadastrado.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {hasMoreClients && clientsList.length > 0 && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={loadMoreClients} disabled={isClientsLoading} className="border-zinc-800 bg-zinc-950 text-white hover:bg-zinc-900 px-8">
                       {isClientsLoading ? 'Carregando...' : 'Carregar Mais'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ABA WHATSAPP - GERENCIADOR DE INSTÂNCIAS */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-800">
                  <h2 className="text-2xl font-bold text-white">Gerenciador de Instâncias</h2>
                  <div className="flex items-center gap-4 flex-wrap">
                    {waLastUpdated && (
                      <>
                        <span className="text-zinc-400 text-sm">
                          {format(waLastUpdated, "dd/MM/yyyy '•' HH:mm:ss")}
                        </span>
                        <span className="text-zinc-500 text-sm">{getWaTimeSinceUpdate()}</span>
                      </>
                    )}
                    <Button
                      onClick={handleWaFetchInstances}
                      disabled={waLoading === 'fetch'}
                      variant="outline"
                      className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${waLoading === 'fetch' ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {/* Error Banner */}
                {waError && (
                  <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{waError}</p>
                    <button onClick={() => setWaError(null)} className="ml-auto text-red-500 hover:text-red-300"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {/* Loading State */}
                {waLoading === 'fetch' && waInstances.length === 0 && (
                  <div className="flex justify-center items-center py-16">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Empty State */}
                {!waLoading && waInstances.length === 0 && !waError && waLastUpdated && (
                  <div className="text-center py-16 border border-zinc-800 rounded-2xl bg-zinc-900/30">
                    <Smartphone className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">Nenhuma instância encontrada.</p>
                  </div>
                )}

                {/* Instance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {waInstances.map((inst, idx) => {
                    const isOnline = inst.state === 'open' || inst.state === 'connected' || inst.state === 'online'
                    const isConnecting = waConnectingInstance === inst.instanceName
                    
                    return (
                      <div key={idx} className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-5 space-y-4 transition-colors hover:bg-zinc-900/90">
                        {/* Instance Header: Name + Status */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-lg">{inst.instanceName}</span>
                          <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                            isOnline ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400' : 'bg-red-500 shadow-[0_0_6px] shadow-red-500'}`} />
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>

                        {/* Action Button */}
                        {isOnline ? (
                          <Button
                            onClick={() => handleWaDisconnect(inst.instanceName)}
                            disabled={waLoading !== null}
                            variant="outline"
                            className="w-full border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:text-red-300"
                          >
                            {waLoading === 'disconnect' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Desconectando...</> : <><WifiOff className="w-4 h-4 mr-2" /> Desconectar Instância</>}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => { setWaConnectingInstance(inst.instanceName); handleWaConnect(inst.instanceName); }}
                            disabled={waLoading !== null}
                            className="w-full bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/30"
                          >
                            {(waLoading === 'connect' && isConnecting) ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando QR...</> : 'Conectar Instância'}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* QR Code Display */}
                {waQrCode && (
                  <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-lg text-center">Escaneie o QR Code</CardTitle>
                      <CardDescription className="text-zinc-400 text-center text-sm">Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-8">
                      <div className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-500/10">
                        <img
                          src={waQrCode}
                          alt="QR Code WhatsApp"
                          className="w-[280px] h-[280px] object-contain"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
