'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

const DISMISSED_KEY = 'pwa_banner_dismissed_at'
const DISMISS_DURATION_DAYS = 1

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    const dismissedAt = parseInt(raw, 10)
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
    return daysSince < DISMISS_DURATION_DAYS
  } catch {
    return false
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

export function PWAInstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Never show if already in standalone/installed mode
    if (isInStandaloneMode()) return
    // Never show if dismissed recently
    if (wasDismissedRecently()) return

    const ios = isIOS()
    setIsIOSDevice(ios)

    if (ios) {
      // iOS: show manual instructions banner after 3s
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }

    // Android/Desktop: wait for the native install prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Detect if user installs via OS prompt
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
    setShow(false)
  }

  const handleDismiss = () => {
    saveDismissed()
    setShow(false)
  }

  if (!show || installed) return null

  return (
    <>
      {/* Backdrop blur on mobile */}
      <div
        className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-[2px] sm:hidden"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        aria-label="Instalar aplicativo"
        className="fixed bottom-0 left-0 right-0 z-[999] px-4 pb-6 pt-1 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
        style={{ animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      >
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">
          {/* Red accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {/* App icon */}
                <div className="relative flex-shrink-0">
                  <img
                    src="/android-chrome-192x192.png"
                    alt="Styllus"
                    className="w-12 h-12 rounded-xl shadow-lg"
                  />
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">Styllus Nego d'Hora</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Barbearia</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message */}
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              {isIOSDevice
                ? 'Instale o app e agende seu horário com um toque!'
                : 'Instale o app e agende seu horário com um toque!'}
            </p>

            {/* iOS Instructions */}
            {isIOSDevice ? (
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 mb-4">
                <p className="text-xs text-zinc-400 font-medium mb-2">Como instalar:</p>
                <ol className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold">1</span>
                    Toque em <Share className="w-3.5 h-3.5 text-zinc-400 inline mx-1" /> <strong>Compartilhar</strong> no Safari
                  </li>
                  <li className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold">2</span>
                    Selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold">3</span>
                    Confirme tocando em <strong>Adicionar</strong>
                  </li>
                </ol>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex gap-2">
              {!isIOSDevice && (
                <button
                  onClick={handleInstall}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold rounded-xl h-11 transition-colors shadow-lg shadow-red-600/25"
                >
                  <Download className="w-4 h-4" />
                  Instalar Agora
                </button>
              )}
              <button
                onClick={handleDismiss}
                className={`flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-sm font-medium rounded-xl h-11 transition-colors border border-zinc-800 hover:bg-zinc-800/60 ${isIOSDevice ? 'flex-1' : 'px-4'}`}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
