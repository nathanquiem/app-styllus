"use client"

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { useAuthStore } from '@/store/authStore'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID!

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
            .from('profiles_styllus')
            .select('*')
            .eq('id', session.user.id)
            
            .maybeSingle()

          if (!cancelled && prof) setProfile(prof)
          // If no profile for this empresa, user exists in another app — don't set profile
        }
      } catch (error: any) {
        if (
          error?.name === 'AbortError' ||
          error?.message?.includes('Lock broken') ||
          error?.message?.includes('AbortError')
        ) {
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
            .from('profiles_styllus')
            .select('*')
            .eq('id', session.user.id)
            
            .maybeSingle()

          if (!cancelled && prof) {
            setProfile(prof)
          } else if (!cancelled && session.user && _event === 'SIGNED_IN' && !prof) {
            // User has no profile in this empresa — sign them out to prevent cross-tenant access
            console.warn('User has no profile in this empresa. Signing out.')
            await supabase.auth.signOut()
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
