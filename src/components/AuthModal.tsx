"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Footer } from './Footer'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { X } from 'lucide-react'

// This will be replaced with context/props in real usage, using a default valid UUID for MVP
const EMPRESA_ID = "00000000-0000-0000-0000-000000000000" 

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  if (!isOpen) return null

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        if (data.user) {
          // After auth signup, create the profile
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            phone,
            email,
            role: 'client',
            empresa_id: EMPRESA_ID
          })
          if (profileError) throw profileError
        }
      }
      
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {isLogin ? 'Entrar na sua conta' : 'Criar nova conta'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-zinc-900 rounded-lg">
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${isLogin ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${!isLogin ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setIsLogin(false)}
          >
            Cadastro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input 
                  id="fullName" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  required={!isLogin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular (WhatsApp)</Label>
                <Input 
                  id="phone" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(AA) 90000-0000"
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input 
              id="password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {isLogin && (
              <div className="flex justify-end mt-1">
                <a href="/reset-password" className="text-xs font-medium text-red-500 hover:text-red-400">
                  Esqueci minha senha
                </a>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>
        <div className="-mx-6 border-t-0 -mb-6">
          <Footer />
        </div>
      </div>
    </div>
  )
}
