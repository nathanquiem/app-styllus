"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ArrowLeft } from 'lucide-react'
import { Footer } from '@/components/Footer'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (error) throw error
      setSuccess(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-zinc-950 p-4 pt-20">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative">
        <button 
          onClick={() => window.location.href = '/'} 
          className="absolute -top-12 left-0 text-zinc-400 hover:text-white flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Esqueceu sua senha? Digite seu e-mail abaixo e enviaremos um link para redefini-la.
        </p>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-emerald-400 text-sm font-medium">
              E-mail de recuperação enviado! Verifique sua caixa de entrada.
            </p>
            <Button 
              className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white" 
              onClick={() => window.location.href = '/'}
            >
              Voltar para o Início
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </Button>
          </form>
        )}
      </div>
      <div className="mt-8 max-w-md w-full">
        <Footer />
      </div>
    </div>
  )
}
