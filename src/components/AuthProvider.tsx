"use client"

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { useAuthStore } from '@/store/authStore'

// Reuse the module-level singleton — never instantiate inside a hook
const supabase = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (cancelled) return

        if (session?.user) {
          setUser(session.user)

          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!cancelled && prof) setProfile(prof)
        }
      } catch (error: any) {
        if (
          error?.name === 'AbortError' ||
          error?.message?.includes('Lock broken') ||
          error?.message?.includes('AbortError')
        ) {
          // Expected in React Strict Mode — silently ignore
          console.warn('Supabase auth lock (Strict Mode artifact) — ignored.')
        } else {
          console.error('Auth initialization error', error)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return

      const updateProfile = async () => {
        if (session?.user) {
          setUser(session.user)
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!cancelled && prof) {
            setProfile(prof)
          } else if (!cancelled && session.user && _event === 'SIGNED_IN') {
            // Fallback: create basic profile if missing (edge case: signup insert failed)
            const u = session.user
            const fallbackProfile = {
              id: u.id,
              full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Usuário',
              phone: u.user_metadata?.phone || null,
              email: u.email || null,
              role: 'client' as const,
              empresa_id: 'a3f8c1d2-e7b4-4a92-b5f0-9d2e6c8a1f3b',
            }
            const { error: insertErr } = await supabase
              .from('profiles')
              .upsert(fallbackProfile, { onConflict: 'id' })
            if (!insertErr && !cancelled) {
              setProfile(fallbackProfile)
            }
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      }
      updateProfile()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [setUser, setProfile, setLoading])

  return <>{children}</>
}
