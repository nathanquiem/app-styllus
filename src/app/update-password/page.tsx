"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Footer } from '@/components/Footer'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check if user is trying to update without auth session
    const checkHash = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // If there's an error on hash resolution or auth, session could be null
      // The supabase client automatically parses the url fragments for the session
      if (!session) {
        // Just warning, user might still get session parsing on mount
      }
    }
    checkHash()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      if (error) throw error
      setSuccess(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-zinc-950 p-4 pt-20">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2">Criar Nova Senha</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Digite e confirme sua nova senha abaixo.
        </p>

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-emerald-400 text-sm font-medium">
              Senha atualizada com sucesso!
            </p>
            <Button 
              className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white" 
              onClick={() => window.location.href = '/'}
            >
              Fazer Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            
            {error && (
              <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 p-2 rounded">{error}</p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
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
