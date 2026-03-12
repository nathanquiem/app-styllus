"use client"

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/authStore'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { X, Calendar, Clock, User } from 'lucide-react'
import { format } from 'date-fns'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: string
  empresaId: string
}

// Use the singleton client directly — never create a new instance inside a hook
// to avoid "Lock broken" AbortErrors from concurrent Supabase auth requests.
const supabase = createClient()

export function BookingModal({ isOpen, onClose, onSuccess, userId, empresaId }: BookingModalProps) {
  const { profile } = useAuthStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [services, setServices] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedService, setSelectedService] = useState<any>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [barbers, setBarbers] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const [barbersLoading, setBarbersLoading] = useState(false)

  const [date, setDate] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState('')
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [config, setConfig] = useState<any>(null)

  // Track if a services fetch is already in flight to prevent duplicates
  const fetchingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      fetchServices()
      fetchConfig()
    } else {
      setStep(1)
      setSelectedService(null)
      setSelectedBarber(null)
      setBarbers([])
      setDate('')
      setTime('')
      setError('')
      setOccupiedSlots([])
      setServicesError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (config && isOpen && !date) {
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
      if (foundDate) setDate(foundDate)
    }
  }, [config, isOpen, date])

  useEffect(() => {
    if (date) {
      fetchOccupiedSlots(date)
    } else {
      setOccupiedSlots([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedBarber])

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from('business_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .limit(1)
        .single()
      if (data) setConfig(data)
    } catch (e) {
      console.error(e)
    }
  }

  /**
   * Fetches all confirmed bookings for the selected date.
   * Filters by barber_id if one is selected.
   */
  const fetchOccupiedSlots = async (selectedDate: string) => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0).toISOString()
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59).toISOString()

    let query = supabase
      .from('bookings')
      .select('start_time, service_id, barber_id')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .neq('status', 'canceled')

    if (selectedBarber) {
      query = query.eq('barber_id', selectedBarber.id)
    }

    const { data: bookings } = await query

    if (!bookings || bookings.length === 0) {
      setOccupiedSlots([])
      return
    }

    // Fetch all service durations in one query using the collected service_ids
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceIds = [...new Set(bookings.map((b: any) => b.service_id).filter(Boolean))]
    const durationMap: Record<string, number> = {}

    if (serviceIds.length > 0) {
      const { data: svcData } = await supabase
        .from('services')
        .select('id, duration_minutes')
        .in('id', serviceIds)

      if (svcData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        svcData.forEach((s: any) => {
          durationMap[s.id] = s.duration_minutes
        })
      }
    }

    const blocked = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const fetchServices = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setServicesLoading(true)
    setServicesError('')

    try {
      // 1. Fetch allowed services (those with at least 1 active barber)
      const { data: activeBarbers } = await supabase
        .from('barbers')
        .select('id, barber_services(service_id)')
        .eq('active', true)
        
      const allowedServiceIds = new Set<string>()
      activeBarbers?.forEach((b: any) => {
        b.barber_services?.forEach((bs: any) => allowedServiceIds.add(bs.service_id))
      })

      // 2. Fetch services
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, image_url')
        .order('name')

      if (error) {
        if (error.message?.includes('Lock broken') || error.message?.includes('AbortError')) {
          console.warn('Transient Supabase lock on services fetch — will retry.')
          await new Promise(r => setTimeout(r, 500))
          const retry = await supabase
            .from('services')
            .select('id, name, price, duration_minutes, image_url')
            .order('name')
          if (retry.data) {
             setServices(retry.data.filter(s => allowedServiceIds.has(s.id)))
          } else throw retry.error
        } else {
          throw error
        }
      } else if (data) {
        setServices(data.filter(s => allowedServiceIds.has(s.id)))
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const msg = err?.message || JSON.stringify(err) || 'Erro desconhecido'
      console.error('Erro ao buscar serviços:', msg)
      if (!msg.includes('Lock broken') && !msg.includes('AbortError')) {
        setServicesError(
          'Não foi possível carregar os serviços. Verifique as permissões (RLS).'
        )
      }
    } finally {
      setServicesLoading(false)
      fetchingRef.current = false
    }
  }

  const fetchBarbersForService = async (serviceId: string) => {
    setBarbersLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select(`
          id, 
          name, 
          photo_url, 
          barber_services!inner(service_id)
        `)
        .eq('active', true)
        .eq('barber_services.service_id', serviceId)
      
      if (error) throw error

      if (data && data.length > 0) {
        setBarbers(data)
        if (data.length === 1) {
          // Auto-select if only 1 barber is available
          setSelectedBarber(data[0])
          setStep(3)
        } else {
          setStep(2)
        }
      } else {
        // No specific barbers tied, proceed to Step 3 generally
        setBarbers([])
        setSelectedBarber(null)
        setStep(3)
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err)
      setError('Erro ao buscar barbeiros.')
    } finally {
      setBarbersLoading(false)
    }
  }

  const handleNextStep1 = () => {
    if (!selectedService) {
      setError('Selecione um serviço primeiro.')
      return
    }
    setError('')
    fetchBarbersForService(selectedService.id)
  }

  const handleNextStep2 = () => {
    if (barbers.length > 0 && !selectedBarber) {
      setError('Selecione um barbeiro primeiro.')
      return
    }
    setError('')
    setStep(3)
  }

  const handleBooking = async () => {
    if (!date || !time) {
      setError('Selecione a data e o horário.')
      return
    }

    if (config) {
      // Validate date
      const [y, m, d] = date.split('-').map(Number)
      const selectedD = new Date(y, m - 1, d)
      const dayOfWeek = selectedD.getDay()
      if (config.open_days && !config.open_days.includes(dayOfWeek)) {
        setError('A barbearia não abre neste dia da semana.')
        return
      }
      if (config.closed_dates && config.closed_dates.includes(date)) {
        setError('A barbearia estará fechada nesta data.')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const [year, month, day] = date.split('-').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      const bookingDate = new Date(year, month - 1, day, hours, minutes)

      const endTime = new Date(bookingDate.getTime() + (selectedService.duration_minutes || 30) * 60000)

      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          client_id: userId,
          service_id: selectedService.id,
          barber_id: selectedBarber ? selectedBarber.id : null,
          start_time: bookingDate.toISOString(),
          end_time: endTime.toISOString(),
          empresa_id: empresaId,
          status: 'confirmed',
          guest_name: profile?.full_name || null,
          guest_phone: profile?.phone || null,
        }).select().single()

      if (bookingError) throw bookingError

      // Dispatch the WhatsApp Webhook if instance is configured
      if (config?.evolution_instance_id && profile?.phone) {
        const webhookPayload = {
          event: "novo_agendamento",
          instanceName: config.evolution_instance_id,
          apikey_id: config.apikey_id,
          phone: profile.phone,
          clientName: profile?.full_name || 'Cliente',
          serviceName: selectedService.name,
          barberName: selectedBarber ? selectedBarber.name : 'Barbeiro',
          bookingDate: bookingDate.toLocaleDateString('pt-BR'),
          bookingTime: time
        }

        fetch('https://n8n.mundoai.com.br/webhook/novo-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        }).catch(err => console.error("Erro ao notificar webhook whatsapp:", err))
      }

      onSuccess()
      onClose()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Erro ao agendar.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const generateTimeSlots = () => {
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
    const isToday = date === format(now, 'yyyy-MM-dd')
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()

    while (cursorH < endHour || (cursorH === endHour && cursorM === 0)) {
      const slotStr = `${cursorH.toString().padStart(2, '0')}:${cursorM.toString().padStart(2, '0')}`
      
      let isValidSlot = true
      if (isToday) {
        const slotTotalMinutes = cursorH * 60 + cursorM
        // Minimum 30 mins from now
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Novo Agendamento</h2>
          <p className="text-zinc-400 text-sm">Passo {step === 3 && barbers.length <= 1 ? 2 : step} de {barbers.length > 1 ? 3 : 2}</p>
        </div>

        <div className="p-6">
          {error && (
            <p className="text-red-500 text-sm mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          {/* STEP 1: Service selection */}
          {step === 1 && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <Label className="text-zinc-300">Selecione o Serviço</Label>

              {servicesLoading ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm py-4">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  Carregando serviços...
                </div>
              ) : servicesError ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {servicesError}
                  </div>
                  <Button variant="outline" className="w-full text-xs" onClick={fetchServices}>
                    Tentar novamente
                  </Button>
                </div>
              ) : services.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-zinc-500 text-sm italic">Nenhum serviço disponível no momento.</p>
                  <Button variant="outline" className="w-full text-xs" onClick={fetchServices}>
                    Recarregar
                  </Button>
                </div>
              ) : (
                services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center gap-4 ${
                      selectedService?.id === service.id
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {service.image_url ? (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center">
                          <span className="text-zinc-500 text-[10px] uppercase">Sem img</span>
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-white">{service.name}</h4>
                        <p className="text-zinc-400 text-sm flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> {service.duration_minutes} min
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-500">R$ {service.price}</span>
                  </div>
                ))
              )}

              <Button
                className="w-full mt-6 shadow-lg shadow-red-500/20"
                onClick={handleNextStep1}
                disabled={!selectedService || barbersLoading}
              >
                {barbersLoading ? 'Carregando Barbeiros...' : 'Continuar'}
              </Button>
            </div>
          )}

          {/* STEP 2: Barber selection */}
          {step === 2 && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                 <Label className="text-zinc-300">Selecione o Barbeiro</Label>
                 <button onClick={() => setStep(1)} className="text-red-500 text-xs hover:underline">Voltar</button>
              </div>
              
              {barbers.map((b) => (
                 <div 
                   key={b.id} 
                   onClick={() => setSelectedBarber(b)} 
                   className={`p-4 rounded-xl border cursor-pointer flex items-center gap-4 transition-all ${
                     selectedBarber?.id === b.id 
                       ? 'border-red-500 bg-red-500/10' 
                       : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700'
                   }`}
                 >
                   {b.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.photo_url} alt={b.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
                   ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 border border-zinc-700">
                        <User className="w-6 h-6" />
                      </div>
                   )}
                   <span className="font-medium text-white text-lg">{b.name}</span>
                 </div>
              ))}
              
              <Button 
                className="w-full mt-6 shadow-lg shadow-red-500/20" 
                onClick={handleNextStep2} 
                disabled={!selectedBarber}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* STEP 3: Date & time selection */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-zinc-400">Resumo:</span>
                  <button onClick={() => setStep(barbers.length > 1 ? 2 : 1)} className="text-red-500 text-xs hover:underline flex flex-col items-end">
                    Voltar
                  </button>
                </div>
                <p className="font-medium text-white">{selectedService?.name}</p>
                {selectedBarber && (
                  <p className="font-medium text-zinc-300 text-sm mt-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-red-500" /> Com: {selectedBarber.name}
                  </p>
                )}
                <div className="flex justify-between items-end mt-2">
                  <p className="text-zinc-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {selectedService?.duration_minutes} min
                  </p>
                  <p className="text-emerald-500 font-bold">R$ {selectedService?.price}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Data
                </Label>
                <Input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={date}
                  onChange={(e) => {
                    const val = e.target.value
                    if (config?.closed_dates?.includes(val)) {
                      alert('A barbearia estará fechada nesta data.')
                      setDate('')
                      return
                    }
                    if (val && config?.open_days) {
                       const [y, m, d] = val.split('-').map(Number)
                       const dayOfWeek = new Date(y, m - 1, d).getDay()
                       if (!config.open_days.includes(dayOfWeek)) {
                          alert('A barbearia não abre neste dia da semana.')
                          setDate('')
                          return
                       }
                    }
                    setDate(val)
                  }}
                  className="bg-zinc-900 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Horário
                  {selectedService && (
                    <span className="text-xs text-zinc-500 ml-1">
                      ({selectedService.duration_minutes}min)
                    </span>
                  )}
                </Label>
                {!date ? (
                  <p className="text-sm text-zinc-500 italic">Selecione uma data primeiro</p>
                ) : (
                  generateTimeSlots().length === 0 ? (
                    <p className="text-sm text-red-500">Nenhum horário disponível para esta data hoje.</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {generateTimeSlots().map((slot) => {
                        const isOccupied = occupiedSlots.includes(slot)
                        return (
                          <button
                            key={slot}
                            onClick={() => !isOccupied && setTime(slot)}
                            disabled={isOccupied}
                            className={`py-2 text-sm rounded-lg border transition-all ${
                              isOccupied
                                ? 'bg-zinc-950 border-zinc-900 text-zinc-600 cursor-not-allowed opacity-50 line-through'
                                : time === slot
                                ? 'bg-red-500 border-red-500 text-white font-medium'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
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

              <Button
                className="w-full mt-6 shadow-lg shadow-red-500/20"
                onClick={handleBooking}
                disabled={!date || !time || loading}
              >
                {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          )}
        </div>        {/* Footer */}
        <div className="bg-zinc-950 pb-4 pt-2 text-center border-t border-zinc-900 mx-6">
          <p className="text-xs text-white/80">
            Desenvolvido por <a href="https://mundoai.com.br" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-zinc-300 hover:underline transition-colors mt-2 block">MundoAI - Soluções Comerciais</a>
          </p>
        </div>
      </div>
    </div>
  )
}
