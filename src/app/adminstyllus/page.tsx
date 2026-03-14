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
  const [agendaFilter, setAgendaFilter] = useState<'today' | 'week' | 'future' | 'past' | 'historyMonth'>('today')
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
  }, [clientsSearch, activeTab])

  // --- QUICK BOOKING LOGIC ---
  const generateQuickTimeSlots = () => {
    const slots = []
    let startHour = 9
    let startMin = 0
    let closeTotalMinutes = 19 * 60 // default → last slot 18:30

    if (config?.open_time && config?.close_time) {
       const [openH, openM] = config.open_time.split(':').map(Number)
       const [closeH, closeM] = config.close_time.split(':').map(Number)
       startHour = openH
       startMin = openM
       closeTotalMinutes = closeH * 60 + closeM
    }

    let cursorH = startHour
    let cursorM = startMin

    const now = new Date()
    const isToday = quickDate === format(now, 'yyyy-MM-dd')
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()

    const selectedServiceData = services.find(s => s.id === quickServiceId)
    const serviceDuration = selectedServiceData?.duration || 30 // Use 'duration' from serviceForm, assuming it's in minutes
    const neededSlots = Math.ceil(serviceDuration / 30) // Number of 30-min slots required for the service

    while (true) {
      const slotTotalMinutes = cursorH * 60 + cursorM

      // A slot is valid only if it finishes by closing time
      if (slotTotalMinutes + serviceDuration > closeTotalMinutes) break

      const slotStr = `${cursorH.toString().padStart(2, '0')}:${cursorM.toString().padStart(2, '0')}`
      
      let isValidSlot = true
      if (isToday) {
        // If today, ensure the slot is at least 30 minutes in the future
        if (slotTotalMinutes < currentTotalMinutes + 30) {
          isValidSlot = false
        }
      }

      // Check if this slot AND the subsequent needed slots are free
      if (isValidSlot) {
         let subCursorM = cursorM
         let subCursorH = cursorH
         for (let i = 0; i < neededSlots; i++) {
            const checkStr = `${subCursorH.toString().padStart(2, '0')}:${subCursorM.toString().padStart(2, '0')}`
            if (occupiedSlots.includes(checkStr)) {
               isValidSlot = false
               break
            }
            subCursorM += 30
            if (subCursorM >= 60) {
               subCursorM -= 60
               subCursorH += 1
            }
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

  useEffect(() => {
    if (activeTab === 'quick' && config && !quickDate) {
      let d = new Date()
      let foundDate = ''
      for (let i = 0; i < 30; i++) {
        const dateStr = format(d, 'yyyy-MM-dd')
        const dayOfWeek = d.getDay()
        const isClosedDate = config?.closed_dates?.includes(dateStr)
        const openDaysArr = Array.isArray(config?.open_days) 
          ? config.open_days.map(Number) 
          : typeof config?.open_days === 'string' 
            ? JSON.parse(config.open_days).map(Number) 
            : []
        const isOpenDay = !config?.open_days || openDaysArr.includes(dayOfWeek)
        
        let hasSlotsLeft = true
        if (i === 0 && config?.close_time) {
           const [closeH, closeM] = config.close_time.split(':').map(Number)
           const closeTotal = closeH * 60 + closeM
           const currentTotal = d.getHours() * 60 + d.getMinutes()
           if (currentTotal + 30 >= closeTotal) { // Check if there's at least one 30-min slot left today
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
  }, [activeTab, config, quickDate])

  useEffect(() => {
    if (quickDate && quickServiceId && quickBarberId) {
      fetchOccupiedSlots()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, quickServiceId, quickBarberId])

  const fetchOccupiedSlots = async () => {
    if (!quickDate || !quickBarberId || !quickServiceId) return

    const { data: bookings, error } = await supabase
      .from('bookings_styllus')
      .select('time')
      .eq('date', quickDate)
      .eq('barber_id', quickBarberId)
      .eq('status', 'confirmed')

    if (error) {
      console.error('Error fetching occupied slots:', error)
      return
    }

    const selectedServiceData = services.find(s => s.id === quickServiceId)
    const serviceDuration = selectedServiceData?.duration || 30 // Default to 30 if not found

    const occupied = new Set<string>()
    bookings.forEach((booking: any) => {
      const [h, m] = booking.time.split(':').map(Number)
      const bookingStartTotalMinutes = h * 60 + m
      
      // Mark all 30-minute intervals covered by the booking as occupied
      for (let i = 0; i < serviceDuration; i += 30) {
        const slotMinutes = bookingStartTotalMinutes + i
        const slotH = Math.floor(slotMinutes / 60)
        const slotM = slotMinutes % 60
        occupied.add(`${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`)
      }
    })
    setOccupiedSlots(Array.from(occupied))
  }

  const handleConfirmQuickBooking = async () => {
    if (!quickName || !quickPhone || !quickServiceId || !quickBarberId || !quickDate || !quickTime) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    setIsQuickBooking(true)
    try {
      // First, check if the client exists
      let client_id = null
      const { data: existingClient, error: clientError } = await supabase
        .from('clients_styllus')
        .select('id')
        .eq('phone', quickPhone.replace(/\D/g, ''))
        .single()

      if (clientError && clientError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error checking client:', clientError)
        alert('Erro ao verificar cliente.')
        setIsQuickBooking(false)
        return
      }

      if (existingClient) {
        client_id = existingClient.id
      } else {
        // If client doesn't exist, create a new one
        const { data: newClient, error: createClientError } = await supabase
          .from('clients_styllus')
          .insert({ full_name: quickName, phone: quickPhone.replace(/\D/g, ''), user_id: user?.id })
          .select('id')
          .single()

        if (createClientError) {
          console.error('Error creating client:', createClientError)
          alert('Erro ao criar novo cliente.')
          setIsQuickBooking(false)
          return
        }
        client_id = newClient.id
      }

      // Get service details for duration
      const serviceDetails = services.find(s => s.id === quickServiceId)
      if (!serviceDetails) {
        alert('Serviço não encontrado.')
        setIsQuickBooking(false)
        return
      }

      const { error: bookingError } = await supabase
        .from('bookings_styllus')
        .insert({
          client_id: client_id,
          barber_id: quickBarberId,
          service_id: quickServiceId,
          date: quickDate,
          time: quickTime,
          duration: serviceDetails.duration, // Use duration from service details
          status: 'confirmed',
          user_id: user?.id,
          price: serviceDetails.price
        })

      if (bookingError) {
        console.error('Error creating quick booking:', bookingError)
        alert('Erro ao criar agendamento rápido. Verifique se o horário já não está ocupado.')
      } else {
        alert('Agendamento rápido criado com sucesso!')
        setQuickName('')
        setQuickPhone('')
        setQuickServiceId('')
        setQuickBarberId('')
        setQuickTime('')
        // Re-fetch agenda to show new booking
        fetchAgenda(0)
        // Re-fetch occupied slots for the current quickDate
        fetchOccupiedSlots()
      }
    } catch (error) {
      console.error('Unexpected error during quick booking:', error)
      alert('Ocorreu um erro inesperado.')
    } finally {
      setIsQuickBooking(false)
    }
  }

  // --- SERVICES LOGIC ---
  const fetchServices = async () => {
    const { data, error } = await supabase.from('services_styllus').select('*').eq('user_id', user?.id).order('name', { ascending: true })
    if (error) console.error('Error fetching services:', error)
    else setServices(data)
  }

  const handleSaveService = async () => {
    setIsSavingService(true)
    let imageUrl = serviceForm.image_url

    if (serviceImageFile) {
      const fileExt = serviceImageFile.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user?.id}/${fileName}`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('service_images')
        .upload(filePath, serviceImageFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Error uploading service image:', uploadError)
        alert('Erro ao fazer upload da imagem.')
        setIsSavingService(false)
        return
      }
      imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service_images/${filePath}`
    }

    const serviceData = {
      name: serviceForm.name,
      price: parseFloat(serviceForm.price),
      duration: parseInt(serviceForm.duration),
      description: serviceForm.description,
      image_url: imageUrl,
      user_id: user?.id,
    }

    if (editingServiceId) {
      const { error } = await supabase.from('services_styllus').update(serviceData).eq('id', editingServiceId)
      if (error) console.error('Error updating service:', error)
      else {
        alert('Serviço atualizado com sucesso!')
        setEditingServiceId(null)
        setIsCreatingService(false)
        fetchServices()
      }
    } else {
      const { error } = await supabase.from('services_styllus').insert(serviceData)
      if (error) console.error('Error creating service:', error)
      else {
        alert('Serviço criado com sucesso!')
        setIsCreatingService(false)
        fetchServices()
      }
    }
    setIsSavingService(false)
  }

  const handleEditService = (service: any) => {
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration.toString(),
      description: service.description || '',
      image_url: service.image_url || ''
    })
    setServiceImageFile(null)
    setIsCreatingService(true)
  }

  const handleDeleteService = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return
    const { error } = await supabase.from('services_styllus').delete().eq('id', id)
    if (error) console.error('Error deleting service:', error)
    else fetchServices()
  }

  // --- BARBERS LOGIC ---
  const fetchBarbers = async () => {
    const { data, error } = await supabase.from('barbers_styllus').select('*, barber_services_styllus(service_id)').eq('user_id', user?.id).order('name', { ascending: true })
    if (error) console.error('Error fetching barbers:', error)
    else {
      const barbersWithServices = data.map((barber: any) => ({
        ...barber,
        selectedServices: barber.barber_services_styllus.map((bs: { service_id: string }) => bs.service_id)
      }))
      setBarbersList(barbersWithServices)
    }
  }

  const toggleServiceForBarber = (serviceId: string) => {
    setBarberForm(prev => {
      const newSelectedServices = prev.selectedServices.includes(serviceId)
        ? prev.selectedServices.filter(id => id !== serviceId)
        : [...prev.selectedServices, serviceId]
      return { ...prev, selectedServices: newSelectedServices }
    })
  }

  const handleSaveBarber = async () => {
    setIsSavingBarber(true)
    let photoUrl = barberForm.photo_url

    if (barberImageFile) {
      const fileExt = barberImageFile.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user?.id}/barbers/${fileName}`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('barber_photos')
        .upload(filePath, barberImageFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Error uploading barber photo:', uploadError)
        alert('Erro ao fazer upload da foto.')
        setIsSavingBarber(false)
        return
      }
      photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/barber_photos/${filePath}`
    }

    const barberData = {
      name: barberForm.name,
      active: barberForm.active,
      photo_url: photoUrl,
      user_id: user?.id,
    }

    if (editingBarberId) {
      const { error: updateError } = await supabase.from('barbers_styllus').update(barberData).eq('id', editingBarberId)
      if (updateError) {
        console.error('Error updating barber:', updateError)
        alert('Erro ao atualizar barbeiro.')
        setIsSavingBarber(false)
        return
      }
      // Update barber_services_styllus
      await supabase.from('barber_services_styllus').delete().eq('barber_id', editingBarberId)
      const serviceInserts = barberForm.selectedServices.map(service_id => ({ barber_id: editingBarberId, service_id }))
      if (serviceInserts.length > 0) {
        await supabase.from('barber_services_styllus').insert(serviceInserts)
      }
      alert('Barbeiro atualizado com sucesso!')
      setEditingBarberId(null)
      setIsCreatingBarber(false)
      fetchBarbers()
    } else {
      const { data: newBarber, error: insertError } = await supabase.from('barbers_styllus').insert(barberData).select('id').single()
      if (insertError) {
        console.error('Error creating barber:', insertError)
        alert('Erro ao criar barbeiro.')
        setIsSavingBarber(false)
        return
      }
      // Insert barber_services_styllus
      const serviceInserts = barberForm.selectedServices.map(service_id => ({ barber_id: newBarber.id, service_id }))
      if (serviceInserts.length > 0) {
        await supabase.from('barber_services_styllus').insert(serviceInserts)
      }
      alert('Barbeiro criado com sucesso!')
      setIsCreatingBarber(false)
      fetchBarbers()
    }
    setIsSavingBarber(false)
  }

  const handleEditBarber = (barber: any) => {
    setEditingBarberId(barber.id)
    setBarberForm({
      name: barber.name,
      active: barber.active,
      selectedServices: barber.selectedServices,
      photo_url: barber.photo_url || ''
    })
    setBarberImageFile(null)
    setIsCreatingBarber(true)
  }

  const handleDeleteBarber = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este barbeiro?')) return
    const { error } = await supabase.from('barbers_styllus').delete().eq('id', id)
    if (error) console.error('Error deleting barber:', error)
    else fetchBarbers()
  }

  // --- CLIENTS LOGIC ---
  const fetchClients = async (page: number, search: string) => {
    setIsClientsLoading(true)
    const ITEMS_PER_PAGE = 10
    const from = page * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let query = supabase
      .from('clients_styllus')
      .select('*, bookings_styllus(price)', { count: 'exact' })
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      const clientsWithMetrics = data.map((client: any) => ({
        ...client,
        bookingCount: client.bookings_styllus.length,
        totalSpent: client.bookings_styllus.reduce((sum: number, booking: { price: number }) => sum + booking.price, 0)
      }))

      if (page === 0) {
        setClientsList(clientsWithMetrics)
      } else {
        setClientsList(prev => [...prev, ...clientsWithMetrics])
      }
      setHasMoreClients(count && count > to + 1)
      setClientsPage(page)
    }
    setIsClientsLoading(false)
  }

  const loadMoreClients = () => {
    fetchClients(clientsPage + 1, clientsSearch)
  }

  // --- CONFIG LOGIC ---
  const fetchConfig = async () => {
    const { data, error } = await supabase.from('config_styllus').select('*').eq('user_id', user?.id).single()
    if (error && error.code !== 'PGRST116') console.error('Error fetching config:', error)
    else if (data) setConfig(data)
  }

  const handleSaveConfig = async () => {
    setIsSavingConfig(true)
    const configData = {
      open_time: config.open_time,
      close_time: config.close_time,
      open_days: config.open_days,
      cancel_limit_hours: config.cancel_limit_hours,
      closed_dates: config.closed_dates,
      user_id: user?.id,
    }

    const { error } = await supabase.from('config_styllus').upsert(configData, { onConflict: 'user_id' })
    if (error) console.error('Error saving config:', error)
    else alert('Configurações salvas com sucesso!')
    setIsSavingConfig(false)
  }

  const toggleDay = (dayIndex: number) => {
    setConfig((prev: any) => {
      const currentOpenDays = Array.isArray(prev.open_days) ? prev.open_days : [];
      const newOpenDays = currentOpenDays.includes(dayIndex)
        ? currentOpenDays.filter((d: number) => d !== dayIndex)
        : [...currentOpenDays, dayIndex];
      return { ...prev, open_days: newOpenDays.sort((a: number, b: number) => a - b) };
    });
  };

  const addClosedDate = (dateStr: string) => {
    if (!dateStr) return
    setConfig((prev: any) => {
      const currentClosedDates = Array.isArray(prev.closed_dates) ? prev.closed_dates : [];
      if (currentClosedDates.includes(dateStr)) return prev;
      return { ...prev, closed_dates: [...currentClosedDates, dateStr].sort() };
    });
  };

  const removeClosedDate = (dateStr: string) => {
    setConfig((prev: any) => {
      const currentClosedDates = Array.isArray(prev.closed_dates) ? prev.closed_dates : [];
      return { ...prev, closed_dates: currentClosedDates.filter((d: string) => d !== dateStr) };
    });
  };

  // --- METRICS LOGIC ---
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricDateStart, setMetricDateStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [metricDateEnd, setMetricDateEnd] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'))
  const [metricPreset, setMetricPreset] = useState('month')
  const [metricCompare, setMetricCompare] = useState(false)
  const [metricsData, setMetricsData] = useState<any>({
    summary: {},
    daily: [],
    topServices: [],
    monthly: []
  })

  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricDateStart, metricDateEnd, metricCompare, activeTab])

  const applyMetricPreset = (preset: string) => {
    setMetricPreset(preset)
    const today = new Date()
    let start: Date, end: Date

    switch (preset) {
      case '7d':
        start = subDays(today, 6)
        end = today
        break
      case '30d':
        start = subDays(today, 29)
        end = today
        break
      case 'month':
        start = startOfMonth(today)
        end = today
        break
      case 'lastMonth':
        start = startOfMonth(subMonths(today, 1))
        end = endOfMonth(subMonths(today, 1))
        break
      case '6m':
        start = subMonths(startOfMonth(today), 5)
        end = today
        break
      default:
        start = startOfMonth(today)
        end = today
    }
    setMetricDateStart(format(start, 'yyyy-MM-dd'))
    setMetricDateEnd(format(end, 'yyyy-MM-dd'))
  }

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-metrics', {
        body: {
          startDate: metricDateStart,
          endDate: metricDateEnd,
          compare: metricCompare,
          userId: user?.id
        }
      })

      if (error) throw error
      setMetricsData(data)
    } catch (error) {
      console.error('Error fetching metrics:', error)
      setMetricsData({ summary: {}, daily: [], topServices: [], monthly: [] })
    } finally {
      setMetricsLoading(false)
    }
  }

  // --- WHATSAPP LOGIC ---
  const handleWaFetchInstances = async () => {
    setWaLoading('fetch')
    setWaError(null)
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'list', userId: user?.id }
      })
      if (error) throw error
      setWaInstances(data.instances || [])
      setWaLastUpdated(new Date())
    } catch (error: any) {
      console.error('Error fetching WA instances:', error)
      setWaError(error.message || 'Erro ao buscar instâncias do WhatsApp.')
    } finally {
      setWaLoading(null)
    }
  }

  const handleWaConnect = async (instanceName: string) => {
    setWaLoading('connect')
    setWaError(null)
    setWaQrCode(null)
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'connect', instanceName, userId: user?.id }
      })
      if (error) throw error
      if (data.qr) {
        setWaQrCode(data.qr)
      } else {
        alert('Instância conectada ou QR Code não gerado. Tente atualizar.')
        handleWaFetchInstances()
      }
    } catch (error: any) {
      console.error('Error connecting WA instance:', error)
      setWaError(error.message || 'Erro ao conectar instância do WhatsApp.')
    } finally {
      setWaLoading(null)
      setWaConnectingInstance(null)
    }
  }

  const handleWaDisconnect = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja desconectar a instância "${instanceName}"?`)) return
    setWaLoading('disconnect')
    setWaError(null)
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'disconnect', instanceName, userId: user?.id }
      })
      if (error) throw error
      alert(data.message || 'Instância desconectada com sucesso.')
      handleWaFetchInstances()
    } catch (error: any) {
      console.error('Error disconnecting WA instance:', error)
      setWaError(error.message || 'Erro ao desconectar instância do WhatsApp.')
    } finally {
      setWaLoading(null)
    }
  }

  const getWaTimeSinceUpdate = () => {
    if (!waLastUpdated) return ''
    const diffSeconds = differenceInDays(new Date(), waLastUpdated)
    if (diffSeconds === 0) return 'Atualizado há pouco'
    if (diffSeconds === 1) return 'Atualizado ontem'
    return `Atualizado há ${diffSeconds} dias`
  }

  // --- AGENDA LOGIC ---
  const fetchAgenda = async (page: number) => {
    setIsLoadingAgenda(true)
    const ITEMS_PER_PAGE = 10
    const from = page * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let query = supabase
      .from('bookings_styllus')
      .select('*, clients_styllus(*), barbers_styllus(name), services_styllus(name)')
      .eq('user_id', user?.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .range(from, to)

    const today = format(new Date(), 'yyyy-MM-dd')
    const startOfCurrentWeek = format(startOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd')
    const endOfCurrentWeek = format(endOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd')

    if (agendaFilter === 'today') {
      query = query.eq('date', today)
    } else if (agendaFilter === 'week') {
      query = query.gte('date', startOfCurrentWeek).lte('date', endOfCurrentWeek)
    } else if (agendaFilter === 'future') {
      query = query.gte('date', today)
    } else if (agendaFilter === 'past') {
      query = query.lt('date', today).order('date', { ascending: false })
    } else if (agendaFilter === 'historyMonth') {
      const start = format(startOfMonth(parseISO(historyMonth)), 'yyyy-MM-dd')
      const end = format(endOfMonth(parseISO(historyMonth)), 'yyyy-MM-dd')
      query = query.gte('date', start).lte('date', end).order('date', { ascending: false })
    }

    const { data, error, count } = await query.limit(ITEMS_PER_PAGE)

    if (error) {
      console.error('Error fetching agenda:', error)
    } else {
      if (page === 0) {
        setAgendaBookings(data)
      } else {
        setAgendaBookings(prev => [...prev, ...data])
      }
      setHasMoreAgenda(count && count > to + 1)
      setAgendaPage(page)
    }
    setIsLoadingAgenda(false)
  }

  const loadMoreAgenda = () => {
    fetchAgenda(agendaPage + 1)
  }

  const handleBookingAction = async (bookingId: string, status: 'confirmed' | 'cancelled' | 'completed') => {
    const { error } = await supabase.from('bookings_styllus').update({ status }).eq('id', bookingId)
    if (error) console.error('Error updating booking status:', error)
    else {
      alert(`Agendamento ${status === 'confirmed' ? 'confirmado' : status === 'cancelled' ? 'cancelado' : 'concluído'}!`)
      fetchAgenda(0) // Re-fetch agenda
    }
  }

  const handleBookingDelete = async (bookingId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return
    const { error } = await supabase.from('bookings_styllus').delete().eq('id', bookingId)
    if (error) console.error('Error deleting booking:', error)
    else {
      alert('Agendamento excluído!')
      fetchAgenda(0) // Re-fetch agenda
    }
  }

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'completed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
    }
  }

  const isBookingCancellable = (bookingDate: string, bookingTime: string) => {
    if (!config?.cancel_limit_hours) return true // If no limit set, always cancellable
    const bookingDateTime = parseISO(`${bookingDate}T${bookingTime}:00`)
    const limitDateTime = subHours(bookingDateTime, config.cancel_limit_hours)
    return isAfter(new Date(), limitDateTime)
  }

  // --- MAIN RENDER ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
      </div>
    )
  }

  if (!user) {
    router.push('/')
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0`}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-red-500">Styllus Admin</h1>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5 text-zinc-400" />
          </Button>
        </div>

        <nav className="flex-1 space-y-2">
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'agenda' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('agenda'); setIsMobileMenuOpen(false) }}>
            <Calendar className="w-5 h-5 mr-3" /> Agenda
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'quick' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('quick'); setIsMobileMenuOpen(false) }}>
            <Plus className="w-5 h-5 mr-3" /> Encaixe Rápido
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'services' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false) }}>
            <Scissors className="w-5 h-5 mr-3" /> Serviços
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'barbers' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('barbers'); setIsMobileMenuOpen(false) }}>
            <Users className="w-5 h-5 mr-3" /> Barbeiros
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'clients' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false) }}>
            <UserIcon className="w-5 h-5 mr-3" /> Clientes
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'metrics' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('metrics'); setIsMobileMenuOpen(false) }}>
            <BarChart3 className="w-5 h-5 mr-3" /> Métricas
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'whatsapp' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('whatsapp'); setIsMobileMenuOpen(false) }}>
            <Smartphone className="w-5 h-5 mr-3" /> WhatsApp
          </Button>
          <Button variant="ghost" className={`w-full justify-start text-lg font-medium ${activeTab === 'config' ? 'bg-zinc-800 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false) }}>
            <Settings className="w-5 h-5 mr-3" /> Configurações
          </Button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-white">{profile?.full_name || user?.email}</p>
              <p className="text-sm text-zinc-400">{profile?.role || 'Admin'}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:bg-zinc-800 hover:text-white" onClick={logout}>
            <LogOut className="w-5 h-5 mr-3" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h1 className="text-2xl font-bold text-red-500">Styllus Admin</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-zinc-400" />
          </Button>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* AGENDA */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Agenda de Agendamentos</h2>
                  <p className="text-zinc-400 text-sm">Gerencie os horários marcados pelos seus clientes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className={agendaFilter === 'today' ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'} onClick={() => setAgendaFilter('today')}>Hoje</Button>
                  <Button variant="outline" className={agendaFilter === 'week' ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'} onClick={() => setAgendaFilter('week')}>Esta Semana</Button>
                  <Button variant="outline" className={agendaFilter === 'future' ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'} onClick={() => setAgendaFilter('future')}>Próximos</Button>
                  <Button variant="outline" className={agendaFilter === 'past' ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'} onClick={() => setAgendaFilter('past')}>Anteriores</Button>
                  <Input type="month" value={historyMonth} onChange={e => { setHistoryMonth(e.target.value); setAgendaFilter('historyMonth') }} className="bg-zinc-900 border-zinc-800 text-white" />
                </div>
              </div>

              {isLoadingAgenda && agendaBookings.length === 0 ? (
                <div className="flex justify-center items-center py-16">
                  <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agendaBookings.map((booking: any) => (
                    <Card key={booking.id} className="border-zinc-800 bg-zinc-950 p-5">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-bold text-white">{booking.clients_styllus?.full_name || 'Cliente Desconhecido'}</h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getBookingStatusColor(booking.status)}`}>
                          {booking.status === 'confirmed' && 'Confirmado'}
                          {booking.status === 'pending' && 'Pendente'}
                          {booking.status === 'cancelled' && 'Cancelado'}
                          {booking.status === 'completed' && 'Concluído'}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-zinc-500" /> {format(parseISO(booking.date), 'dd/MM/yyyy', { locale: ptBR })} às {booking.time}</p>
                      <p className="text-zinc-400 text-sm mb-2 flex items-center gap-2"><Scissors className="w-4 h-4 text-zinc-500" /> {booking.services_styllus?.name || 'Serviço Desconhecido'}</p>
                      <p className="text-zinc-400 text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-zinc-500" /> {booking.barbers_styllus?.name || 'Barbeiro Não Atribuído'}</p>
                      <p className="text-emerald-500 font-bold text-md flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> R$ {booking.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>

                      <div className="flex gap-2 mt-4 border-t border-zinc-800 pt-4">
                        {booking.status === 'pending' && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => handleBookingAction(booking.id, 'confirmed')}>Confirmar</Button>
                        )}
                        {booking.status === 'confirmed' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={() => handleBookingAction(booking.id, 'completed')}>Concluir</Button>
                        )}
                        {booking.status !== 'cancelled' && isBookingCancellable(booking.date, booking.time) && (
                          <Button size="sm" variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 flex-1" onClick={() => handleBookingAction(booking.id, 'cancelled')}>Cancelar</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-zinc-500 hover:text-red-500" onClick={() => handleBookingDelete(booking.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {agendaBookings.length === 0 && (
                    <div className="col-span-full text-center p-8 border border-zinc-800 border-dashed rounded-xl">
                      <p className="text-zinc-500">Nenhum agendamento encontrado para este período.</p>
                    </div>
                  )}
                </div>
              )}

              {hasMoreAgenda && (
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
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-2xl font-bold">Encaixe Rápido</h2>
                <p className="text-zinc-400 text-sm">Crie um agendamento rapidamente para um cliente.</p>
              </div>

              <Card className="border-zinc-700 bg-zinc-950">
                <CardHeader>
                  <CardTitle>Novo Agendamento</CardTitle>
                  <CardDescription>Preencha os dados para agendar um horário.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Nome do Cliente *</Label>
                      <Input value={quickName} onChange={e => setQuickName(e.target.value)} className="bg-zinc-900 border-zinc-800" placeholder="Nome Completo" />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone do Cliente *</Label>
                      <Input value={quickPhone} onChange={e => setQuickPhone(maskPhoneInput(e.target.value))} className="bg-zinc-900 border-zinc-800" placeholder="(XX) XXXXX-XXXX" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Serviço *</Label>
                    <select value={quickServiceId} onChange={e => setQuickServiceId(e.target.value)} className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm ring-offset-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">Selecione um serviço</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id}>{service.name} (R$ {service.price})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Barbeiro *</Label>
                    <select value={quickBarberId} onChange={e => setQuickBarberId(e.target.value)} className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm ring-offset-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">Selecione um barbeiro</option>
                      {barbersList.filter(b => b.active).map(barber => (
                        <option key={barber.id} value={barber.id}>{barber.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Calendar className="w-4 h-4 text-zinc-500" /> Data *</Label>
                      <Input
                        type="date"
                        value={quickDate}
                        onChange={e => {
                          const val = e.target.value
                          if (val && config?.open_days) {
                             const [y, m, d] = val.split('-').map(Number)
                             const dayOfWeek = new Date(y, m - 1, d).getDay()
                             const openDaysArr = Array.isArray(config.open_days) 
                               ? config.open_days.map(Number) 
                               : typeof config.open_days === 'string' 
                                 ? JSON.parse(config.open_days).map(Number) 
                                 : []
                             if (!openDaysArr.includes(dayOfWeek)) {
                                alert('A barbearia não abre neste dia da semana.')
                                setQuickDate('')
                                return
                             }
                          }
                          setQuickDate(val)
                        }}
                        className="bg-zinc-900 border-zinc-800"
                        min={format(new Date(), 'yyyy-MM-dd')}
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
                          <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {service.duration}m</span>
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
                  <p className="text-zinc-400 text-sm">Gerencie os profissionais e os serviços que cada uno realiza.</p>
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
                            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{barber.barber_services_styllus?.length || 0} Serviços</span>
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
                            (Array.isArray(config?.open_days) ? config.open_days : typeof config?.open_days === 'string' ? JSON.parse(config.open_days).map(Number) : []).includes(ix) 
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
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className="text-xs bg-zinc-800 text-emerald-400 border border-zinc-700 px-2 py-0.5 rounded-full font-medium">
                                  {client.bookingCount || 0} agendamento{(client.bookingCount || 0) !== 1 ? 's' : ''}
                                </span>
                                <span className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-medium">
                                  R$ {(client.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
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
      </main>
    </div>
  )
}
