"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AuthModal } from '@/components/AuthModal'
import { Footer } from '@/components/Footer'
import { useAuthStore } from '@/store/authStore'
import { LogIn, CalendarDays, MessageCircle, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const { user, profile } = useAuthStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [services, setServices] = useState<any[]>([])
  const [isOpenNow, setIsOpenNow] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function checkIfOpen(config: any) {
    if (!config.open_time || !config.close_time || !config.open_days) return

    const now = new Date()
    const day = now.getDay()
    
    if (!config.open_days.includes(day)) {
      setIsOpenNow(false)
      return
    }

    const currentTime = now.getHours() * 60 + now.getMinutes()
    const [openH, openM] = config.open_time.split(':').map(Number)
    const [closeH, closeM] = config.close_time.split(':').map(Number)
    
    const openTime = openH * 60 + openM
    const closeTime = closeH * 60 + closeM

    if (currentTime >= openTime && currentTime <= closeTime) {
      setIsOpenNow(true)
    } else {
      setIsOpenNow(false)
    }
  }

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch business config first (scoped to this deployment's empresa)
      const { data: configData } = await supabase
        .from('business_config')
        .select('*')
        .limit(1)
        .single()

      if (configData) {
        checkIfOpen(configData)

        // 2. Only fetch services belonging to this empresa
        const { data: svcData } = await supabase
          .from('services')
          .select('*')
          .eq('empresa_id', configData.empresa_id)
          .order('name')

        if (svcData) setServices(svcData)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const bgUrl = "https://gnjcdjhvekshzkwvwfdb.supabase.co/storage/v1/object/public/services/Home.jpg"
  const logoUrl = "https://gnjcdjhvekshzkwvwfdb.supabase.co/storage/v1/object/public/services/Logotipo.png"

  return (
    <div className="min-h-screen flex flex-col items-center bg-zinc-950">
      {/* Header */}
      <header className="w-full border-b border-zinc-800/80 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col pr-2">
              <span className="font-bold text-[15px] sm:text-lg tracking-tight text-white leading-none">Styllus Nego d'Hora</span>
              {isOpenNow !== null && (
                <span className={`text-xs font-semibold mt-1 flex items-center justify-start gap-1.5 ${isOpenNow ? 'text-emerald-500' : 'text-red-500'}`}>
                  <span className={`relative flex h-2 w-2`}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOpenNow ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 shadow-[0_0_8px] ${isOpenNow ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`}></span>
                  </span>
                  {isOpenNow ? 'Aberto agora' : 'Fechado'}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="ghost" className="hidden sm:flex text-zinc-300 hover:text-white" onClick={() => window.location.href = '/dashboard'}>
                Meu Painel
              </Button>
            ) : (
              <Button variant="ghost" className="text-zinc-300 hover:text-white hidden sm:flex" onClick={() => setIsAuthModalOpen(true)}>
                <LogIn className="w-4 h-4 mr-2" />
                <span>Entrar</span>
              </Button>
            )}
            <Button className="font-semibold shadow-lg shadow-red-600/20 bg-red-600 hover:bg-red-700 text-white" onClick={() => user ? window.location.href = '/dashboard' : setIsAuthModalOpen(true)}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Agendar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full relative h-[600px] sm:h-[700px] flex items-center justify-center">
        {/* Background Image Setup */}
        <div 
          className="absolute inset-0 bg-cover bg-no-repeat bg-left sm:bg-center object-left z-0"
          style={{ 
            backgroundImage: `url(${bgUrl})`,
            backgroundPosition: 'left center'
          }}
        >
          {/* Gradients to darken background */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40 z-0"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-0"></div>
        </div>

        <main className="w-full max-w-6xl mx-auto px-4 py-12 relative z-10 flex flex-col justify-center items-center h-full text-center">
          <section className="flex flex-col items-center space-y-8 max-w-2xl">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
              A sua melhor versão <br/>
              <span className="text-red-600">começa aqui.</span>
            </h1>
            <p className="text-zinc-300 text-lg md:text-xl max-w-xl font-medium leading-relaxed">
              Cortes modernos, barboterapia e um ambiente premium para você relaxar enquanto cuidamos do seu estilo.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4 w-full sm:w-auto justify-center">
              <Button size="lg" className="w-full sm:w-auto text-lg shadow-xl shadow-red-600/30 bg-red-600 hover:bg-red-700 text-white h-14 px-8" onClick={() => user ? window.location.href = '/dashboard' : setIsAuthModalOpen(true)}>
                <CalendarDays className="w-5 h-5 mr-2" />
                Ver Horários Disponíveis
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg gap-2 h-14 px-8 border-zinc-700 text-white bg-black/40 backdrop-blur-sm hover:bg-zinc-800" onClick={() => window.open('https://wa.me/55', '_blank')}>
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                Dúvidas (WhatsApp)
              </Button>
            </div>
          </section>
        </main>
      </div>

      {/* Services Showcase */}
      <section className="py-20 w-full max-w-6xl mx-auto px-4 z-10">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Nossos Serviços</h2>
          <div className="w-20 h-1 bg-red-600 mt-4 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            /* Skeletons */
            [1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 flex flex-col animate-pulse">
                <div className="w-full h-48 bg-zinc-800/80 rounded-xl mb-5"></div>
                <div className="h-7 w-3/4 bg-zinc-800/80 rounded-lg mb-3"></div>
                <div className="h-5 w-1/2 bg-zinc-800/80 rounded-lg mb-5"></div>
                <div className="mt-auto h-12 w-full bg-zinc-800/80 rounded-xl"></div>
              </div>
            ))
          ) : services.length > 0 ? (
            services.map((service) => (
              <div key={service.id} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 flex flex-col hover:border-zinc-700 transition-colors group">
                <div className="w-full h-48 rounded-xl mb-5 overflow-hidden bg-zinc-800">
                  <img 
                    src={service.image_url || "https://images.unsplash.com/photo-1593702288056-cccbde8e1215?q=80&w=800&auto=format&fit=crop"} 
                    alt={service.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{service.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800/60">
                  <span className="text-xl font-bold text-emerald-500">
                    R$ {Number(service.price).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-sm text-zinc-500 font-medium">{service.duration_minutes} min</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-zinc-500 py-10">
              Nenhum serviço disponível no momento.
            </div>
          )}
        </div>
      </section>

      {/* Google Maps / Location Section */}
      <section className="py-20 w-full bg-zinc-900/30 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col gap-12 items-center text-center">
          <div className="flex-1 space-y-6 max-w-2xl">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <MapPin className="w-8 h-8 text-red-600" />
              Nossa Localização
            </h2>
            <p className="text-zinc-400 text-lg">
              Venha nos visitar! Estamos em uma localização de fácil acesso, com ambiente climatizado e conforto garantido para o seu atendimento.
            </p>
          </div>
          <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative h-[400px]">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.2616259837962!2d-46.467822525428456!3d-23.523071359654165!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce6143b8bedb63%3A0x6e2697b0a7c493a7!2sR.%20Japicanga%2C%20206%20-%20Vila%20Cisper%2C%20S%C3%A3o%20Paulo%20-%20SP%2C%2003816-010!5e0!3m2!1spt-BR!2sbr!4v1700000000000!5m2!1spt-BR!2sbr"
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 grayscale contrast-125 opacity-80 mix-blend-screen"
            ></iframe>
          </div>
        </div>
      </section>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => window.location.href = '/dashboard'}
      />
      <Footer />
    </div>
  )
}
